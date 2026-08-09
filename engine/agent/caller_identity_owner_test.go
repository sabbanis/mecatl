package agent

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memfs"
	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

// ownerAlice and ownerBob are the two principals the child-inheritance test
// uses. They differ in BOTH halves of the identity pair, so an assertion that
// compares only `sub` still distinguishes them.
var (
	ownerAlice = &session.Principal{Issuer: "https://idp.example/alice-realm", Subject: "alice", GrantType: session.GrantTypeUser, Name: "Alice"}
	ownerBob   = &session.Principal{Issuer: "https://idp.example/bob-realm", Subject: "bob", GrantType: session.GrantTypeUser, Name: "Bob"}
)

// TestCallerIdentity_Scenario3_ForkInheritsSourceOwner pins the engine half of
// AC3.3: a `subagent-`/`parallel-`/`team-` child session inherits the PARENT
// session's owner — the source's, not the calling goroutine's. The context this
// run is driven under carries a DIFFERENT principal (Bob), so a child that
// picked its owner off the ambient context instead of the parent aggregate
// fails here: that is exactly the laundering path the AC forbids. An OWNERLESS
// parent yields an OWNERLESS child — never fabricated, never rejected (the
// no-auth path must keep working).
//
// The service half (a forked session inheriting the source session's owner) is
// pinned by the same-named test in internal/adapter/server.
func TestCallerIdentity_Scenario3_ForkInheritsSourceOwner(t *testing.T) {
	for _, tc := range []struct {
		name        string
		parentOwner *session.Principal
	}{
		{"owned parent", ownerAlice},
		{"ownerless parent", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := memstore.New()
			allow := permpolicy.NewPolicy(permpolicy.AllowAllFloorRules(), nil)
			childEngine := NewEngine(Deps{
				LLM: mockllm.New(mockllm.TextTurn("child done")), Catalog: tool.NewCatalog(),
				Policy: allow, Model: "child-model",
			})
			cat := tool.NewCatalog()
			cat.MustRegister(NewSubagentTool(childEngine, WithSubagentStore(store)))

			parentLLM := mockllm.New(
				mockllm.ToolCallTurn(session.NewToolCall("p1", "Subagent", json.RawMessage(`{"prompt":"investigate"}`))),
				mockllm.TextTurn("parent done"),
			)
			e := NewEngine(Deps{LLM: parentLLM, Catalog: cat, Policy: allow, Model: "parent-model"})

			sess := session.New("owner-parent", session.ModeDefault, "/ws", session.Limits{}, time.Unix(0, 0))
			if err := sess.RestoreLabels(tc.parentOwner, ""); err != nil {
				t.Fatalf("RestoreLabels: %v", err)
			}

			// The run is driven under a context carrying BOB — a different
			// principal from the parent session's owner.
			ctx := session.WithPrincipal(context.Background(), ownerBob)
			r := e.Run(ctx, sess, memfs.NewWorkspace("/ws"), "go")
			drainRunEvents(t, r)

			child, err := store.Load(context.Background(), "subagent-p1")
			if err != nil || child == nil {
				t.Fatalf("child must be persisted: %v", err)
			}
			switch {
			case tc.parentOwner == nil:
				if child.Owner != nil {
					t.Fatalf("ownerless parent produced child owned by %+v, want nil (never fabricated, never the caller's)", *child.Owner)
				}
			case child.Owner == nil:
				t.Fatalf("child owner = nil, want the PARENT's owner %+v", *tc.parentOwner)
			case *child.Owner != *tc.parentOwner:
				t.Fatalf("child owner = %+v, want the PARENT's owner %+v (a child must not be attributed to the calling goroutine)", *child.Owner, *tc.parentOwner)
			}
		})
	}
}

// drainRunEvents drains a run to completion with a deadline, so a wedge fails
// the test instead of hanging it.
func drainRunEvents(t *testing.T, r *Run) {
	t.Helper()
	deadline := time.After(15 * time.Second)
	for {
		select {
		case _, ok := <-r.Events():
			if !ok {
				return
			}
		case <-deadline:
			r.Cancel()
			t.Fatal("run did not terminate (possible wedge)")
		}
	}
}
