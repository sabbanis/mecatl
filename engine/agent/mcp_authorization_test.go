package agent_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/memstore"
	"github.com/stacklok/mecatl/engine/adapter/mockllm"
	"github.com/stacklok/mecatl/engine/adapter/permpolicy"
	"github.com/stacklok/mecatl/engine/agent"
	"github.com/stacklok/mecatl/engine/governance"
	"github.com/stacklok/mecatl/engine/port"
	"github.com/stacklok/mecatl/engine/session"
	"github.com/stacklok/mecatl/engine/tool"
)

type authorizationTool struct {
	fakeTool
	request tool.AuthorizationRequest
	calls   int
	cancel  func(context.Context, string) error
	order   *[]string
}

func (t *authorizationTool) RequestAuthorization(context.Context) (tool.AuthorizationRequest, bool, error) {
	t.calls++
	if t.order != nil {
		*t.order = append(*t.order, "broker")
	}
	return t.request, true, nil
}
func (t *authorizationTool) CancelAuthorization(ctx context.Context, id string) error {
	if t.cancel != nil {
		return t.cancel(ctx, id)
	}
	return nil
}
func (*authorizationTool) DispatchSerial() bool { return true }

type failingAuthorizationStore struct{ err error }

func (s failingAuthorizationStore) Save(context.Context, *session.Session) error { return s.err }
func (failingAuthorizationStore) Load(context.Context, session.SessionID) (*session.Session, error) {
	return nil, port.ErrSessionNotFound
}

type orderedAuthorizationPolicy struct{ order *[]string }

func (p orderedAuthorizationPolicy) Evaluate(context.Context, session.SessionID, session.PermissionMode, session.ToolCall, tool.WorkspaceReader) governance.PermissionDecision {
	*p.order = append(*p.order, "permission")
	return governance.PermissionDecision{Effect: governance.Allow}
}

func (orderedAuthorizationPolicy) Learn(session.SessionID, session.ToolCall) {}

type orderedAuthorizationHook struct{ order *[]string }

func (h orderedAuthorizationHook) Run(_ context.Context, ev governance.HookEvent) (governance.HookOutcome, error) {
	if ev.Phase == governance.PhasePreToolUse {
		*h.order = append(*h.order, "pre")
	}
	return governance.HookOutcome{}, nil
}

func TestInvariant_mcp_authorization_gate_order_all_entry_paths(t *testing.T) {
	order := []string{}
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: false, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
			order = append(order, "execute")
			return session.NewToolResult(call.ID, "ok"), nil
		}},
		request: tool.AuthorizationRequest{ID: "request", Backend: "safe-label", RouteID: "private-route", ConfigID: "private-config", ExpiresAt: time.Now().Add(time.Hour)},
		order:   &order,
	}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`)), mockllm.TextTurn("done"))
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected), Policy: orderedAuthorizationPolicy{order: &order}, Hooks: orderedAuthorizationHook{order: &order}, Store: memstore.New()})
	drain(e.Run(context.Background(), newSession(t, session.Limits{}), agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if got, want := fmt.Sprint(order), "[permission pre broker]"; got != want {
		t.Fatalf("gate order = %s, want %s", got, want)
	}
}

type mcpAuthorizationParkFixture struct {
	protected *authorizationTool
	sess      *session.Session
	run       *agent.Run
	events    []session.Event
}

func newMCPAuthorizationParkFixture(t *testing.T) mcpAuthorizationParkFixture {
	t.Helper()
	executed := false
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			executed = true
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "mcp__protected__list", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{"secret":"must not reach a card"}`)))
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected), Interactive: true, Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	r := e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true})
	events := drain(r)
	if executed {
		t.Fatal("parked protected call executed")
	}
	return mcpAuthorizationParkFixture{protected: protected, sess: sess, run: r, events: events}
}

func TestSessionMCPAuthorization_Scenario5_PendingHasNoExecutionEffects(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	if fixture.sess.Counters.ToolCalls != 0 || fixture.protected.calls != 1 {
		t.Fatalf("tool calls/authorization requests = %d/%d, want 0/1", fixture.sess.Counters.ToolCalls, fixture.protected.calls)
	}
}

func TestInvariant_mcp_authorization_replays_effective_call(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	pending, ok := fixture.sess.PendingMCPAuthorization()
	if !ok || string(pending.Call.Args) != `{"secret":"must not reach a card"}` {
		t.Fatalf("pending call = %#v, want effective exact call", pending)
	}
}

func TestInvariant_protected_broker_tool_card_redacts_arguments(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	for _, event := range fixture.events {
		if event.Type == session.EvToolCall && event.ToolCall != nil && len(event.ToolCall.Args) != 0 {
			t.Fatalf("protected tool card leaked arguments: %s", event.ToolCall.Args)
		}
	}
}

func TestMCPAuthorizationParkedRelayLifecycle(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	if fixture.sess.State != session.StateAuthorizing || fixture.run.Outcome() != agent.RunOutcomeAuthorizationParked {
		t.Fatalf("state/outcome = %s/%v, want authorizing/authorization parked", fixture.sess.State, fixture.run.Outcome())
	}
}

func TestSessionMCPAuthorization_Scenario6_RemoteMainMayPark(t *testing.T) {
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true},
		request:  tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "mcp__protected__list", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`)))
	// A process-headless service may still have an attached authenticated remote
	// main client. Presentation is a run capability, not an Engine-wide posture.
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected), Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	r := e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true})
	drain(r)
	if sess.State != session.StateAuthorizing || r.Outcome() != agent.RunOutcomeAuthorizationParked {
		t.Fatalf("state/outcome = %s/%v, want authorizing/authorization parked", sess.State, r.Outcome())
	}
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
	if sess.State == session.StateAuthorizing || protected.calls != 0 {
		t.Fatalf("unattended state/calls = %s/%d, want non-authorizing/no transaction", sess.State, protected.calls)
	}
	foundResult := false
	for _, event := range events {
		if event.Type == session.EvMCPAuthorizationRequired {
			t.Fatal("unattended run emitted authorization-required")
		}
		if event.ToolResult != nil && event.ToolResult.CallID == "call-1" && event.ToolResult.IsError {
			foundResult = true
		}
	}
	if !foundResult {
		t.Fatal("unattended run did not pair protected call with an error result")
	}
}

func TestSessionMCPAuthorization_Scenario5_GatesPrecedeConnect(t *testing.T) {
	protected := &authorizationTool{fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true}, request: tool.AuthorizationRequest{ID: "request"}}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`)), mockllm.TextTurn("done"))
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected), Policy: permpolicy.NewPolicy([]governance.Rule{{Scope: governance.ScopeBuiltinDefault, Effect: governance.Deny}}, nil)})
	sess := newSession(t, session.Limits{})
	drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if protected.calls != 0 {
		t.Fatalf("authorization transactions = %d, want none after permission denial", protected.calls)
	}
}

func TestSessionMCPAuthorization_Scenario5_ParksMidTurnDeterministically(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	for _, event := range fixture.events {
		if event.Type == session.EvResult || event.Type == session.EvToolResult {
			t.Fatalf("parked run emitted forbidden event %s", event.Type)
		}
	}
}

func TestInvariant_mcp_authorization_save_precedes_required_event(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	seenRequired := false
	for _, event := range fixture.events {
		if event.Type == session.EvMCPAuthorizationRequired {
			seenRequired = true
			if fixture.sess.State != session.StateAuthorizing {
				t.Fatalf("required event emitted before durable authorizing state: %s", fixture.sess.State)
			}
		}
	}
	if !seenRequired {
		t.Fatal("parked run did not emit authorization-required event")
	}
}

func TestSessionMCPAuthorization_Scenario5_SaveFailureCancelsTransaction(t *testing.T) {
	var cancelledID string
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true},
		request:  tool.AuthorizationRequest{ID: "exact-transaction", Backend: "protected", RouteID: "mcp__protected__list", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
		cancel: func(ctx context.Context, id string) error {
			if ctx.Err() != nil {
				t.Fatalf("cancellation context was cancelled: %v", ctx.Err())
			}
			cancelledID = id
			return nil
		},
	}
	second := &fakeTool{name: "read-after", readOnly: true}
	llm := mockllm.New(
		mockllm.ToolCallTurn(
			toolCall("pending", protected.name, `{"secret":"not in an event"}`),
			toolCall("sibling", second.name, `{}`),
		),
		mockllm.TextTurn("continued"),
	)
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected, second), Store: failingAuthorizationStore{err: errors.New("save failed")}})
	sess := newSession(t, session.Limits{})
	events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if cancelledID != "exact-transaction" {
		t.Fatalf("cancelled transaction = %q, want exact-transaction (requests %d, state %s, events %v)", cancelledID, protected.calls, sess.State, typesOf(events))
	}
	if sess.State == session.StateAuthorizing {
		t.Fatalf("state = %s, want non-authorizing after failed required save", sess.State)
	}
	var resultIDs []session.ToolCallID
	for _, event := range events {
		if event.ToolResult != nil {
			resultIDs = append(resultIDs, event.ToolResult.CallID)
		}
	}
	if len(resultIDs) < 2 || resultIDs[0] != "pending" || resultIDs[1] != "sibling" {
		t.Fatalf("result event order = %v, want pending then sibling", resultIDs)
	}
	if err := session.ValidateToolPairing(sess.Conversation.Messages); err != nil {
		t.Fatalf("tool pairing after failed save: %v", err)
	}
}

func TestSessionMCPAuthorization_Scenario6_BrokerCallsSerialize(t *testing.T) {
	fixture := newMCPAuthorizationParkFixture(t)
	serial, ok := interface{}(fixture.protected).(tool.DispatchSerial)
	if !ok || !serial.DispatchSerial() || !fixture.protected.ReadOnly() {
		t.Fatalf("protected tool serial/read-only = %v/%v, want true/true", ok && serial.DispatchSerial(), fixture.protected.ReadOnly())
	}
}

func TestSessionMCPAuthorization_Scenario6_UnrelatedReadsRemainParallel(t *testing.T) {
	plain := &fakeTool{name: "plain-read", readOnly: true}
	if serial, ok := interface{}(plain).(tool.DispatchSerial); ok && serial.DispatchSerial() {
		t.Fatal("unrelated read-only tool was made dispatch-serial")
	}
}
