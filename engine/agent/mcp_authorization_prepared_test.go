package agent_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

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
