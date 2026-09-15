// Package k8slease is the Kubernetes-backed port.SessionLease: cross-process,
// cross-HOST single-writer enforcement for the multi-replica cloud-native
// posture (ADR 0027 Phase 4), backed by a coordination.k8s.io/v1 Lease object
// per session id. It is the multi-host story the single-host flock lease cannot
// give: an API-server-coordinated lease survives a replica moving between nodes.
//
// It is BUILT but UNWIRED by default: composition constructs it ONLY when an
// operator selects it with --session-lease-k8s-namespace, so the default path is
// byte-identical with no lease. k8slease never returns ErrLeaseUnsupported — it
// is a fully-supporting adapter; an RBAC Forbidden surfaces as a hard
// infrastructure error (the operator fixed the wrong thing), not a sticky
// disable.
//
// Object naming: a session id is arbitrary text (a team/subagent id, a UUID, a
// user string) and need not be a valid RFC-1123 object name, so the Lease object
// is named "mecatl-lease-" + hex(sha256(id))[:40] — always ≤253 chars, always
// RFC-1123-valid, and collision-free (one-way hash). The raw id is preserved in
// an annotation for operators eyeballing `kubectl get leases`.
//
// Fencing: the default constructor retains the legacy leaseTransitions token
// and tombstone behavior. WithSequencer enables collectible v2 objects: a
// namespace-scoped ConfigMap allocates durable uint64 tokens, recorded on each
// Lease annotation. Missing objects are first created as ungranted provisionals,
// then granted with a CAS Update. That two-step path prevents a delayed Create
// from resurrecting a token older than a Lease which was created and deleted
// while the caller was stalled.
//
// RBAC: v2 calls Get/Create/Update/Delete on Leases and Get/Update on its
// pre-provisioned ConfigMap. It never creates or deletes sequencer state.
package k8slease

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strconv"
	"time"

	coordinationv1 "k8s.io/api/coordination/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

// objectNamePrefix prefixes every Lease object name; the rest is the id hash.
const objectNamePrefix = "mecatl-lease-"

// rawIDAnnotation preserves the un-hashed session id for operator visibility.
const rawIDAnnotation = "mecatl.stacklok.com/session-id"

const (
	managedByLabel         = "app.kubernetes.io/managed-by"
	managedByValue         = "mecatl"
	leasePurposeLabel      = "mecatl.stacklok.com/lease-purpose"
	sessionPurposeValue    = "session"
	leaseSchemaLabel       = "mecatl.stacklok.com/lease-schema"
	leaseSchemaValue       = "v2"
	fencingTokenAnnotation = "mecatl.stacklok.com/fencing-token" // #nosec G101 -- Kubernetes metadata key, not a credential.
	provisionalAnnotation  = "mecatl.stacklok.com/provisional"
	provisionalValue       = "true"
)

// Lease is a port.SessionLease over coordination.k8s.io Lease objects in one
// namespace.
type Lease struct {
	clientset kubernetes.Interface
	namespace string
	ttl       time.Duration
	clock     port.Clock
	sequencer *sequencer
}

// compile-time assertion that *Lease satisfies the port.
var _ port.SessionLease = (*Lease)(nil)

// Option configures an optional k8s Lease adapter capability.
type Option func(*Lease)

// WithSequencer enables the v2 collectible Lease protocol using the named,
// pre-provisioned ConfigMap as its durable fencing-token allocator.
func WithSequencer(name string) Option {
	return func(l *Lease) {
		l.sequencer = &sequencer{
			configMaps: l.clientset.CoreV1().ConfigMaps(l.namespace),
			name:       name,
		}
	}
}

// New constructs a k8s-backed lease over clientset in namespace, with the given
// TTL and clock. A non-positive ttl defaults to 30s. With no options it retains
// the legacy leaseTransitions/tombstone protocol.
func New(clientset kubernetes.Interface, namespace string, ttl time.Duration, clock port.Clock, options ...Option) *Lease {
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	l := &Lease{
		clientset: clientset,
		namespace: namespace,
		ttl:       ttl,
		clock:     clock,
	}
	for _, option := range options {
		option(l)
	}
	return l
}

// Acquire grants the lease when the object is absent, expired, or already held by
// owner; otherwise ErrLeaseHeld. A takeover allocates a fencing token and uses
// the read resourceVersion as a CAS guard so a concurrent takeover loses with a
// 409 Conflict → ErrLeaseHeld.
func (l *Lease) Acquire(ctx context.Context, id session.SessionID, owner string) (port.Lease, error) {
	if l.sequencer == nil {
		return l.acquireLegacy(ctx, id, owner)
	}
	now := l.clock.Now()
	leases := l.clientset.CoordinationV1().Leases(l.namespace)

	cur, err := leases.Get(ctx, objectName(id), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		cur, err = l.createProvisional(ctx, id, now)
		if apierrors.IsAlreadyExists(err) {
			return port.Lease{}, port.ErrLeaseHeld
		}
		if err != nil {
			return port.Lease{}, err
		}
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: get lease %q: %w", id, err)
	}

	state, err := inspectObject(cur, id)
	if err != nil {
		return port.Lease{}, err
	}
	if state.provisional {
		return l.takeover(ctx, id, cur, owner, now, 1)
	}
	holder := derefStr(cur.Spec.HolderIdentity)
	expired := !now.Before(expiryOf(cur))
	if !expired && holder != owner {
		return port.Lease{}, port.ErrLeaseHeld
	}
	if expired || holder != owner {
		return l.takeover(ctx, id, cur, owner, now, nextTransition(cur.Spec.LeaseTransitions))
	}
	// A live same-owner re-acquire is a refresh, never a new fencing grant.
	return l.updateLease(ctx, id, cur, owner, state.token, derefInt32(cur.Spec.LeaseTransitions), now)
}

// Renew extends a lease the caller still holds (holder + token match, unexpired),
// keeping the token and refreshing renewTime under a CAS Update. A holder change,
// a token mismatch, an expiry, or a 409 Conflict → ErrLeaseHeld (the loss signal).
func (l *Lease) Renew(ctx context.Context, in port.Lease) (port.Lease, error) {
	if l.sequencer == nil {
		return l.renewLegacy(ctx, in)
	}
	now := l.clock.Now()
	leases := l.clientset.CoordinationV1().Leases(l.namespace)

	cur, err := leases.Get(ctx, objectName(in.SessionID), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return port.Lease{}, port.ErrLeaseHeld // gone → we no longer hold it.
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: get lease %q: %w", in.SessionID, err)
	}
	state, err := inspectObject(cur, in.SessionID)
	if err != nil {
		return port.Lease{}, err
	}
	if state.provisional || derefStr(cur.Spec.HolderIdentity) != in.Owner || state.token != in.Token || !now.Before(expiryOf(cur)) {
		return port.Lease{}, port.ErrLeaseHeld
	}
	return l.updateLease(ctx, in.SessionID, cur, in.Owner, state.token, derefInt32(cur.Spec.LeaseTransitions), now)
}

// Release relinquishes a lease the caller still holds (holder + token match) by
// deleting that exact UID/resourceVersion. Fencing history remains in the
// sequencer, so recreation cannot reset the token. A stale Release cannot delete
// a successor object.
func (l *Lease) Release(ctx context.Context, in port.Lease) error {
	if l.sequencer == nil {
		return l.releaseLegacy(ctx, in)
	}
	leases := l.clientset.CoordinationV1().Leases(l.namespace)
	cur, err := leases.Get(ctx, objectName(in.SessionID), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("k8slease: get lease %q: %w", in.SessionID, err)
	}
	state, err := inspectObject(cur, in.SessionID)
	if err != nil {
		return err
	}
	if state.provisional || derefStr(cur.Spec.HolderIdentity) != in.Owner || state.token != in.Token {
		return nil // not our hold; idempotent no-op.
	}
	uid := cur.UID
	rv := cur.ResourceVersion
	if err := leases.Delete(ctx, cur.Name, metav1.DeleteOptions{Preconditions: &metav1.Preconditions{
		UID:             &uid,
		ResourceVersion: &rv,
	}}); err != nil {
		if apierrors.IsConflict(err) || apierrors.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("k8slease: delete lease %q: %w", in.SessionID, err)
	}
	return nil
}

// The legacy methods preserve the original no-option adapter byte-for-byte in
// behavior: leaseTransitions is the token and Release writes a tombstone.
func (l *Lease) acquireLegacy(ctx context.Context, id session.SessionID, owner string) (port.Lease, error) {
	now := l.clock.Now()
	leases := l.clientset.CoordinationV1().Leases(l.namespace)
	cur, err := leases.Get(ctx, objectName(id), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return l.createLegacy(ctx, id, owner, now)
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: get lease %q: %w", id, err)
	}
	holder := derefStr(cur.Spec.HolderIdentity)
	expired := !now.Before(expiryOf(cur))
	if !expired && holder != owner {
		return port.Lease{}, port.ErrLeaseHeld
	}
	token := derefInt32(cur.Spec.LeaseTransitions)
	if expired || holder != owner {
		token++
	}
	return l.updateLegacy(ctx, id, cur, owner, token, now)
}

func (l *Lease) renewLegacy(ctx context.Context, in port.Lease) (port.Lease, error) {
	now := l.clock.Now()
	leases := l.clientset.CoordinationV1().Leases(l.namespace)
	cur, err := leases.Get(ctx, objectName(in.SessionID), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return port.Lease{}, port.ErrLeaseHeld
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: get lease %q: %w", in.SessionID, err)
	}
	token := derefInt32(cur.Spec.LeaseTransitions)
	if derefStr(cur.Spec.HolderIdentity) != in.Owner || tokenToUint(token) != in.Token || !now.Before(expiryOf(cur)) {
		return port.Lease{}, port.ErrLeaseHeld
	}
	return l.updateLegacy(ctx, in.SessionID, cur, in.Owner, token, now)
}

func (l *Lease) releaseLegacy(ctx context.Context, in port.Lease) error {
	leases := l.clientset.CoordinationV1().Leases(l.namespace)
	cur, err := leases.Get(ctx, objectName(in.SessionID), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("k8slease: get lease %q: %w", in.SessionID, err)
	}
	if derefStr(cur.Spec.HolderIdentity) != in.Owner || tokenToUint(derefInt32(cur.Spec.LeaseTransitions)) != in.Token {
		return nil
	}
	now := l.clock.Now()
	token := derefInt32(cur.Spec.LeaseTransitions)
	tomb := cur.DeepCopy()
	if tomb.Annotations == nil {
		tomb.Annotations = map[string]string{}
	}
	tomb.Annotations[rawIDAnnotation] = string(in.SessionID)
	emptyHolder := ""
	tomb.Spec.HolderIdentity = &emptyHolder
	past := metav1.NewMicroTime(now.Add(-l.ttl - time.Second))
	tomb.Spec.RenewTime = &past
	tomb.Spec.LeaseTransitions = &token
	if _, err := leases.Update(ctx, tomb, metav1.UpdateOptions{}); err != nil {
		if apierrors.IsConflict(err) || apierrors.IsNotFound(err) {
			return nil
		}
		return fmt.Errorf("k8slease: tombstone lease %q: %w", in.SessionID, err)
	}
	return nil
}

func (l *Lease) createLegacy(ctx context.Context, id session.SessionID, owner string, now time.Time) (port.Lease, error) {
	micro := metav1.NewMicroTime(now)
	dur := l.durationSeconds()
	transitions := int32(1)
	obj := &coordinationv1.Lease{
		ObjectMeta: metav1.ObjectMeta{
			Name:        objectName(id),
			Namespace:   l.namespace,
			Annotations: map[string]string{rawIDAnnotation: string(id)},
		},
		Spec: coordinationv1.LeaseSpec{
			HolderIdentity:       &owner,
			LeaseDurationSeconds: &dur,
			AcquireTime:          &micro,
			RenewTime:            &micro,
			LeaseTransitions:     &transitions,
		},
	}
	created, err := l.clientset.CoordinationV1().Leases(l.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		return port.Lease{}, port.ErrLeaseHeld
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: create lease %q: %w", id, err)
	}
	return toPort(id, created, tokenToUint(transitions)), nil
}

func (l *Lease) updateLegacy(ctx context.Context, id session.SessionID, cur *coordinationv1.Lease, owner string, token int32, now time.Time) (port.Lease, error) {
	micro := metav1.NewMicroTime(now)
	dur := l.durationSeconds()
	next := cur.DeepCopy()
	if next.Annotations == nil {
		next.Annotations = map[string]string{}
	}
	next.Annotations[rawIDAnnotation] = string(id)
	next.Spec.HolderIdentity = &owner
	next.Spec.LeaseDurationSeconds = &dur
	next.Spec.RenewTime = &micro
	next.Spec.LeaseTransitions = &token
	if next.Spec.AcquireTime == nil {
		next.Spec.AcquireTime = &micro
	}
	updated, err := l.clientset.CoordinationV1().Leases(l.namespace).Update(ctx, next, metav1.UpdateOptions{})
	if apierrors.IsConflict(err) {
		return port.Lease{}, port.ErrLeaseHeld
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: update lease %q: %w", id, err)
	}
	return toPort(id, updated, tokenToUint(token)), nil
}

// createProvisional establishes a Kubernetes object identity before allocating
// a token. Granting only by Update means a delayed caller can never recreate an
// older grant after this object has been deleted.
func (l *Lease) createProvisional(ctx context.Context, id session.SessionID, now time.Time) (*coordinationv1.Lease, error) {
	micro := metav1.NewMicroTime(now)
	dur := l.durationSeconds()
	transitions := int32(0)
	emptyHolder := ""
	obj := &coordinationv1.Lease{
		ObjectMeta: metav1.ObjectMeta{
			Name:        objectName(id),
			Namespace:   l.namespace,
			Labels:      v2Labels(),
			Annotations: map[string]string{rawIDAnnotation: string(id), provisionalAnnotation: provisionalValue},
		},
		Spec: coordinationv1.LeaseSpec{
			HolderIdentity:       &emptyHolder,
			LeaseDurationSeconds: &dur,
			AcquireTime:          &micro,
			RenewTime:            &micro,
			LeaseTransitions:     &transitions,
		},
	}
	created, err := l.clientset.CoordinationV1().Leases(l.namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, err
		}
		return nil, fmt.Errorf("k8slease: create provisional lease %q: %w", id, err)
	}
	return created, nil
}

func (l *Lease) takeover(ctx context.Context, id session.SessionID, cur *coordinationv1.Lease, owner string, now time.Time, transitions int32) (port.Lease, error) {
	state, err := inspectObject(cur, id)
	if err != nil {
		return port.Lease{}, err
	}
	token, err := l.sequencer.next(ctx)
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: allocate fencing token for %q: %w", id, err)
	}
	if token <= state.token {
		return port.Lease{}, fmt.Errorf("k8slease: allocated fencing token %d does not exceed existing token %d for %q", token, state.token, id)
	}
	return l.updateLease(ctx, id, cur, owner, token, transitions, now)
}

// updateLease writes holder/token/renewTime onto cur (carrying its
// resourceVersion for the CAS) and maps a 409 Conflict onto ErrLeaseHeld.
func (l *Lease) updateLease(ctx context.Context, id session.SessionID, cur *coordinationv1.Lease, owner string, token uint64, transitions int32, now time.Time) (port.Lease, error) {
	micro := metav1.NewMicroTime(now)
	dur := l.durationSeconds()
	next := cur.DeepCopy()
	next.Labels = applyV2Labels(next.Labels)
	if next.Annotations == nil {
		next.Annotations = map[string]string{}
	}
	next.Annotations[rawIDAnnotation] = string(id)
	next.Annotations[fencingTokenAnnotation] = strconv.FormatUint(token, 10)
	delete(next.Annotations, provisionalAnnotation)
	next.Spec.HolderIdentity = &owner
	next.Spec.LeaseDurationSeconds = &dur
	next.Spec.RenewTime = &micro
	next.Spec.LeaseTransitions = &transitions
	if next.Spec.AcquireTime == nil {
		next.Spec.AcquireTime = &micro
	}
	updated, err := l.clientset.CoordinationV1().Leases(l.namespace).Update(ctx, next, metav1.UpdateOptions{})
	if apierrors.IsConflict(err) || apierrors.IsNotFound(err) {
		return port.Lease{}, port.ErrLeaseHeld // lost the CAS race.
	}
	if err != nil {
		return port.Lease{}, fmt.Errorf("k8slease: update lease %q: %w", id, err)
	}
	return toPort(id, updated, token), nil
}

// durationSeconds renders the TTL as a clamped, non-negative int32 second count
// for the Lease object's leaseDurationSeconds (the k8s field is *int32). A TTL
// beyond ~68 years clamps to the int32 max — never a realistic lease, so the
// clamp is a defensive bound rather than a live path.
func (l *Lease) durationSeconds() int32 {
	secs := int64(l.ttl / time.Second)
	if secs < 0 {
		secs = 0
	}
	if secs > math.MaxInt32 {
		secs = math.MaxInt32
	}
	return int32(secs)
}

// toPort projects a Lease object and its already-validated fencing token onto
// the port value.
func toPort(id session.SessionID, obj *coordinationv1.Lease, token uint64) port.Lease {
	return port.Lease{
		SessionID: id,
		Owner:     derefStr(obj.Spec.HolderIdentity),
		Token:     token,
		Expiry:    expiryOf(obj),
	}
}

// objectName encodes a session id into a collision-free RFC-1123 Lease name.
func objectName(id session.SessionID) string {
	sum := sha256.Sum256([]byte(id))
	return objectNamePrefix + hex.EncodeToString(sum[:])[:40]
}

// expiryOf computes a Lease's expiry: renewTime + leaseDurationSeconds. A Lease
// with no renewTime is treated as already expired (zero time).
func expiryOf(obj *coordinationv1.Lease) time.Time {
	if obj.Spec.RenewTime == nil || obj.Spec.LeaseDurationSeconds == nil {
		return time.Time{}
	}
	return obj.Spec.RenewTime.Add(time.Duration(*obj.Spec.LeaseDurationSeconds) * time.Second)
}

type objectState struct {
	token       uint64
	provisional bool
}

func inspectObject(obj *coordinationv1.Lease, id session.SessionID) (objectState, error) {
	if obj.Annotations[rawIDAnnotation] != string(id) {
		return objectState{}, fmt.Errorf("k8slease: lease object %q has a missing or mismatched session identity", obj.Name)
	}
	managed, managedOK := obj.Labels[managedByLabel]
	purpose, purposeOK := obj.Labels[leasePurposeLabel]
	schema, schemaOK := obj.Labels[leaseSchemaLabel]
	if !managedOK && !purposeOK && !schemaOK {
		return inspectLegacyObject(obj)
	}
	if !managedOK || managed != managedByValue || !purposeOK || purpose != sessionPurposeValue || !schemaOK || schema != leaseSchemaValue {
		return objectState{}, fmt.Errorf("k8slease: lease object %q has malformed ownership labels", obj.Name)
	}
	return inspectV2Object(obj)
}

func inspectLegacyObject(obj *coordinationv1.Lease) (objectState, error) {
	if _, tokenOK := obj.Annotations[fencingTokenAnnotation]; tokenOK {
		return objectState{}, fmt.Errorf("k8slease: legacy lease object %q unexpectedly has v2 state annotations", obj.Name)
	}
	if _, provisionalOK := obj.Annotations[provisionalAnnotation]; provisionalOK {
		return objectState{}, fmt.Errorf("k8slease: legacy lease object %q unexpectedly has v2 state annotations", obj.Name)
	}
	if obj.Spec.LeaseTransitions == nil || *obj.Spec.LeaseTransitions < 0 {
		return objectState{}, fmt.Errorf("k8slease: legacy lease object %q has an invalid leaseTransitions", obj.Name)
	}
	return objectState{token: uint64(*obj.Spec.LeaseTransitions)}, nil
}

func inspectV2Object(obj *coordinationv1.Lease) (objectState, error) {
	if obj.Spec.RenewTime == nil || obj.Spec.LeaseDurationSeconds == nil || *obj.Spec.LeaseDurationSeconds <= 0 || obj.Spec.LeaseTransitions == nil || *obj.Spec.LeaseTransitions < 0 {
		return objectState{}, fmt.Errorf("k8slease: owned lease object %q has malformed lease state", obj.Name)
	}
	provisional, provisionalOK := obj.Annotations[provisionalAnnotation]
	rawToken, tokenOK := obj.Annotations[fencingTokenAnnotation]
	if provisionalOK {
		if provisional != provisionalValue || tokenOK || derefStr(obj.Spec.HolderIdentity) != "" || *obj.Spec.LeaseTransitions != 0 {
			return objectState{}, fmt.Errorf("k8slease: owned lease object %q has malformed provisional state", obj.Name)
		}
		return objectState{provisional: true}, nil
	}
	if !tokenOK || derefStr(obj.Spec.HolderIdentity) == "" {
		return objectState{}, fmt.Errorf("k8slease: owned lease object %q has malformed granted state", obj.Name)
	}
	if *obj.Spec.LeaseTransitions == 0 {
		return objectState{}, fmt.Errorf("k8slease: owned lease object %q has malformed granted state", obj.Name)
	}
	token, err := strconv.ParseUint(rawToken, 10, 64)
	if err != nil {
		return objectState{}, fmt.Errorf("k8slease: owned lease object %q has malformed fencing token %q", obj.Name, rawToken)
	}
	if token == 0 {
		return objectState{}, fmt.Errorf("k8slease: owned lease object %q has zero fencing token", obj.Name)
	}
	return objectState{token: token}, nil
}

func v2Labels() map[string]string {
	return applyV2Labels(nil)
}

func applyV2Labels(labels map[string]string) map[string]string {
	if labels == nil {
		labels = make(map[string]string, 3)
	}
	labels[managedByLabel] = managedByValue
	labels[leasePurposeLabel] = sessionPurposeValue
	labels[leaseSchemaLabel] = leaseSchemaValue
	return labels
}

func nextTransition(current *int32) int32 {
	if current == nil || *current < 0 {
		return 1
	}
	if *current == math.MaxInt32 {
		return math.MaxInt32
	}
	return *current + 1
}

func tokenToUint(t int32) uint64 {
	if t < 0 {
		return 0
	}
	return uint64(t)
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func derefInt32(p *int32) int32 {
	if p == nil {
		return 0
	}
	return *p
}
