package k8slease

import (
	"context"
	"fmt"
	"strconv"
	"time"

	coordinationv1 "k8s.io/api/coordination/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

const collectorPageSize int64 = 500

// SweepResult is the bounded, content-free observation produced by one sweep.
// It is suitable for logs and metrics: no object or session identity escapes.
type SweepResult struct {
	Cardinality int64
	Candidates  int64
	Deleted     int64
	Failures    int64
}

// Collector removes stale Kubernetes session Lease objects. The fencing
// sequencer is a different lease purpose and is never selected.
type Collector struct {
	clientset kubernetes.Interface
	namespace string
	grace     time.Duration
	clock     port.Clock
}

// NewCollector constructs a collector for one Kubernetes namespace. Negative
// grace periods are treated as zero.
func NewCollector(clientset kubernetes.Interface, namespace string, grace time.Duration, clock port.Clock) *Collector {
	if grace < 0 {
		grace = 0
	}
	return &Collector{clientset: clientset, namespace: namespace, grace: grace, clock: clock}
}

// Collector returns a collector bound to the same Kubernetes client,
// namespace, and clock as this Lease adapter.
func (l *Lease) Collector(grace time.Duration) *Collector {
	return NewCollector(l.clientset, l.namespace, grace, l.clock)
}

// Sweep lists session Leases in bounded pages and deletes stale candidates
// using a fresh read plus UID/resourceVersion preconditions. Sweeps inspect
// only v2 managed session objects; legacy objects remain as a finite migration
// baseline because deleting them while a legacy writer may still exist could
// reset that writer's leaseTransitions fencing history.
func (c *Collector) Sweep(ctx context.Context) (SweepResult, error) {
	var result SweepResult
	var firstErr error
	recordFailure := func(err error) {
		result.Failures++
		if firstErr == nil {
			firstErr = err
		}
	}

	selector := labels.Set{
		managedByLabel:    managedByValue,
		leasePurposeLabel: sessionPurposeValue,
	}.AsSelector().String()

	leases := c.clientset.CoordinationV1().Leases(c.namespace)
	now := c.clock.Now()
	continueToken := ""
	for {
		if err := ctx.Err(); err != nil {
			recordFailure(err)
			break
		}
		page, err := leases.List(ctx, metav1.ListOptions{
			LabelSelector: selector,
			Limit:         collectorPageSize,
			Continue:      continueToken,
		})
		if err != nil {
			recordFailure(fmt.Errorf("k8slease: collector list: %w", err))
			break
		}
		for i := range page.Items {
			if err := ctx.Err(); err != nil {
				recordFailure(err)
				break
			}
			result.Cardinality++
			candidate, deleted, err := c.collectOne(ctx, &page.Items[i], now)
			if err != nil {
				recordFailure(err)
			}
			if candidate {
				result.Candidates++
			}
			if deleted {
				result.Deleted++
			}
		}
		if ctx.Err() != nil || page.Continue == "" {
			break
		}
		continueToken = page.Continue
	}

	if firstErr != nil {
		return result, fmt.Errorf("k8slease: collector sweep: %d failure(s): %w", result.Failures, firstErr)
	}
	return result, nil
}

func (c *Collector) collectOne(ctx context.Context, listed *coordinationv1.Lease, now time.Time) (candidate, deleted bool, err error) {
	if !collectorIdentity(listed) {
		return false, false, fmt.Errorf("k8slease: collector found malformed managed lease %q", listed.Name)
	}
	if !collectorStateValid(listed) {
		return false, false, fmt.Errorf("k8slease: collector found malformed state for managed lease %q", listed.Name)
	}
	if !c.stale(listed, now) {
		return false, false, nil
	}

	leases := c.clientset.CoordinationV1().Leases(c.namespace)
	current, err := leases.Get(ctx, listed.Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return true, false, nil
	}
	if err != nil {
		return true, false, fmt.Errorf("k8slease: collector re-read: %w", err)
	}
	if !collectorIdentity(current) || !collectorStateValid(current) || !c.stale(current, now) {
		return true, false, nil
	}

	uid := current.UID
	rv := current.ResourceVersion
	err = leases.Delete(ctx, current.Name, metav1.DeleteOptions{Preconditions: &metav1.Preconditions{
		UID:             &uid,
		ResourceVersion: &rv,
	}})
	if apierrors.IsNotFound(err) || apierrors.IsConflict(err) {
		return true, false, nil
	}
	if err != nil {
		return true, false, fmt.Errorf("k8slease: collector delete: %w", err)
	}
	return true, true, nil
}

// collectorIdentity reports whether obj is a v2 object whose session identity
// recomputes to its exact Kubernetes object name.
func collectorIdentity(obj *coordinationv1.Lease) bool {
	managed := obj.Labels[managedByLabel] == managedByValue &&
		obj.Labels[leasePurposeLabel] == sessionPurposeValue
	if !managed || obj.Labels[leaseSchemaLabel] != leaseSchemaValue {
		return false
	}
	id, ok := obj.Annotations[rawIDAnnotation]
	return ok && objectName(session.SessionID(id)) == obj.Name
}

func collectorStateValid(obj *coordinationv1.Lease) bool {
	id := session.SessionID(obj.Annotations[rawIDAnnotation])
	if _, err := inspectObject(obj, id); err == nil {
		return true
	}
	// V2 normally deletes on Release, but an interrupted migration or older
	// domain-aware writer can leave a labelled empty-holder tombstone. Accept
	// only its complete, parseable granted-state shape.
	if derefStr(obj.Spec.HolderIdentity) != "" || obj.Annotations[provisionalAnnotation] != "" ||
		obj.Spec.RenewTime == nil || obj.Spec.LeaseDurationSeconds == nil || *obj.Spec.LeaseDurationSeconds <= 0 ||
		obj.Spec.LeaseTransitions == nil || *obj.Spec.LeaseTransitions < 0 {
		return false
	}
	token, err := strconv.ParseUint(obj.Annotations[fencingTokenAnnotation], 10, 64)
	return err == nil && token != 0
}

func (c *Collector) stale(obj *coordinationv1.Lease, now time.Time) bool {
	if obj.Annotations[provisionalAnnotation] != provisionalValue && derefStr(obj.Spec.HolderIdentity) == "" {
		return true
	}
	expires := expiryOf(obj)
	return !expires.IsZero() && !now.Before(expires.Add(c.grace))
}
