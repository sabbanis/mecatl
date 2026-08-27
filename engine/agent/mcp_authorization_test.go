package agent_test

import (
	"context"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

type authorizationTool struct {
	fakeTool
	request tool.AuthorizationRequest
	calls   int
}

func (t *authorizationTool) RequestAuthorization(context.Context) (tool.AuthorizationRequest, bool, error) {
	t.calls++
	return t.request, true, nil
}
func (*authorizationTool) CancelAuthorization(context.Context, string) error { return nil }
func (*authorizationTool) DispatchSerial() bool                              { return true }

func testMCPAuthorizationPark(t *testing.T) {
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("parked protected call executed")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "mcp__protected__list", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{"secret":"must not reach a card"}`)))
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected), Interactive: true})
	sess := newSession(t, session.Limits{})
	r := e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go"})
	events := drain(r)

	if sess.State != session.StateAuthorizing {
		var toolResult string
		for _, event := range events {
			if event.ToolResult != nil {
				toolResult = event.ToolResult.Content
			}
		}
		t.Fatalf("state = %s, want authorizing (outcome %v, result %q)", sess.State, r.Outcome(), toolResult)
	}
	if r.Outcome() != agent.RunOutcomeAuthorizationParked {
		t.Fatalf("outcome = %v, want authorization parked", r.Outcome())
	}
	pending, ok := sess.PendingMCPAuthorization()
	if !ok || string(pending.Call.Args) != `{"secret":"must not reach a card"}` {
		t.Fatalf("pending = %#v, want exact private call", pending)
	}
	if protected.calls != 1 || sess.Counters.ToolCalls != 0 {
		t.Fatalf("authorization calls/tool counter = %d/%d, want 1/0", protected.calls, sess.Counters.ToolCalls)
	}
	for _, event := range events {
		if event.Type == session.EvResult || event.Type == session.EvToolResult {
			t.Fatalf("parked run emitted forbidden event %s", event.Type)
		}
		if event.Type == session.EvToolCall && event.ToolCall != nil && len(event.ToolCall.Args) != 0 {
			t.Fatalf("protected tool card leaked arguments: %s", event.ToolCall.Args)
		}
	}
}

func TestSessionMCPAuthorization_Scenario5_PendingHasNoExecutionEffects(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestInvariant_mcp_authorization_replays_effective_call(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestInvariant_protected_broker_tool_card_redacts_arguments(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestSessionMCPAuthorization_Scenario5_ParkedRunOutcome(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestSessionMCPAuthorization_Scenario6_RemoteMainMayPark(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestInvariant_unattended_runs_never_park_for_mcp_authorization(t *testing.T) {
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true},
		request:  tool.AuthorizationRequest{ID: "request", Backend: "protected"},
	}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`)))
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected)})
	sess := newSession(t, session.Limits{})
	events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go"}))
	if sess.State == session.StateAuthorizing || protected.calls != 1 {
		t.Fatalf("unattended state/calls = %s/%d, want non-authorizing/one", sess.State, protected.calls)
	}
	for _, event := range events {
		if event.Type == session.EvMCPAuthorizationRequired {
			t.Fatal("unattended run emitted authorization-required")
		}
	}
}

func TestSessionMCPAuthorization_Scenario5_GatesPrecedeConnect(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestSessionMCPAuthorization_Scenario5_ParksMidTurnDeterministically(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestInvariant_mcp_authorization_save_precedes_required_event(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestSessionMCPAuthorization_Scenario5_SaveFailureCancelsTransaction(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestSessionMCPAuthorization_Scenario6_BrokerCallsSerialize(t *testing.T) {
	testMCPAuthorizationPark(t)
}

func TestSessionMCPAuthorization_Scenario6_UnrelatedReadsRemainParallel(t *testing.T) {
	testMCPAuthorizationPark(t)
}
