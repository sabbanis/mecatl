package app_test

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memschedulestore"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/wallclock"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
	"github.com/stacklok/mecatl/internal/adapter/scheduler"
	"github.com/stacklok/mecatl/internal/adapter/server"
	"github.com/stacklok/mecatl/internal/app"
	"github.com/stacklok/mecatl/internal/cliconfig"
	"github.com/stacklok/mecatl/internal/syscaller"
)

// observe records the context a port actually saw, from whatever goroutine the
// production wiring ran it on.
type observe func(context.Context)

// starter drives ONE registered internal goroutine root through its REAL
// production entry point, wired to a port probe that hands back the context the
// goroutine crossed the boundary with.
type starter func(t *testing.T, ctx context.Context, seen observe)

// TestCallerIdentity_Scenario2_InternalGoroutinesRunAsSystem pins AC2.2: every
// internal goroutine root runs under an EXPLICIT system principal, never an
// absent one (ADR 0100 decision 7).
//
// The set is enumerated ONCE — syscaller.Roots is the registry, and this table
// must cover it exactly. A goroutine that registers a root but forgets the wrap
// at its call site fails its subtest (its port observes a nil principal); a root
// registered with no driver here fails the coverage assertion.
func TestCallerIdentity_Scenario2_InternalGoroutinesRunAsSystem(t *testing.T) {
	t.Parallel()

	starters := map[syscaller.Root]starter{
		syscaller.RootChildGC: func(_ *testing.T, ctx context.Context, seen observe) {
			// The sweeper's first act is a store List — the port boundary.
			app.StartChildGCForTest(ctx, app.Config{ChildRetention: time.Hour},
				&probeSessionStore{Store: memstore.New(), seen: seen},
				func(session.SessionID) bool { return false })
		},
		syscaller.RootMemoryConsolidation: func(_ *testing.T, ctx context.Context, seen observe) {
			app.StartMemoryConsolidationForTest(ctx,
				app.Config{MemoryConsolidateInterval: time.Millisecond},
				probeMemoryStore{seen: seen}, nil)
		},
		syscaller.RootUserModelConsolidation: func(_ *testing.T, ctx context.Context, seen observe) {
			app.StartUserModelConsolidationForTest(ctx,
				app.Config{UserModelConsolidateInterval: time.Millisecond},
				probeMemoryStore{seen: seen}, nil)
		},
		syscaller.RootScheduler: func(t *testing.T, ctx context.Context, seen observe) {
			// tick, fire, delivery and reconcile all descend from Start's ctx;
			// the tick loop's Due poll is where that ctx first crosses a port.
			s := scheduler.New(scheduler.Config{
				Store:        &probeScheduleStore{Store: memschedulestore.New(), seen: seen},
				Clock:        wallclock.Clock{},
				TickInterval: time.Millisecond,
			})
			s.SetFire(func(context.Context, port.Schedule, time.Time) (port.ScheduleFire, error) {
				return port.ScheduleFire{}, nil
			})
			if err := s.Start(ctx); err != nil {
				t.Fatalf("scheduler.Start: %v", err)
			}
			t.Cleanup(func() { _ = s.Stop() })
		},
		syscaller.RootJWKSRefresh: func(t *testing.T, ctx context.Context, seen observe) {
			// The validator owns background key rotation, so the ctx it is
			// CONSTRUCTED with is the refresh goroutine's root.
			_, err := cliconfig.OIDCValidator(ctx, cliconfig.OIDCConfig{
				Issuer:   "https://idp.example",
				Audience: "mecatl",
				NewValidator: func(ctx context.Context, _ cliconfig.OIDCConfig) (server.PrincipalValidator, error) {
					seen(ctx)
					return probeValidator{}, nil
				},
			})
			if err != nil {
				t.Fatalf("OIDCValidator: %v", err)
			}
		},
	}

	// The registry and the table are ONE set: a new root with no driver here is
	// red, and a driver for an unregistered root is red.
	if len(starters) != len(syscaller.Roots) {
		t.Fatalf("registry/table drift: %d registered roots, %d drivers", len(syscaller.Roots), len(starters))
	}
	for _, root := range syscaller.Roots {
		if _, ok := starters[root]; !ok {
			t.Fatalf("registered root %q has no driver in this test", root)
		}
	}

	for _, root := range syscaller.Roots {
		t.Run(string(root), func(t *testing.T) {
			t.Parallel()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			// The root context carries NO principal: whatever the port sees is
			// what the production wiring stamped, nothing inherited from here.
			ch := make(chan context.Context, 1)
			starters[root](t, ctx, func(c context.Context) {
				select {
				case ch <- c:
				default:
				}
			})
			select {
			case got := <-ch:
				p := session.PrincipalFromContext(got)
				if p == nil {
					t.Fatalf("%s: port observed an ABSENT principal; the root context is not wrapped with the system principal", root)
				}
				if p.GrantType != session.GrantTypeSystem {
					t.Errorf("%s: grant type = %q, want %q", root, p.GrantType, session.GrantTypeSystem)
				}
				if p.Subject != string(root) {
					t.Errorf("%s: subject = %q, want %q (the root must stamp its OWN identity)", root, p.Subject, root)
				}
			case <-time.After(10 * time.Second):
				t.Fatalf("%s: never crossed a port boundary", root)
			}
		})
	}
}

// --- port probes: real reference adapters, wrapped to report the ctx ---------

type probeSessionStore struct {
	*memstore.Store
	seen observe
}

func (p *probeSessionStore) List(ctx context.Context) ([]port.StoredSession, error) {
	p.seen(ctx)
	return p.Store.List(ctx)
}

type probeScheduleStore struct {
	*memschedulestore.Store
	seen observe
}

func (p *probeScheduleStore) Due(ctx context.Context, now time.Time) ([]port.Schedule, error) {
	p.seen(ctx)
	return p.Store.Due(ctx, now)
}

// probeMemoryStore reports the ctx of the consolidator's first port call. The
// consolidator's List is its entry point and a 0-entry store is a no-op run, so
// no other method is ever reached.
type probeMemoryStore struct {
	tool.MemoryStore
	seen observe
}

func (p probeMemoryStore) List(ctx context.Context, _ string) ([]tool.MemoryEntry, error) {
	p.seen(ctx)
	return nil, nil
}

type probeValidator struct{}

func (probeValidator) Validate(context.Context, string) (*session.Principal, error) {
	return nil, server.ErrInvalidToken
}
