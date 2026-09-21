package executioncontroller

import (
	"errors"
	"testing"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	kubefake "k8s.io/client-go/kubernetes/fake"
	ktesting "k8s.io/client-go/testing"
)

func TestRetainedDeletePeerBetweenFinalizerUpdateAndDelete(t *testing.T) {
	for _, terminating := range []bool{false, true} {
		t.Run(map[bool]string{false: "peer-before-delete", true: "already-terminating"}[terminating], func(t *testing.T) {
			env := lifecycleAdminEnvironment(2, []any{})
			setConditionObject(env, "Retired", true, "WorkspaceRetained", "retained")
			setConditionObject(env, "ExecutorTerminated", true, "TerminalPodProof", "proved")
			d := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), env)
			k := kubefake.NewSimpleClientset(retainedPVC(), &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: profileAllocationConfigMap, Namespace: "ns"}, Data: map[string]string{profileAllocationKey("go"): `["env"]`}})
			store := NewStore(d, "ns", testProfiles(), nil).WithKubeClient(k)
			if err := store.DeleteRetiredEnvironment(t.Context(), adminRequestFixture()); err != nil {
				t.Fatal(err)
			}
			// Separate fake clients avoid the fake's per-client reactor lock, while both
			// reconcilers observe the same API-server tracker.
			peerClient := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
			peerClient.PrependReactor("*", "*", ktesting.ObjectReaction(d.Tracker()))
			peer := NewReconciler(peerClient, k, "ns", testProfiles())
			r := NewReconciler(d, k, "ns", testProfiles())
			t.Cleanup(peer.queue.ShutDown)
			t.Cleanup(r.queue.ShutDown)
			pvcsDeleted, envsDeleted := 0, 0
			k.PrependReactor("delete", "persistentvolumeclaims", func(a ktesting.Action) (bool, runtime.Object, error) {
				opts := a.(ktesting.DeleteAction).GetDeleteOptions()
				if opts.Preconditions == nil || opts.Preconditions.UID == nil || *opts.Preconditions.UID != "pvc-uid" {
					t.Fatal("PVC deletion lost exact UID")
				}
				pvcsDeleted++
				return false, nil, nil
			})
			deletion := func(a ktesting.Action) (bool, runtime.Object, error) {
				obj, err := d.Tracker().Get(ExecutionEnvironmentGVR, "ns", "env")
				if err != nil {
					return true, nil, err
				}
				cur := obj.(*unstructured.Unstructured)
				opts := a.(ktesting.DeleteAction).GetDeleteOptions()
				if opts.Preconditions == nil || opts.Preconditions.UID == nil || *opts.Preconditions.UID != cur.GetUID() {
					t.Fatal("CR deletion lost exact UID")
				}
				if contains(cur.GetFinalizers(), environmentFinalizer) {
					now := metav1.Now()
					cur.SetDeletionTimestamp(&now)
					return true, nil, d.Tracker().Update(ExecutionEnvironmentGVR, cur, "ns")
				}
				envsDeleted++
				return true, nil, d.Tracker().Delete(ExecutionEnvironmentGVR, "ns", "env")
			}
			peerClient.PrependReactor("delete", "executionenvironments", deletion)
			interleaved := false
			d.PrependReactor("delete", "executionenvironments", func(a ktesting.Action) (bool, runtime.Object, error) {
				if !interleaved {
					interleaved = true
					if err := peer.Reconcile(t.Context(), "env"); err != nil {
						t.Fatal(err)
					}
				}
				return deletion(a)
			})
			if terminating {
				obj, _ := d.Tracker().Get(ExecutionEnvironmentGVR, "ns", "env")
				cur := obj.(*unstructured.Unstructured)
				now := metav1.Now()
				cur.SetDeletionTimestamp(&now)
				if err := d.Tracker().Update(ExecutionEnvironmentGVR, cur, "ns"); err != nil {
					t.Fatal(err)
				}
			}
			for range 5 {
				if err := r.Reconcile(t.Context(), "env"); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := d.Tracker().Get(ExecutionEnvironmentGVR, "ns", "env"); !apierrors.IsNotFound(err) {
				t.Fatalf("authorized deletion stranded: %v", err)
			}
			if pvcsDeleted != 1 || envsDeleted != 1 {
				t.Fatalf("successful deletes PVC=%d CR=%d", pvcsDeleted, envsDeleted)
			}
			if len(profileSlots(t, k)) != 0 {
				t.Fatal("capacity was not released")
			}
		})
	}
}

func TestRetainedDeleteDoesNotRemoveForeignCR(t *testing.T) {
	env := lifecycleAdminEnvironment(2, []any{})
	setConditionObject(env, "Retired", true, "WorkspaceRetained", "retained")
	setConditionObject(env, "ExecutorTerminated", true, "TerminalPodProof", "proved")
	d := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), env)
	k := kubefake.NewSimpleClientset()
	store := NewStore(d, "ns", testProfiles(), nil).WithKubeClient(k)
	if err := store.DeleteRetiredEnvironment(t.Context(), adminRequestFixture()); err != nil {
		t.Fatal(err)
	}
	env, _ = d.Resource(ExecutionEnvironmentGVR).Namespace("ns").Get(t.Context(), "env", metav1.GetOptions{})
	_ = unstructured.SetNestedField(env.Object, "ReleasingSlot", "status", "lifecycleOperation", "phase")
	foreign := env.DeepCopy()
	foreign.SetUID("foreign")
	if err := d.Tracker().Update(ExecutionEnvironmentGVR, foreign, "ns"); err != nil {
		t.Fatal(err)
	}
	r := NewReconciler(d, k, "ns", testProfiles())
	t.Cleanup(r.queue.ShutDown)
	op, _, _ := unstructured.NestedMap(env.Object, "status", "lifecycleOperation")
	if err := r.reconcileRetainedDelete(t.Context(), env, op, "workspace", "pvc-uid"); err == nil {
		t.Fatal("foreign CR did not conflict")
	}
	got, err := d.Resource(ExecutionEnvironmentGVR).Namespace("ns").Get(t.Context(), "env", metav1.GetOptions{})
	if err != nil || got.GetUID() != "foreign" || !contains(got.GetFinalizers(), environmentFinalizer) {
		t.Fatal("foreign CR touched")
	}
	for _, a := range k.Actions() {
		if a.GetVerb() != "get" {
			t.Fatal("foreign CR released capacity")
		}
	}
}

func TestDirectCRDeleteStillBlocked(t *testing.T) {
	env := lifecycleAdminEnvironment(2, []any{})
	now := metav1.Now()
	env.SetDeletionTimestamp(&now)
	d := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), env)
	k := kubefake.NewSimpleClientset(retainedPVC(), terminalExecutor())
	k.PrependReactor("delete", "*", func(ktesting.Action) (bool, runtime.Object, error) {
		t.Error("direct delete destroyed runtime")
		return true, nil, apierrors.NewForbidden(schema.GroupResource{}, "", errors.New("unexpected"))
	})
	r := NewReconciler(d, k, "ns", testProfiles())
	t.Cleanup(r.queue.ShutDown)
	if err := r.Reconcile(t.Context(), "env"); err != nil {
		t.Fatal(err)
	}
	got, err := d.Resource(ExecutionEnvironmentGVR).Namespace("ns").Get(t.Context(), "env", metav1.GetOptions{})
	if err != nil || !contains(got.GetFinalizers(), environmentFinalizer) {
		t.Fatal("direct deletion lost finalizer")
	}
	if !conditionTrue(got, "DeletionBlocked") {
		t.Fatal("direct deletion not blocked")
	}
}
