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

func TestInvariant_mcp_authorization_continuation_exactly_once(t *testing.T) {
	var executed atomic.Int32
	order := []string{}
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__read", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
			executed.Add(1)
			order = append(order, "execute")
			return session.NewToolResult(call.ID, "ok"), nil
		}},
		request: tool.AuthorizationRequest{ID: "authorization", Backend: "safe", RouteID: "mcp__protected__read", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
		order:   &order,
	}
	hooks := &authorizationObservationHook{}
	engine := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("call", protected.name, `{}`)), mockllm.TextTurn("done")), Catalog: catalogWith(t, protected), Policy: orderedAuthorizationPolicy{order: &order}, Hooks: hooks, Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	drain(engine.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if sess.State != session.StateAuthorizing {
		t.Fatalf("park state = %s, want authorizing", sess.State)
	}
	pending, ok := sess.PendingMCPAuthorization()
	if !ok {
		t.Fatal("pending authorization missing")
	}
	if _, err := sess.ClaimMCPAuthorization(); err != nil {
		t.Fatalf("ClaimMCPAuthorization: %v", err)
	}
	drain(engine.ContinueMCPAuthorization(context.Background(), sess, agent.MemEnv("/ws"), pending))
	if got := executed.Load(); got != 1 {
		t.Fatalf("protected executions = %d, want 1", got)
	}
	if got := hooks.post.Load(); got != 1 {
		t.Fatalf("PostToolUse calls = %d, want 1", got)
	}
	if got, want := len(order), 3; got != want || order[0] != "permission" || order[1] != "broker" || order[2] != "execute" {
		t.Fatalf("gate order = %v, want permission/broker/execute", order)
	}
}
