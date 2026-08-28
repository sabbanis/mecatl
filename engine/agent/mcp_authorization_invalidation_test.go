package agent_test

// This file deliberately contains only the failure-mode pin. The broker
// authorization request is malformed (no expiry), causing the aggregate's
// parking transition to fail after the broker transaction has started.

import (
	"context"
	"testing"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

func TestInvariant_mcp_authorization_invalidation_is_fail_closed(t *testing.T) {
	cancelled := 0
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("protected tool executed after parking invalidation")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "exact-transaction", Backend: "protected"},
		cancel: func(_ context.Context, id string) error {
			if id != "exact-transaction" {
				t.Fatalf("cancelled transaction = %q, want exact-transaction", id)
			}
			cancelled++
			return nil
		},
	}
	e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`))), Catalog: catalogWith(t, protected)})
	sess := newSession(t, session.Limits{})
	events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if cancelled != 1 || sess.State == session.StateAuthorizing {
		t.Fatalf("cancellations/state = %d/%s, want 1/non-authorizing", cancelled, sess.State)
	}
	for _, event := range events {
		if event.Type == session.EvMCPAuthorizationRequired {
			t.Fatal("invalid parking emitted authorization-required event")
		}
	}
}
