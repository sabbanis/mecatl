package agent_test

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

// TestInvariant_mcp_authorization_parking_behavior_matrix enumerates every
// unattended engine/run capability combination. Only a top-level run with an
// explicitly attached authorization presenter may retain a broker transaction.
func TestInvariant_mcp_authorization_parking_behavior_matrix(t *testing.T) {
	for _, tc := range []struct {
		name         string
		role         string
		presentation bool
		parks        bool
	}{
		{name: "main-presenter", presentation: true, parks: true},
		{name: "main-unattended"},
		{name: "child-presenter", role: "subagent", presentation: true},
		{name: "child-unattended", role: "subagent"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			protected := &authorizationTool{
				fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true},
				request:  tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
			}
			e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`))), Catalog: catalogWith(t, protected), Role: tc.role, Interactive: tc.presentation, Store: memstore.New()})
			sess := newSession(t, session.Limits{})
			events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: tc.presentation}))
			parked := sess.State == session.StateAuthorizing
			if parked != tc.parks {
				t.Fatalf("parked = %v, want %v (requests=%d, state=%s, events=%v)", parked, tc.parks, protected.calls, sess.State, typesOf(events))
			}
			for _, event := range events {
				if event.Type == session.EvMCPAuthorizationRequired && !tc.parks {
					t.Fatal("unattended path emitted broker authorization request")
				}
			}
		})
	}
}
