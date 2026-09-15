package k8slease

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	coordinationv1 "k8s.io/api/coordination/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/stacklok/mecatl/engine/adapter/leaseconformance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
)

const (
	testNamespace = "mecatl"
	testDomain    = "release-a"
)

// fakeClock is an advanceable port.Clock to cross the TTL without real sleeps.
type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

func newFakeLease(t *testing.T) (*Lease, *fakeClock) {
	t.Helper()
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	cs := fake.NewSimpleClientset()
	return mustNewLease(t, cs, testNamespace, testDomain, 30*time.Second, clk), clk
}

func mustNewLease(t *testing.T, cs *fake.Clientset, namespace, domain string, ttl time.Duration, clk port.Clock) *Lease {
	t.Helper()
	l, err := New(cs, namespace, domain, ttl, clk)
	if err != nil {
		t.Fatalf("New(domain=%q): %v", domain, err)
	}
	return l
}

// TestObjectNameEncoding pins Open Risk #2: arbitrary, long, and
// delegation-prefixed session ids all encode to a valid RFC-1123 Lease name
// (≤253 chars, lowercase-alnum-and-dash), and the encoding is collision-free
// (distinct ids → distinct names).
func TestObjectNameEncoding(t *testing.T) {
	ids := []session.SessionID{
		"simple",
		"With Spaces And UPPER",
		"team-abc123/member-1",
		"subagent-deadbeef-0",
		"parallel-callid-3",
		session.SessionID(strings.Repeat("x", 4096)),
		"unicode-héllo-世界",
		"",
	}
	for _, domain := range []string{"", testDomain, "release.with.dots"} {
		seen := map[string]session.SessionID{}
		for _, id := range ids {
			name := objectName(domain, id)
			if len(name) != 53 {
				t.Errorf("objectName(%q, %q) length = %d, want 53", domain, id, len(name))
			}
			if problems := validation.IsDNS1123Subdomain(name); len(problems) != 0 {
				t.Errorf("objectName(%q, %q) = %q is not a valid DNS-1123 subdomain: %v", domain, id, name, problems)
			}
			if prev, dup := seen[name]; dup {
				t.Errorf("collision in domain %q: %q and %q both encode to %q", domain, id, prev, name)
			}
			seen[name] = id
		}
	}
	// Same id is stable across calls.
	if a, b := objectName(testDomain, "stable"), objectName(testDomain, "stable"); a != b {
		t.Errorf("objectName not stable: %q vs %q", a, b)
	}
	// Empty domain preserves the exact pre-domain object key.
	const legacyStable = "mecatl-lease-f379ccb92b9116442dc65bdc35648a85d3786b34"
	if got := objectName("", "stable"); got != legacyStable {
		t.Errorf("legacy objectName = %q, want %q", got, legacyStable)
	}
	const domainStable = "mecatl-lease-b1d7fac844be5e91dc95a198381438a9ae8b670b"
	if got := objectName(testDomain, "stable"); got != domainStable {
		t.Errorf("domain objectName = %q, want versioned tuple hash %q", got, domainStable)
	}
	if objectName("release-a", "same") == objectName("release-b", "same") {
		t.Fatal("equal session IDs in distinct domains produced the same object name")
	}
}

func TestValidateDomain(t *testing.T) {
	maxDomain := strings.Repeat("a", 63) + "." + strings.Repeat("b", 63) + "." +
		strings.Repeat("c", 63) + "." + strings.Repeat("d", 61)
	for _, domain := range []string{"", "release-a", "release.with.dots", maxDomain} {
		if err := ValidateDomain(domain); err != nil {
			t.Errorf("ValidateDomain(%q): %v", domain, err)
		}
	}

	for _, domain := range []string{
		"Release-A",
		"release_a",
		"-release",
		"release-",
		maxDomain + "e",
		"release\x00a",
	} {
		if err := ValidateDomain(domain); err == nil {
			t.Errorf("ValidateDomain(%q) succeeded, want error", domain)
		}
		clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
		if _, err := New(fake.NewSimpleClientset(), testNamespace, domain, 30*time.Second, clk); err == nil {
			t.Errorf("New(domain=%q) succeeded, want error", domain)
		}
	}
}

func TestDomainsIsolateSessionAndSchedulerKeys(t *testing.T) {
	ctx := context.Background()
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	cs := fake.NewSimpleClientset()
	a := mustNewLease(t, cs, testNamespace, "release-a", 30*time.Second, clk)
	b := mustNewLease(t, cs, testNamespace, "release-b", 30*time.Second, clk)

	for _, id := range []session.SessionID{"same-session", port.SchedulerLeaderLeaseID} {
		t.Run(string(id), func(t *testing.T) {
			heldA, err := a.Acquire(ctx, id, "owner-a")
			if err != nil {
				t.Fatalf("domain A Acquire: %v", err)
			}
			heldB, err := b.Acquire(ctx, id, "owner-b")
			if err != nil {
				t.Fatalf("domain B Acquire: %v", err)
			}

			objA := getK8sLease(t, cs, "release-a", id)
			objB := getK8sLease(t, cs, "release-b", id)
			if objA.Name == objB.Name {
				t.Fatalf("domains addressed the same object %q", objA.Name)
			}
			if objA.Annotations[rawDomainAnnotation] != "release-a" || objB.Annotations[rawDomainAnnotation] != "release-b" {
				t.Fatalf("domain annotations = A:%q B:%q", objA.Annotations[rawDomainAnnotation], objB.Annotations[rawDomainAnnotation])
			}

			beforeB := objB.DeepCopy()
			clk.advance(time.Second)
			heldA, err = a.Renew(ctx, heldA)
			if err != nil {
				t.Fatalf("domain A Renew: %v", err)
			}
			if err := a.Release(ctx, heldA); err != nil {
				t.Fatalf("domain A Release: %v", err)
			}
			afterB := getK8sLease(t, cs, "release-b", id)
			if !reflect.DeepEqual(afterB, beforeB) {
				t.Fatalf("domain A mutation changed domain B object\nbefore: %#v\nafter:  %#v", beforeB, afterB)
			}

			if _, err := b.Renew(ctx, heldB); err != nil {
				t.Fatalf("domain B Renew after A release: %v", err)
			}
			if err := b.Release(ctx, heldB); err != nil {
				t.Fatalf("domain B Release: %v", err)
			}
		})
	}
}

func TestDomainDoesNotBridgeLegacyIdentity(t *testing.T) {
	ctx := context.Background()
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	cs := fake.NewSimpleClientset()
	legacy := mustNewLease(t, cs, testNamespace, "", 30*time.Second, clk)
	domain := mustNewLease(t, cs, testNamespace, testDomain, 30*time.Second, clk)

	if _, err := legacy.Acquire(ctx, "same-session", "legacy-owner"); err != nil {
		t.Fatalf("legacy Acquire: %v", err)
	}
	if _, err := domain.Acquire(ctx, "same-session", "domain-owner"); err != nil {
		t.Fatalf("domain Acquire while legacy object is live: %v", err)
	}
	if objectName("", "same-session") == objectName(testDomain, "same-session") {
		t.Fatal("legacy and domain configurations addressed the same object")
	}
}

func TestQuiescentCutoverStartsAndRetainsDomainHistory(t *testing.T) {
	ctx := context.Background()
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	cs := fake.NewSimpleClientset()
	legacy := mustNewLease(t, cs, testNamespace, "", 30*time.Second, clk)
	if _, err := legacy.Acquire(ctx, "cutover", "legacy-owner"); err != nil {
		t.Fatalf("legacy Acquire: %v", err)
	}
	legacyBefore := getK8sLease(t, cs, "", "cutover").DeepCopy()

	// The operator has terminated every old pod and waited the old Lease TTL.
	clk.advance(31 * time.Second)
	firstAdapter := mustNewLease(t, cs, testNamespace, testDomain, 30*time.Second, clk)
	first, err := firstAdapter.Acquire(ctx, "cutover", "domain-owner-a")
	if err != nil {
		t.Fatalf("domain Acquire after quiescence: %v", err)
	}
	if first.Token != 1 {
		t.Fatalf("first domain token = %d, want independent history at 1", first.Token)
	}
	if legacyAfter := getK8sLease(t, cs, "", "cutover"); !reflect.DeepEqual(legacyAfter, legacyBefore) {
		t.Fatalf("domain cutover mutated legacy object\nbefore: %#v\nafter:  %#v", legacyBefore, legacyAfter)
	}

	if err := firstAdapter.Release(ctx, first); err != nil {
		t.Fatalf("domain Release: %v", err)
	}
	restarted := mustNewLease(t, cs, testNamespace, testDomain, 30*time.Second, clk)
	second, err := restarted.Acquire(ctx, "cutover", "domain-owner-b")
	if err != nil {
		t.Fatalf("Acquire after domain-aware restart: %v", err)
	}
	if second.Token <= first.Token {
		t.Fatalf("token after domain-aware restart = %d, want greater than %d", second.Token, first.Token)
	}
}

func TestDomainAnnotationMismatchFailsClosed(t *testing.T) {
	mutations := map[string]func(map[string]string){
		"missing session id": func(a map[string]string) { delete(a, rawIDAnnotation) },
		"wrong session id":   func(a map[string]string) { a[rawIDAnnotation] = "other-session" },
		"missing domain":     func(a map[string]string) { delete(a, rawDomainAnnotation) },
		"wrong domain":       func(a map[string]string) { a[rawDomainAnnotation] = "release-b" },
	}
	operations := map[string]func(context.Context, *Lease, port.Lease) error{
		"acquire": func(ctx context.Context, l *Lease, held port.Lease) error {
			_, err := l.Acquire(ctx, held.SessionID, held.Owner)
			return err
		},
		"renew": func(ctx context.Context, l *Lease, held port.Lease) error {
			_, err := l.Renew(ctx, held)
			return err
		},
		"release": func(ctx context.Context, l *Lease, held port.Lease) error {
			return l.Release(ctx, held)
		},
	}

	for mutationName, mutate := range mutations {
		for operationName, operate := range operations {
			t.Run(mutationName+"/"+operationName, func(t *testing.T) {
				ctx := context.Background()
				clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
				cs := fake.NewSimpleClientset()
				l := mustNewLease(t, cs, testNamespace, testDomain, 30*time.Second, clk)
				held, err := l.Acquire(ctx, "corrupt", "owner-a")
				if err != nil {
					t.Fatalf("seed Acquire: %v", err)
				}

				obj := getK8sLease(t, cs, testDomain, held.SessionID)
				mutate(obj.Annotations)
				if _, err := cs.CoordinationV1().Leases(testNamespace).Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
					t.Fatalf("corrupt object: %v", err)
				}
				before := getK8sLease(t, cs, testDomain, held.SessionID)
				if err := operate(ctx, l, held); err == nil || !strings.Contains(err.Error(), "identity annotations") {
					t.Fatalf("operation error = %v, want identity-annotation error", err)
				}
				after := getK8sLease(t, cs, testDomain, held.SessionID)
				if !reflect.DeepEqual(after, before) {
					t.Fatalf("failed operation mutated object\nbefore: %#v\nafter:  %#v", before, after)
				}
			})
		}
	}
}

func TestLegacyModeRetainsAnnotationRepair(t *testing.T) {
	operations := map[string]func(context.Context, *Lease, port.Lease) error{
		"acquire": func(ctx context.Context, l *Lease, held port.Lease) error {
			_, err := l.Acquire(ctx, held.SessionID, held.Owner)
			return err
		},
		"renew": func(ctx context.Context, l *Lease, held port.Lease) error {
			_, err := l.Renew(ctx, held)
			return err
		},
		"release": func(ctx context.Context, l *Lease, held port.Lease) error {
			return l.Release(ctx, held)
		},
	}

	for name, operate := range operations {
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
			cs := fake.NewSimpleClientset()
			l := mustNewLease(t, cs, testNamespace, "", 30*time.Second, clk)
			held, err := l.Acquire(ctx, "legacy", "owner-a")
			if err != nil {
				t.Fatalf("seed Acquire: %v", err)
			}
			obj := getK8sLease(t, cs, "", held.SessionID)
			delete(obj.Annotations, rawIDAnnotation)
			if _, err := cs.CoordinationV1().Leases(testNamespace).Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
				t.Fatalf("remove legacy annotation: %v", err)
			}

			if err := operate(ctx, l, held); err != nil {
				t.Fatalf("legacy %s with missing raw-id annotation: %v", name, err)
			}
			after := getK8sLease(t, cs, "", held.SessionID)
			if got := after.Annotations[rawIDAnnotation]; got != string(held.SessionID) {
				t.Fatalf("repaired raw-id annotation = %q, want %q", got, held.SessionID)
			}
			if _, ok := after.Annotations[rawDomainAnnotation]; ok {
				t.Fatal("legacy operation added a domain annotation")
			}
		})
	}
}

func getK8sLease(t *testing.T, cs *fake.Clientset, domain string, id session.SessionID) *coordinationv1.Lease {
	t.Helper()
	obj, err := cs.CoordinationV1().Leases(testNamespace).Get(context.Background(), objectName(domain, id), metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Get lease object: %v", err)
	}
	return obj
}

// TestFakeNonConflictSubset exercises the contract paths the fake clientset CAN
// honour. The fake's ObjectTracker does NOT enforce resourceVersion CAS on Update
// (Open Risk #1, VERIFIED: a stale Update succeeds with no 409), so the
// CAS-conflict path is covered separately in TestUpdateConflictIsLeaseHeld via a
// PrependReactor; here we cover everything that turns on holder/expiry logic.
func TestFakeNonConflictSubset(t *testing.T) {
	ctx := context.Background()

	t.Run("acquire fresh creates the object", func(t *testing.T) {
		l, _ := newFakeLease(t)
		lease, err := l.Acquire(ctx, "fresh", "owner-a")
		if err != nil {
			t.Fatalf("Acquire: %v", err)
		}
		if lease.Owner != "owner-a" || lease.Token != 1 || lease.Expiry.IsZero() {
			t.Fatalf("Acquire returned %+v, want owner-a, token 1, non-zero expiry", lease)
		}
	})

	t.Run("contend by a live different owner fails", func(t *testing.T) {
		l, _ := newFakeLease(t)
		if _, err := l.Acquire(ctx, "contend", "owner-a"); err != nil {
			t.Fatalf("Acquire by A: %v", err)
		}
		_, err := l.Acquire(ctx, "contend", "owner-b")
		if !errors.Is(err, port.ErrLeaseHeld) {
			t.Fatalf("Acquire by B = %v, want ErrLeaseHeld", err)
		}
	})

	t.Run("same owner re-acquire keeps the token", func(t *testing.T) {
		l, _ := newFakeLease(t)
		first, err := l.Acquire(ctx, "reacq", "owner-a")
		if err != nil {
			t.Fatalf("Acquire #1: %v", err)
		}
		second, err := l.Acquire(ctx, "reacq", "owner-a")
		if err != nil {
			t.Fatalf("Acquire #2: %v", err)
		}
		if second.Token != first.Token {
			t.Errorf("same-owner re-acquire token = %d, want %d", second.Token, first.Token)
		}
	})

	t.Run("renew within window keeps token, extends expiry", func(t *testing.T) {
		l, clk := newFakeLease(t)
		first, err := l.Acquire(ctx, "renew", "owner-a")
		if err != nil {
			t.Fatalf("Acquire: %v", err)
		}
		clk.advance(10 * time.Second)
		renewed, err := l.Renew(ctx, first)
		if err != nil {
			t.Fatalf("Renew: %v", err)
		}
		if renewed.Token != first.Token {
			t.Errorf("Renew token = %d, want %d", renewed.Token, first.Token)
		}
		if !renewed.Expiry.After(first.Expiry) {
			t.Errorf("Renew expiry = %v, want after %v", renewed.Expiry, first.Expiry)
		}
	})

	t.Run("expiry takeover bumps the token", func(t *testing.T) {
		l, clk := newFakeLease(t)
		first, err := l.Acquire(ctx, "expire", "owner-a")
		if err != nil {
			t.Fatalf("Acquire by A: %v", err)
		}
		clk.advance(31 * time.Second) // past TTL
		second, err := l.Acquire(ctx, "expire", "owner-b")
		if err != nil {
			t.Fatalf("Acquire by B after expiry: %v", err)
		}
		if second.Token <= first.Token {
			t.Errorf("expiry-takeover token = %d, want strictly > %d", second.Token, first.Token)
		}
		if second.Owner != "owner-b" {
			t.Errorf("holder after takeover = %q, want owner-b", second.Owner)
		}
	})

	t.Run("renew after expiry-and-takeover is lost", func(t *testing.T) {
		l, clk := newFakeLease(t)
		first, err := l.Acquire(ctx, "lost", "owner-a")
		if err != nil {
			t.Fatalf("Acquire by A: %v", err)
		}
		clk.advance(31 * time.Second)
		if _, err := l.Acquire(ctx, "lost", "owner-b"); err != nil {
			t.Fatalf("takeover by B: %v", err)
		}
		_, err = l.Renew(ctx, first)
		if !errors.Is(err, port.ErrLeaseHeld) {
			t.Fatalf("Renew of a lost lease = %v, want ErrLeaseHeld", err)
		}
	})

	t.Run("release frees the lease and is idempotent", func(t *testing.T) {
		l, _ := newFakeLease(t)
		held, err := l.Acquire(ctx, "rel", "owner-a")
		if err != nil {
			t.Fatalf("Acquire: %v", err)
		}
		if err := l.Release(ctx, held); err != nil {
			t.Fatalf("Release: %v", err)
		}
		if err := l.Release(ctx, held); err != nil {
			t.Fatalf("Release #2 (idempotent): %v", err)
		}
		if _, err := l.Acquire(ctx, "rel", "owner-b"); err != nil {
			t.Fatalf("Acquire after Release by other owner: %v", err)
		}
	})

	t.Run("release of a non-owned lease is a no-op", func(t *testing.T) {
		l, _ := newFakeLease(t)
		if _, err := l.Acquire(ctx, "noown", "owner-a"); err != nil {
			t.Fatalf("Acquire by A: %v", err)
		}
		// owner-b releasing must NOT drop A's hold.
		if err := l.Release(ctx, port.Lease{SessionID: "noown", Owner: "owner-b", Token: 1}); err != nil {
			t.Fatalf("Release by non-owner: %v", err)
		}
		_, err := l.Acquire(ctx, "noown", "owner-c")
		if !errors.Is(err, port.ErrLeaseHeld) {
			t.Fatalf("A's hold should survive a non-owner Release; Acquire by C = %v, want ErrLeaseHeld", err)
		}
	})

	t.Run("distinct sessions lease independently", func(t *testing.T) {
		l, _ := newFakeLease(t)
		if _, err := l.Acquire(ctx, "multi-a", "owner-a"); err != nil {
			t.Fatalf("Acquire a: %v", err)
		}
		if _, err := l.Acquire(ctx, "multi-b", "owner-b"); err != nil {
			t.Fatalf("Acquire b: %v", err)
		}
	})
}

// TestLeaseConformance runs the shared leaseconformance suite over k8slease —
// the SAME suite memlease, flocklease, the grpcdriver client, and memstore pass.
// This is the contract-unification entry: when the shared suite adds an
// assertion, k8slease gets it automatically. The suite pins the port.SessionLease
// contract (Acquire/Renew/Release/Expiry semantics), NOT the CAS-conflict path:
// the fake clientset's ObjectTracker does not enforce resourceVersion CAS on
// Update (Open Risk #1), so the "double acquire by another owner" case passes
// via the holder-check path (Get returns the live object → ErrLeaseHeld), not a
// 409. The CAS-conflict path is covered separately by TestUpdateConflictIsLeaseHeld
// (PrependReactor → 409 → ErrLeaseHeld); the hand-written TestFakeNonConflictSubset
// stays as harmless extra k8slease-specific coverage (e.g. non-owner Release is a
// no-op).
func TestLeaseConformance(t *testing.T) {
	leaseconformance.Run(t, func(t *testing.T) (port.SessionLease, func(time.Duration)) {
		clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
		cs := fake.NewSimpleClientset()
		return mustNewLease(t, cs, testNamespace, testDomain, leaseconformance.TTL, clk), clk.advance
	})
}

// TestUpdateConflictIsLeaseHeld covers Open Risk #1: the fake clientset does not
// enforce resourceVersion CAS, so the 409-Conflict-on-takeover path is exercised
// with a PrependReactor that returns apierrors.NewConflict on the Update verb.
// A concurrent takeover that loses the CAS race must surface as ErrLeaseHeld, not
// a hard error. (A real cluster / envtest enforces the CAS natively; that path is
// NOT in CI — documented gap.)
func TestUpdateConflictIsLeaseHeld(t *testing.T) {
	ctx := context.Background()
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	cs := fake.NewSimpleClientset()

	// Seed an EXPIRED lease held by owner-a so the takeover path runs an Update.
	l := mustNewLease(t, cs, testNamespace, testDomain, 30*time.Second, clk)
	if _, err := l.Acquire(ctx, "conflict", "owner-a"); err != nil {
		t.Fatalf("seed Acquire: %v", err)
	}
	clk.advance(31 * time.Second) // expire it so owner-b's Acquire takes the Update branch.

	gvr := schema.GroupVersionResource{Group: "coordination.k8s.io", Version: "v1", Resource: "leases"}
	cs.PrependReactor("update", "leases", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewConflict(gvr.GroupResource(), "mecatl-lease-conflict", errors.New("the object has been modified"))
	})

	_, err := l.Acquire(ctx, "conflict", "owner-b")
	if !errors.Is(err, port.ErrLeaseHeld) {
		t.Fatalf("Acquire with a 409 Conflict = %v, want ErrLeaseHeld", err)
	}
}
