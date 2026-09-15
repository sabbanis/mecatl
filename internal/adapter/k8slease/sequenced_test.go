package k8slease

import (
	"context"
	"errors"
	"math"
	"strconv"
	"strings"
	"testing"
	"time"

	coordinationv1 "k8s.io/api/coordination/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

func newSequencedLease(t *testing.T, objects ...runtime.Object) (*Lease, *fake.Clientset, *fakeClock) {
	t.Helper()
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	seed := []runtime.Object{sequenceConfigMap(strconv.FormatUint(uint64(math.MaxInt32), 10))}
	seed = append(seed, objects...)
	cs := fake.NewSimpleClientset(seed...)
	return New(cs, testNamespace, 30*time.Second, clk, WithSequencer(DefaultSequencerName)), cs, clk
}

func sequenceConfigMap(value string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: DefaultSequencerName, Namespace: testNamespace},
		Data:       map[string]string{sequenceDataKey: value},
	}
}

func TestSequencedLease_RecreationUsesStrictlyGreaterToken(t *testing.T) {
	ctx := context.Background()
	l, cs, _ := newSequencedLease(t)

	first, err := l.Acquire(ctx, "recreated", "owner-a")
	if err != nil {
		t.Fatalf("first Acquire: %v", err)
	}
	if first.Token != uint64(math.MaxInt32)+1 {
		t.Fatalf("first token = %d, want %d", first.Token, uint64(math.MaxInt32)+1)
	}
	obj, err := cs.CoordinationV1().Leases(testNamespace).Get(ctx, objectName("recreated"), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get granted object: %v", err)
	}
	if obj.Labels[managedByLabel] != managedByValue || obj.Labels[leasePurposeLabel] != sessionPurposeValue || obj.Labels[leaseSchemaLabel] != leaseSchemaValue {
		t.Fatalf("granted labels = %#v", obj.Labels)
	}
	if obj.Annotations[fencingTokenAnnotation] != strconv.FormatUint(first.Token, 10) {
		t.Fatalf("token annotation = %q, want %d", obj.Annotations[fencingTokenAnnotation], first.Token)
	}
	if _, ok := obj.Annotations[provisionalAnnotation]; ok {
		t.Fatal("granted object retained provisional annotation")
	}

	if err := l.Release(ctx, first); err != nil {
		t.Fatalf("Release: %v", err)
	}
	if _, err := cs.CoordinationV1().Leases(testNamespace).Get(ctx, objectName("recreated"), metav1.GetOptions{}); !apierrors.IsNotFound(err) {
		t.Fatalf("released object still exists: %v", err)
	}
	second, err := l.Acquire(ctx, "recreated", "owner-b")
	if err != nil {
		t.Fatalf("second Acquire: %v", err)
	}
	if second.Token <= first.Token {
		t.Fatalf("recreated token = %d, want > %d", second.Token, first.Token)
	}
}

func TestSequencedLease_CreatePrecedesAllocationAndProvisionalCanBeCompleted(t *testing.T) {
	ctx := context.Background()
	l, cs, _ := newSequencedLease(t)
	held, err := l.Acquire(ctx, "ordered", "owner-a")
	if err != nil {
		t.Fatalf("Acquire: %v", err)
	}

	var createLease, updateSequence, updateLease int
	for i, action := range cs.Actions() {
		switch {
		case action.GetVerb() == "create" && action.GetResource().Resource == "leases":
			createLease = i + 1
		case action.GetVerb() == "update" && action.GetResource().Resource == "configmaps":
			updateSequence = i + 1
		case action.GetVerb() == "update" && action.GetResource().Resource == "leases":
			updateLease = i + 1
		}
	}
	if createLease == 0 || updateSequence == 0 || updateLease == 0 || createLease >= updateSequence || updateSequence >= updateLease {
		t.Fatalf("action order create=%d sequence=%d grant=%d; want provisional Create before allocation before grant", createLease, updateSequence, updateLease)
	}

	// A provisional left by a crashed creator is claimable without another
	// Create. This is the recovery half of the two-step ABA defense.
	if err := l.Release(ctx, held); err != nil {
		t.Fatalf("Release: %v", err)
	}
	provisional, err := l.createProvisional(ctx, "abandoned", l.clock.Now())
	if err != nil {
		t.Fatalf("create provisional: %v", err)
	}
	if provisional.Annotations[provisionalAnnotation] != provisionalValue {
		t.Fatal("fixture is not provisional")
	}
	actionCount := len(cs.Actions())
	completed, err := l.Acquire(ctx, "abandoned", "owner-b")
	if err != nil {
		t.Fatalf("complete provisional: %v", err)
	}
	if completed.Owner != "owner-b" || completed.Token <= held.Token {
		t.Fatalf("completed provisional = %+v, previous token %d", completed, held.Token)
	}
	for _, action := range cs.Actions()[actionCount:] {
		if action.GetVerb() == "create" && action.GetResource().Resource == "leases" {
			t.Fatal("completing an existing provisional issued another Create")
		}
	}
}

func TestSequencedLease_DelayedProvisionalGrantCannotOverwriteSuccessor(t *testing.T) {
	ctx := context.Background()
	l, cs, now := newSequencedLease(t)
	stale, err := l.createProvisional(ctx, "aba", now.Now())
	if err != nil {
		t.Fatalf("create stale provisional: %v", err)
	}
	stale.UID = types.UID("old-uid")
	stale.ResourceVersion = "old-rv"
	if _, err := cs.CoordinationV1().Leases(testNamespace).Update(ctx, stale, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("stamp stale provisional: %v", err)
	}
	first, err := l.Acquire(ctx, "aba", "owner-b")
	if err != nil {
		t.Fatalf("complete first provisional: %v", err)
	}
	if err := l.Release(ctx, first); err != nil {
		t.Fatalf("release first grant: %v", err)
	}
	successor, err := l.Acquire(ctx, "aba", "owner-c")
	if err != nil {
		t.Fatalf("create successor: %v", err)
	}
	current, err := cs.CoordinationV1().Leases(testNamespace).Get(ctx, objectName("aba"), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get successor: %v", err)
	}
	current.UID = types.UID("new-uid")
	current.ResourceVersion = "new-rv"
	if _, err := cs.CoordinationV1().Leases(testNamespace).Update(ctx, current, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("stamp successor: %v", err)
	}

	gvr := schema.GroupVersionResource{Group: "coordination.k8s.io", Version: "v1", Resource: "leases"}
	cs.PrependReactor("update", "leases", func(action k8stesting.Action) (bool, runtime.Object, error) {
		candidate := action.(k8stesting.UpdateAction).GetObject().(*coordinationv1.Lease)
		if candidate.UID == types.UID("old-uid") {
			return true, nil, apierrors.NewConflict(gvr.GroupResource(), candidate.Name, errors.New("stale provisional"))
		}
		return false, nil, nil
	})
	_, err = l.takeover(ctx, "aba", stale, "owner-a", now.Now(), 1)
	if !errors.Is(err, port.ErrLeaseHeld) {
		t.Fatalf("delayed provisional grant = %v, want ErrLeaseHeld", err)
	}
	if _, err := l.Renew(ctx, successor); err != nil {
		t.Fatalf("successor was damaged by delayed grant: %v", err)
	}
}

func TestSequencer_FailsClosedOnMissingCorruptOrExhaustedState(t *testing.T) {
	tests := []struct {
		name      string
		configMap *corev1.ConfigMap
		want      string
	}{
		{name: "missing", want: "is missing"},
		{name: "missing key", configMap: &corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: DefaultSequencerName, Namespace: testNamespace}}, want: "missing data key"},
		{name: "malformed", configMap: sequenceConfigMap("not-a-number"), want: "malformed"},
		{name: "below legacy floor", configMap: sequenceConfigMap("7"), want: "below the legacy-token floor"},
		{name: "exhausted", configMap: sequenceConfigMap(strconv.FormatUint(math.MaxUint64, 10)), want: "exhausted"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var objects []runtime.Object
			if tt.configMap != nil {
				objects = append(objects, tt.configMap)
			}
			cs := fake.NewSimpleClientset(objects...)
			clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
			l := New(cs, testNamespace, 30*time.Second, clk, WithSequencer(DefaultSequencerName))
			_, err := l.Acquire(context.Background(), session.SessionID("fail-closed"), "owner")
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("Acquire error = %v, want containing %q", err, tt.want)
			}
			obj, getErr := cs.CoordinationV1().Leases(testNamespace).Get(context.Background(), objectName("fail-closed"), metav1.GetOptions{})
			if getErr != nil {
				t.Fatalf("provisional disappeared after allocation failure: %v", getErr)
			}
			if derefStr(obj.Spec.HolderIdentity) != "" || obj.Annotations[provisionalAnnotation] != provisionalValue {
				t.Fatalf("allocation failure granted malformed object: %#v", obj)
			}
		})
	}
}

func TestSequencer_RetriesResourceVersionConflict(t *testing.T) {
	cs := fake.NewSimpleClientset(sequenceConfigMap(strconv.FormatUint(uint64(math.MaxInt32), 10)))
	conflicts := 0
	gvr := schema.GroupVersionResource{Version: "v1", Resource: "configmaps"}
	cs.PrependReactor("update", "configmaps", func(_ k8stesting.Action) (bool, runtime.Object, error) {
		if conflicts == 0 {
			conflicts++
			return true, nil, apierrors.NewConflict(gvr.GroupResource(), DefaultSequencerName, errors.New("racing allocator"))
		}
		return false, nil, nil
	})
	seq := sequencer{configMaps: cs.CoreV1().ConfigMaps(testNamespace), name: DefaultSequencerName}
	got, err := seq.next(context.Background())
	if err != nil {
		t.Fatalf("next after conflict: %v", err)
	}
	if got != uint64(math.MaxInt32)+1 || conflicts != 1 {
		t.Fatalf("next = %d, conflicts = %d; want %d and one retry", got, conflicts, uint64(math.MaxInt32)+1)
	}
}

func TestSequencedLease_ReleasePreconditionCannotDeleteSuccessor(t *testing.T) {
	ctx := context.Background()
	l, cs, _ := newSequencedLease(t)
	held, err := l.Acquire(ctx, "release-race", "owner-a")
	if err != nil {
		t.Fatalf("Acquire: %v", err)
	}
	obj, err := cs.CoordinationV1().Leases(testNamespace).Get(ctx, objectName("release-race"), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get held object: %v", err)
	}
	obj.UID = types.UID("old-uid")
	obj.ResourceVersion = "old-rv"
	if _, err := cs.CoordinationV1().Leases(testNamespace).Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
		t.Fatalf("stamp held object: %v", err)
	}

	deleteChecked := false
	gvr := schema.GroupVersionResource{Group: "coordination.k8s.io", Version: "v1", Resource: "leases"}
	cs.PrependReactor("delete", "leases", func(action k8stesting.Action) (bool, runtime.Object, error) {
		deleteAction := action.(k8stesting.DeleteAction)
		pre := deleteAction.GetDeleteOptions().Preconditions
		if pre == nil || pre.UID == nil || *pre.UID != types.UID("old-uid") || pre.ResourceVersion == nil || *pre.ResourceVersion != "old-rv" {
			t.Fatalf("Delete preconditions = %#v, want old UID/resourceVersion", pre)
		}
		deleteChecked = true
		return true, nil, apierrors.NewConflict(gvr.GroupResource(), deleteAction.GetName(), errors.New("successor replaced object"))
	})
	if err := l.Release(ctx, held); err != nil {
		t.Fatalf("Release after successor race: %v", err)
	}
	if !deleteChecked {
		t.Fatal("Release did not issue a preconditioned Delete")
	}
	if _, err := cs.CoordinationV1().Leases(testNamespace).Get(ctx, obj.Name, metav1.GetOptions{}); err != nil {
		t.Fatalf("conflicted Release removed current object: %v", err)
	}
}

func TestSequencedLease_LegacyObjectUpgradesWithoutTokenRegression(t *testing.T) {
	ctx := context.Background()
	now := time.Unix(1_700_000_000, 0)
	holder := "legacy-owner"
	duration := int32(30)
	transitions := int32(7)
	renewed := metav1.NewMicroTime(now)
	legacy := &coordinationv1.Lease{
		ObjectMeta: metav1.ObjectMeta{
			Name:        objectName("legacy-upgrade"),
			Namespace:   testNamespace,
			Annotations: map[string]string{rawIDAnnotation: "legacy-upgrade"},
		},
		Spec: coordinationv1.LeaseSpec{
			HolderIdentity:       &holder,
			LeaseDurationSeconds: &duration,
			RenewTime:            &renewed,
			LeaseTransitions:     &transitions,
		},
	}
	l, cs, _ := newSequencedLease(t, legacy)
	refreshed, err := l.Acquire(ctx, "legacy-upgrade", holder)
	if err != nil {
		t.Fatalf("same-owner legacy Acquire: %v", err)
	}
	if refreshed.Token != 7 {
		t.Fatalf("legacy refresh token = %d, want 7", refreshed.Token)
	}
	upgraded, err := cs.CoordinationV1().Leases(testNamespace).Get(ctx, legacy.Name, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get upgraded object: %v", err)
	}
	if upgraded.Labels[leaseSchemaLabel] != leaseSchemaValue || upgraded.Annotations[fencingTokenAnnotation] != "7" {
		t.Fatalf("upgraded metadata labels=%#v annotations=%#v", upgraded.Labels, upgraded.Annotations)
	}
	sequence, err := cs.CoreV1().ConfigMaps(testNamespace).Get(ctx, DefaultSequencerName, metav1.GetOptions{})
	if err != nil {
		t.Fatalf("get sequence after legacy refresh: %v", err)
	}
	if got := sequence.Data[sequenceDataKey]; got != strconv.FormatUint(uint64(math.MaxInt32), 10) {
		t.Fatalf("same-owner legacy refresh allocated token; sequence = %q", got)
	}
	if err := l.Release(ctx, refreshed); err != nil {
		t.Fatalf("release upgraded legacy grant: %v", err)
	}
	recreated, err := l.Acquire(ctx, "legacy-upgrade", "new-owner")
	if err != nil {
		t.Fatalf("recreate legacy object: %v", err)
	}
	if recreated.Token <= refreshed.Token || recreated.Token <= uint64(math.MaxInt32) {
		t.Fatalf("recreated token = %d, want > legacy token %d and legacy floor", recreated.Token, refreshed.Token)
	}
}

func TestSequencedLease_ResetSequencerCannotRegressExistingToken(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	existing := collectorLease("reset-guard", now.Add(-time.Hour), "old-owner", false)
	existing.Annotations[fencingTokenAnnotation] = strconv.FormatUint(uint64(math.MaxInt32)+2, 10)
	l, _, _ := newSequencedLease(t, existing)

	_, err := l.Acquire(context.Background(), "reset-guard", "new-owner")
	if err == nil || !strings.Contains(err.Error(), "does not exceed existing token") {
		t.Fatalf("Acquire after sequencer reset = %v, want token-regression error", err)
	}
}

func TestSequencedLease_MalformedOwnedObjectsFailClosed(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	holder := "owner"
	duration := int32(30)
	transitions := int32(1)
	renewed := metav1.NewMicroTime(now)
	base := &coordinationv1.Lease{
		ObjectMeta: metav1.ObjectMeta{
			Name:        objectName("malformed"),
			Namespace:   testNamespace,
			Labels:      v2Labels(),
			Annotations: map[string]string{rawIDAnnotation: "malformed", fencingTokenAnnotation: "2147483648"},
		},
		Spec: coordinationv1.LeaseSpec{
			HolderIdentity:       &holder,
			LeaseDurationSeconds: &duration,
			RenewTime:            &renewed,
			LeaseTransitions:     &transitions,
		},
	}
	tests := map[string]func(*coordinationv1.Lease){
		"wrong identity":        func(obj *coordinationv1.Lease) { obj.Annotations[rawIDAnnotation] = "other" },
		"partial ownership":     func(obj *coordinationv1.Lease) { delete(obj.Labels, leaseSchemaLabel) },
		"malformed token":       func(obj *coordinationv1.Lease) { obj.Annotations[fencingTokenAnnotation] = "NaN" },
		"zero token":            func(obj *coordinationv1.Lease) { obj.Annotations[fencingTokenAnnotation] = "0" },
		"ambiguous provisional": func(obj *coordinationv1.Lease) { obj.Annotations[provisionalAnnotation] = provisionalValue },
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			obj := base.DeepCopy()
			mutate(obj)
			l, _, _ := newSequencedLease(t, obj)
			if _, err := l.Acquire(context.Background(), "malformed", "owner"); err == nil {
				t.Fatal("Acquire succeeded for malformed owned object")
			}
		})
	}
}
