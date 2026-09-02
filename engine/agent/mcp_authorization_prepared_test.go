package agent_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestPreparedMCPAuthorizationContinuation_StartGatesExecution(t *testing.T) {
	var executed atomic.Int32
	protected := &fakeTool{name: "mcp__protected__read", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		executed.Add(1)
		return session.NewToolResult(call.ID, "ok"), nil
	}}
	engine := newEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("done")), Catalog: catalogWith(t, protected)})
	sess := newSession(t, session.Limits{})
	call := session.NewToolCall("call", protected.Spec().Name, nil)
	if err := sess.BeginTurn(); err != nil {
		t.Fatalf("BeginTurn: %v", err)
	}
	if err := sess.RecordAssistant(session.NewAssistantMessage("", "", []session.ToolCall{call})); err != nil {
		t.Fatalf("RecordAssistant: %v", err)
	}
	if err := sess.PauseForMCPAuthorization(session.PendingMCPAuthorization{AuthorizationID: "authorization", Backend: "protected", RouteID: protected.Spec().Name, ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour), Call: call, Deferred: []session.ToolCall{}}); err != nil {
		t.Fatalf("PauseForMCPAuthorization: %v", err)
	}
	pending, err := sess.ClaimMCPAuthorization()
	if err != nil {
		t.Fatalf("ClaimMCPAuthorization: %v", err)
	}

	prepared := engine.PrepareMCPAuthorizationContinuation(context.Background(), sess, agent.MemEnv("/ws"), pending)
	if got := executed.Load(); got != 0 {
		t.Fatalf("execution before Start = %d, want 0", got)
	}
	drain(prepared.Start())
	if got := executed.Load(); got != 1 {
		t.Fatalf("execution after Start = %d, want 1", got)
	}
}

func TestPreparedMCPAuthorizationContinuation_AfterResolutionStartGatesLoop(t *testing.T) {
	engine := newEngine(agent.Deps{LLM: mockllm.New(mockllm.TextTurn("continued")), Catalog: catalogWith(t)})
	sess := newSession(t, session.Limits{})
	if err := sess.BeginTurn(); err != nil {
		t.Fatalf("BeginTurn: %v", err)
	}
	if err := sess.RecordAssistant(session.NewAssistantMessage("", "", nil)); err != nil {
		t.Fatalf("RecordAssistant: %v", err)
	}

	prepared := engine.PrepareAfterMCPAuthorization(context.Background(), sess, agent.MemEnv("/ws"))
	select {
	case <-prepared.Run().Events():
		t.Fatal("continuation emitted before Start")
	default:
	}
	drain(prepared.Start())
	if sess.State != session.StateCompleted {
		t.Fatalf("state after Start = %q, want completed", sess.State)
	}
}

// TestPreparedMCPAuthorizationContinuation_SecondProtectedCallCanPark pins a bug a
// live qualification run found: the model's first protected call resolves and
// executes fine on resume (it runs the already-authorized pending call directly,
// never re-checking AuthorizationPresentation), but a SECOND, different protected
// call the model decides to make within that SAME continued run used to hard-fail
// at postPreToolUse's "no interactive client attached" gate, because
// PrepareAfterMCPAuthorization built its continuation's RunRequest with
// AuthorizationPresentation left at its zero value (false). No prior test caught
// this because none had the continuation itself attempt a further protected call.
func TestPreparedMCPAuthorizationContinuation_SecondProtectedCallCanPark(t *testing.T) {
	second := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__second", readOnly: true},
		request:  tool.AuthorizationRequest{ID: "second-request", Backend: "protected", RouteID: "mcp__protected__second", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	engine := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(session.NewToolCall("call-2", second.Spec().Name, nil))), Catalog: catalogWith(t, second), Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	if err := sess.BeginTurn(); err != nil {
		t.Fatalf("BeginTurn: %v", err)
	}
	if err := sess.RecordAssistant(session.NewAssistantMessage("", "", nil)); err != nil {
		t.Fatalf("RecordAssistant: %v", err)
	}

	run := engine.PrepareAfterMCPAuthorization(context.Background(), sess, agent.MemEnv("/ws")).Start()
	for _, event := range drain(run) {
		if event.Type == session.EvToolResult && event.ToolResult != nil && event.ToolResult.IsError {
			t.Fatalf("second protected call hard-failed instead of parking: %s", event.ToolResult.Content)
		}
	}
	if sess.State != session.StateAuthorizing {
		t.Fatalf("state after second protected call = %q, want authorizing (parked)", sess.State)
	}
	if second.calls != 1 {
		t.Fatalf("RequestAuthorization calls = %d, want 1", second.calls)
	}
}
