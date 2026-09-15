package k8slease

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	coordinationv1 "k8s.io/api/coordination/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/stacklok/mecatl/engine/session"
)

type collectorClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *collectorClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func TestCollectorAcquireAndRenewRacesDefeatDelete(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	for _, tc := range []struct {
		name   string
		holder string
	}{
		{name: "renew", holder: "owner-a"},
		{name: "takeover acquire", holder: "owner-b"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			stale := collectorLease("race", now.Add(-time.Hour), "owner-a", false)
			client := fake.NewSimpleClientset(stale)
			client.PrependReactor("get", "leases", func(_ k8stesting.Action) (bool, runtime.Object, error) {
				live := stale.DeepCopy()
				live.ResourceVersion = "2"
				live.Spec.HolderIdentity = ptr(tc.holder)
				*live.Spec.LeaseTransitions = 1
				delete(live.Annotations, provisionalAnnotation)
				live.Annotations[fencingTokenAnnotation] = "2147483649"
				renewed := metav1.NewMicroTime(now)
				live.Spec.RenewTime = &renewed
				return true, live, nil
			})

			result, err := NewCollector(client, testNamespace, time.Minute, &collectorClock{now: now}).Sweep(context.Background())
			if err != nil {
				t.Fatalf("Sweep: %v", err)
			}
			if result.Cardinality != 1 || result.Candidates != 1 || result.Deleted != 0 || result.Failures != 0 {
				t.Fatalf("Sweep result = %+v, want one candidate skipped after fresh read", result)
			}
			if deleteActions(client.Actions()) != 0 {
				t.Fatal("collector attempted Delete after a concurrent grant refreshed the Lease")
			}
		})
	}
}

func TestCollectorUsesGraceForProvisionalAndExpiredGrants(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	grace := time.Minute
	objects := []*coordinationv1.Lease{
		collectorLease("live", now, "owner", false),
		collectorLease("expired-in-grace", now.Add(-45*time.Second), "owner", false),
		collectorLease("expired-stale", now.Add(-2*time.Minute), "owner", false),
		collectorLease("provisional-in-grace", now.Add(-45*time.Second), "", true),
		collectorLease("provisional-stale", now.Add(-2*time.Minute), "", true),
		collectorLease("released-tombstone", now, "", false),
	}
	seed := make([]runtime.Object, len(objects))
	for i := range objects {
		seed[i] = objects[i]
	}
	client := fake.NewSimpleClientset(seed...)

	result, err := NewCollector(client, testNamespace, grace, &collectorClock{now: now}).Sweep(context.Background())
	if err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if result.Cardinality != 6 || result.Candidates != 3 || result.Deleted != 3 || result.Failures != 0 {
		t.Fatalf("Sweep result = %+v, want stale grant, stale provisional, and tombstone deleted", result)
	}
	for _, id := range []session.SessionID{"live", "expired-in-grace", "provisional-in-grace"} {
		if _, err := client.CoordinationV1().Leases(testNamespace).Get(context.Background(), objectName(id), metav1.GetOptions{}); err != nil {
			t.Errorf("Lease %q inside grace was deleted: %v", id, err)
		}
	}
}

func TestCollectorDeleteConflictIsBenignAndPreconditioned(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	obj := collectorLease("delete-race", now.Add(-time.Hour), "owner-a", false)
	client := fake.NewSimpleClientset(obj.DeepCopy())
	client.PrependReactor("delete", "leases", func(action k8stesting.Action) (bool, runtime.Object, error) {
		deleteAction := action.(k8stesting.DeleteAction)
		pre := deleteAction.GetDeleteOptions().Preconditions
		if pre == nil || pre.UID == nil || *pre.UID != obj.UID || pre.ResourceVersion == nil || *pre.ResourceVersion != obj.ResourceVersion {
			t.Fatalf("Delete preconditions = %+v, want UID %q and resourceVersion %q", pre, obj.UID, obj.ResourceVersion)
		}
		return true, nil, apierrors.NewConflict(coordinationv1.Resource("leases"), obj.Name, errors.New("successor won"))
	})

	result, err := NewCollector(client, testNamespace, 0, &collectorClock{now: now}).Sweep(context.Background())
	if err != nil {
		t.Fatalf("Sweep conflict: %v", err)
	}
	if result.Cardinality != 1 || result.Candidates != 1 || result.Deleted != 0 || result.Failures != 0 {
		t.Fatalf("Sweep result = %+v, want benign lost delete race", result)
	}
}

func TestCollectorLeavesLegacyObjectsForLegacyWriters(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	valid := legacyCollectorLease("valid-legacy", now.Add(-time.Hour))
	wrongName := legacyCollectorLease("wrong-name", now.Add(-time.Hour))
	wrongName.Name = objectName("somebody-else")
	foreign := legacyCollectorLease("foreign", now.Add(-time.Hour))
	foreign.Labels = map[string]string{managedByLabel: "another-controller"}
	withoutIdentity := legacyCollectorLease("no-identity", now.Add(-time.Hour))
	delete(withoutIdentity.Annotations, rawIDAnnotation)

	client := fake.NewSimpleClientset(valid.DeepCopy(), wrongName, foreign, withoutIdentity)
	result, err := NewCollector(client, testNamespace, 0, &collectorClock{now: now}).Sweep(context.Background())
	if err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if result != (SweepResult{}) {
		t.Fatalf("Sweep result = %+v, want no legacy objects considered", result)
	}
	for _, obj := range []*coordinationv1.Lease{valid, wrongName, foreign, withoutIdentity} {
		if _, err := client.CoordinationV1().Leases(testNamespace).Get(context.Background(), obj.Name, metav1.GetOptions{}); err != nil {
			t.Fatalf("legacy object %q was removed: %v", obj.Name, err)
		}
	}
}

func TestCollectorFollowsPaginatedLists(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	first := collectorLease("page-one", now.Add(-time.Hour), "", false)
	second := collectorLease("page-two", now.Add(-time.Hour), "", false)
	client := fake.NewSimpleClientset(first.DeepCopy(), second.DeepCopy())
	var listOptions []metav1.ListOptions
	client.PrependReactor("list", "leases", func(action k8stesting.Action) (bool, runtime.Object, error) {
		withOptions, ok := action.(interface{ GetListOptions() metav1.ListOptions })
		if !ok {
			t.Fatalf("list action %T does not expose options", action)
		}
		opts := withOptions.GetListOptions()
		listOptions = append(listOptions, opts)
		if opts.Continue == "" {
			return true, &coordinationv1.LeaseList{
				ListMeta: metav1.ListMeta{Continue: "page-2"},
				Items:    []coordinationv1.Lease{*first.DeepCopy()},
			}, nil
		}
		if opts.Continue != "page-2" {
			return true, nil, fmt.Errorf("unexpected continue token %q", opts.Continue)
		}
		return true, &coordinationv1.LeaseList{Items: []coordinationv1.Lease{*second.DeepCopy()}}, nil
	})

	result, err := NewCollector(client, testNamespace, 0, &collectorClock{now: now}).Sweep(context.Background())
	if err != nil {
		t.Fatalf("Sweep: %v", err)
	}
	if result.Cardinality != 2 || result.Candidates != 2 || result.Deleted != 2 || result.Failures != 0 {
		t.Fatalf("Sweep result = %+v, want both pages deleted", result)
	}
	if len(listOptions) != 2 || listOptions[0].Limit != collectorPageSize || listOptions[1].Continue != "page-2" {
		t.Fatalf("list options = %+v, want bounded page followed by continuation", listOptions)
	}
}

func TestCollectorContinuesAfterPartialDeleteFailure(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	goodA := collectorLease("good-a", now.Add(-time.Hour), "", false)
	bad := collectorLease("bad", now.Add(-time.Hour), "", false)
	goodB := collectorLease("good-b", now.Add(-time.Hour), "", false)
	client := fake.NewSimpleClientset(goodA.DeepCopy(), bad.DeepCopy(), goodB.DeepCopy())
	client.PrependReactor("delete", "leases", func(action k8stesting.Action) (bool, runtime.Object, error) {
		if action.(k8stesting.DeleteAction).GetName() == bad.Name {
			return true, nil, errors.New("injected delete failure")
		}
		return false, nil, nil
	})

	result, err := NewCollector(client, testNamespace, 0, &collectorClock{now: now}).Sweep(context.Background())
	if err == nil || !strings.Contains(err.Error(), "1 failure(s)") {
		t.Fatalf("Sweep error = %v, want aggregate partial failure", err)
	}
	if result.Cardinality != 3 || result.Candidates != 3 || result.Deleted != 2 || result.Failures != 1 {
		t.Fatalf("Sweep result = %+v, want two deletes and one failure", result)
	}
	if _, getErr := client.CoordinationV1().Leases(testNamespace).Get(context.Background(), bad.Name, metav1.GetOptions{}); getErr != nil {
		t.Fatalf("failed object was not retained: %v", getErr)
	}
}

func TestCollectorReportsMalformedManagedLease(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	malformed := collectorLease("malformed-managed", now.Add(-time.Hour), "", false)
	malformed.Labels[leaseSchemaLabel] = "unexpected"
	client := fake.NewSimpleClientset(malformed.DeepCopy())

	result, err := NewCollector(client, testNamespace, 0, &collectorClock{now: now}).Sweep(context.Background())
	if err == nil || !strings.Contains(err.Error(), "malformed managed lease") {
		t.Fatalf("Sweep error = %v, want malformed managed lease", err)
	}
	if result.Cardinality != 1 || result.Candidates != 0 || result.Deleted != 0 || result.Failures != 1 {
		t.Fatalf("Sweep result = %+v, want one visible validation failure", result)
	}
}

func TestCollectorCancellationStopsSweep(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	obj := collectorLease("cancel", now.Add(-time.Hour), "", false)
	client := fake.NewSimpleClientset(obj.DeepCopy())
	ctx, cancel := context.WithCancel(context.Background())
	client.PrependReactor("get", "leases", func(k8stesting.Action) (bool, runtime.Object, error) {
		cancel()
		return true, nil, context.Canceled
	})

	result, err := NewCollector(client, testNamespace, 0, &collectorClock{now: now}).Sweep(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Sweep error = %v, want context.Canceled", err)
	}
	if result.Deleted != 0 || result.Failures != 1 {
		t.Fatalf("Sweep result = %+v, want cancellation failure and no delete", result)
	}
	if deleteActions(client.Actions()) != 0 {
		t.Fatal("collector attempted Delete after cancellation")
	}
}

func collectorLease(id session.SessionID, renewed time.Time, holder string, provisional bool) *coordinationv1.Lease {
	duration := int32(30)
	transitions := int32(1)
	micro := metav1.NewMicroTime(renewed)
	annotations := map[string]string{rawIDAnnotation: string(id)}
	if provisional {
		annotations[provisionalAnnotation] = provisionalValue
		transitions = 0
	} else {
		annotations[fencingTokenAnnotation] = "2147483649"
	}
	return &coordinationv1.Lease{
		ObjectMeta: metav1.ObjectMeta{
			Name:            objectName(id),
			Namespace:       testNamespace,
			UID:             types.UID("uid-" + id),
			ResourceVersion: "1",
			Labels: map[string]string{
				managedByLabel:    managedByValue,
				leasePurposeLabel: sessionPurposeValue,
				leaseSchemaLabel:  leaseSchemaValue,
			},
			Annotations: annotations,
		},
		Spec: coordinationv1.LeaseSpec{
			HolderIdentity:       ptr(holder),
			LeaseDurationSeconds: &duration,
			RenewTime:            &micro,
			LeaseTransitions:     &transitions,
		},
	}
}

func legacyCollectorLease(id session.SessionID, renewed time.Time) *coordinationv1.Lease {
	obj := collectorLease(id, renewed, "", false)
	obj.Labels = nil
	delete(obj.Annotations, fencingTokenAnnotation)
	return obj
}

func deleteActions(actions []k8stesting.Action) int {
	var count int
	for _, action := range actions {
		if action.GetVerb() == "delete" {
			count++
		}
	}
	return count
}

func ptr[T any](value T) *T { return &value }
