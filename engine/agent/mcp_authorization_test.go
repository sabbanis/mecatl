package agent_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
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

// awaitingSnapshotStore simulates a process ending after the durable park save,
// before the cancellation path can overwrite that snapshot.
type awaitingSnapshotStore struct{ port.SessionStore }

func (s awaitingSnapshotStore) Save(ctx context.Context, sess *session.Session) error {
	if sess.State != session.StateAwaiting {
		return nil
	}
	return s.SessionStore.Save(ctx, sess)
}

type authorizationTool struct {
	fakeTool
	request    tool.AuthorizationRequest
	calls      int
	requestFn  func(context.Context) (tool.AuthorizationRequest, bool, error)
	cancel     func(context.Context, string) error
	invalidate func(context.Context, string) error
	order      *[]string
}

func (t *authorizationTool) RequestAuthorization(ctx context.Context) (tool.AuthorizationRequest, bool, error) {
	t.calls++
	if t.requestFn != nil {
		return t.requestFn(ctx)
	}
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
func (t *authorizationTool) InvalidateAuthorization(ctx context.Context, id string) error {
	if t.invalidate != nil {
		return t.invalidate(ctx, id)
	}
	return nil
}
func (*authorizationTool) DispatchSerial() bool { return true }

type failingAuthorizationStore struct{ err error }

func (s failingAuthorizationStore) Save(context.Context, *session.Session) error { return s.err }
func (failingAuthorizationStore) Load(context.Context, session.SessionID) (*session.Session, error) {
	return nil, port.ErrSessionNotFound
}

type authorizationEventOrder struct {
	mu      sync.Mutex
	entries []string
}

func (o *authorizationEventOrder) add(entry string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.entries = append(o.entries, entry)
}

func (o *authorizationEventOrder) snapshot() []string {
	o.mu.Lock()
	defer o.mu.Unlock()
	return append([]string(nil), o.entries...)
}

type orderedAuthorizationStore struct {
	port.SessionStore
	order *authorizationEventOrder
}

func (s orderedAuthorizationStore) Save(ctx context.Context, sess *session.Session) error {
	s.order.add("save")
	return s.SessionStore.Save(ctx, sess)
}

type orderedAuthorizationSink struct{ order *authorizationEventOrder }

func (s orderedAuthorizationSink) Emit(_ context.Context, event session.Event) {
	if event.Type == session.EvMCPAuthorizationRequired {
		s.order.add("required")
	}
}

type authorizationObservationHook struct{ post atomic.Int32 }

func (h *authorizationObservationHook) Run(_ context.Context, event governance.HookEvent) (governance.HookOutcome, error) {
	if event.Phase == governance.PhasePostToolUse {
		h.post.Add(1)
	}
	return governance.HookOutcome{}, nil
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

// TestInvariant_restored_permission_approval_preserves_mcp_authorization_park
// models process death after a normal permission ask. The fresh engine must retain
// the broker transaction durably rather than recording a zero-value tool result.
func TestInvariant_restored_permission_approval_preserves_mcp_authorization_park(t *testing.T) {
	policy := permpolicy.NewPolicy([]governance.Rule{{Scope: governance.ScopeBuiltinDefault, Effect: governance.Ask}}, nil)
	sess := session.New("restored-mcp-park", session.ModeDefault, "/ws", session.Limits{}, time.Unix(0, 0))

	store := memstore.New()
	first := &fakeTool{name: "mcp__protected__list", readOnly: true}
	e1 := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("protected", first.name, `{}`))), Catalog: catalogWith(t, first), Policy: policy, Store: store})
	var askID string
	var restored *session.Session
	r := e1.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go"})
	for event := range r.Events() {
		if event.Type != session.EvPermissionAsk || event.Ask == nil || askID != "" {
			continue
		}
		askID = event.Ask.AskID
		if err := store.Save(context.Background(), sess); err != nil {
			t.Fatalf("Save awaiting session: %v", err)
		}
		var err error
		restored, err = store.Load(context.Background(), sess.ID)
		if err != nil {
			t.Fatalf("Load awaiting session: %v", err)
		}
		r.Cancel()
	}
	if askID == "" || restored == nil || restored.State != session.StateAwaiting {
		t.Fatalf("restored awaiting state = %v/%v/%v, want ask/loaded/awaiting", askID, restored != nil, restored != nil && restored.State == session.StateAwaiting)
	}

	protected := &authorizationTool{
		fakeTool: fakeTool{name: first.name, readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("protected tool executed instead of parking for authorization")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "restored-transaction", Backend: "Configured MCP", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	e2 := newEngine(agent.Deps{LLM: mockllm.New(), Catalog: catalogWith(t, protected), Policy: policy, Store: memstore.New()})
	events := resumeEvents(e2.ResumeApprovalWithPresentation(context.Background(), restored, agent.MemEnv("/ws"), askID, session.VerdictAllowOnce, true))

	if restored.State != session.StateAuthorizing {
		t.Fatalf("restored state = %s, want authorizing", restored.State)
	}
	pending, ok := restored.PendingMCPAuthorization()
	if !ok || pending.AuthorizationID != "restored-transaction" || pending.Call.ID != "protected" {
		t.Fatalf("pending authorization = %#v, want durable restored transaction", pending)
	}
	for _, event := range events {
		if event.Type == session.EvToolResult || event.Type == session.EvResult {
			t.Fatalf("restored authorization park emitted %s", event.Type)
		}
	}
}

func TestInvariant_mcp_authorization_resume_presentation_is_caller_granted(t *testing.T) {
	call := toolCall("protected", "mcp__protected__list", `{}`)
	sess := session.New("resume-without-presentation", session.ModeDefault, "/ws", session.Limits{}, time.Unix(0, 0))
	if err := sess.RecordUserPrompt("go", nil); err != nil {
		t.Fatalf("record prompt: %v", err)
	}
	if err := sess.BeginTurn(); err != nil {
		t.Fatalf("begin turn: %v", err)
	}
	if err := sess.RecordAssistant(session.NewAssistantMessage("", "", []session.ToolCall{call})); err != nil {
		t.Fatalf("record assistant: %v", err)
	}
	ask := session.PendingAsk{AskID: "resume-without-presentation:1:protected:r1", Tool: call.Name, Call: call.ID}
	if err := sess.PauseForApproval(ask); err != nil {
		t.Fatalf("pause for approval: %v", err)
	}
	protected := &authorizationTool{fakeTool: fakeTool{name: call.Name, readOnly: true}, request: tool.AuthorizationRequest{ID: "transaction", Backend: "protected"}}
	e := newEngine(agent.Deps{LLM: mockllm.New(), Catalog: catalogWith(t, protected), Policy: permpolicy.NewPolicy([]governance.Rule{{Scope: governance.ScopeBuiltinDefault, Effect: governance.Ask}}, nil)})
	drain(e.ResumeApproval(context.Background(), sess, agent.MemEnv("/ws"), ask.AskID, session.VerdictAllowOnce))
	if sess.State == session.StateAuthorizing {
		t.Fatal("unprivileged ResumeApproval parked a broker authorization")
	}
	if _, ok := sess.PendingMCPAuthorization(); ok {
		t.Fatal("unprivileged ResumeApproval retained a broker authorization transaction")
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
	for _, tc := range []struct {
		name string
		deps agent.Deps
	}{
		{
			name: "permission denial",
			deps: agent.Deps{Policy: permpolicy.NewPolicy([]governance.Rule{{Scope: governance.ScopeBuiltinDefault, Effect: governance.Deny}}, nil)},
		},
		{
			name: "pre-tool-use block",
			deps: agent.Deps{Hooks: preBlockAuthorizationHook{}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			protected := &authorizationTool{fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true}, request: tool.AuthorizationRequest{ID: "request"}}
			llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`)), mockllm.TextTurn("done"))
			deps := tc.deps
			deps.LLM = llm
			deps.Catalog = catalogWith(t, protected)
			e := newEngine(deps)
			sess := newSession(t, session.Limits{})
			drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
			if protected.calls != 0 {
				t.Fatalf("authorization transactions = %d, want none after %s", protected.calls, tc.name)
			}
		})
	}
}

type preBlockAuthorizationHook struct{}

func (preBlockAuthorizationHook) Run(_ context.Context, ev governance.HookEvent) (governance.HookOutcome, error) {
	if ev.Phase == governance.PhasePreToolUse {
		return governance.HookOutcome{Block: true, Message: "blocked before broker authorization"}, nil
	}
	return governance.HookOutcome{}, nil
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
	order := &authorizationEventOrder{}
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true},
		request:  tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	e := newEngine(agent.Deps{
		LLM:     mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`))),
		Catalog: catalogWith(t, protected),
		Store:   orderedAuthorizationStore{SessionStore: memstore.New(), order: order},
		Sink:    orderedAuthorizationSink{order: order},
	})
	drain(e.Run(context.Background(), newSession(t, session.Limits{}), agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))

	entries := order.snapshot()
	if len(entries) < 2 || entries[len(entries)-2] != "save" || entries[len(entries)-1] != "required" {
		t.Fatalf("save/required order = %v, want final [save required]", entries)
	}
}

func TestInvariant_mcp_authorization_pending_has_no_posthook_recorder_or_failure_effects(t *testing.T) {
	hooks := &authorizationObservationHook{}
	recorder := &recordingLogger{}
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("protected tool executed while authorization was pending")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`))), Catalog: catalogWith(t, protected), Hooks: hooks, ToolCallRecorder: recorder, Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if hooks.post.Load() != 0 || recorder.calls != 0 || sess.Counters.ToolCalls != 0 {
		t.Fatalf("post hooks/recorder/tool calls = %d/%d/%d, want 0/0/0", hooks.post.Load(), recorder.calls, sess.Counters.ToolCalls)
	}
	for _, event := range events {
		if event.Type == session.EvToolResult || event.Type == session.EvResult {
			t.Fatalf("pending authorization emitted execution/failure event %s", event.Type)
		}
	}
}

func TestInvariant_mcp_authorization_preserves_pre_hook_mutated_call_across_continuation(t *testing.T) {
	const originalArgs = `{"scope":"original"}`
	const effectiveArgs = `{"scope":"effective"}`
	var executed []string
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
			executed = append(executed, string(call.Args))
			return session.NewToolResult(call.ID, "executed"), nil
		}},
		request: tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	hooks := &mutatingHooks{mutate: map[governance.HookPhase]json.RawMessage{
		governance.PhasePreToolUse: json.RawMessage(effectiveArgs),
	}}
	store := memstore.New()
	e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, originalArgs))), Catalog: catalogWith(t, protected), Hooks: hooks, Store: store})
	sess := newSession(t, session.Limits{})
	events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))

	if len(executed) != 0 || sess.State != session.StateAuthorizing {
		t.Fatalf("executions/state = %v/%s, want none/authorizing", executed, sess.State)
	}
	pending, ok := sess.PendingMCPAuthorization()
	if !ok || string(pending.Call.Args) != effectiveArgs {
		t.Fatalf("pending call = %#v, want effective args %s", pending.Call, effectiveArgs)
	}
	for _, message := range sess.Conversation.Messages {
		if message.Role == session.RoleAssistant && len(message.ToolCalls) != 0 && string(message.ToolCalls[0].Args) != originalArgs {
			t.Fatalf("assistant call args = %s, want original %s", message.ToolCalls[0].Args, originalArgs)
		}
	}
	for _, event := range events {
		if event.Type == session.EvToolResult || event.Type == session.EvResult {
			t.Fatalf("authorization park emitted execution/terminal event %s", event.Type)
		}
	}
	if err := store.Save(context.Background(), sess); err != nil {
		t.Fatalf("save parked session: %v", err)
	}
	restored, err := store.Load(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("load parked session: %v", err)
	}
	pending, ok = restored.PendingMCPAuthorization()
	if !ok || string(pending.Call.Args) != effectiveArgs {
		t.Fatalf("restored pending call = %#v, want effective args %s", pending.Call, effectiveArgs)
	}

	claim, err := restored.ClaimMCPAuthorization()
	if err != nil {
		t.Fatalf("claim parked authorization: %v", err)
	}
	result, err := protected.Execute(context.Background(), claim.Call, agent.MemEnv("/ws"))
	if err != nil {
		t.Fatalf("execute claimed call: %v", err)
	}
	if err := restored.RecordToolResults([]session.ToolResult{result}); err != nil {
		t.Fatalf("record claimed result: %v", err)
	}
	if err := session.ValidateToolPairing(restored.Conversation.Messages); err != nil {
		t.Fatalf("pair claimed continuation: %v", err)
	}
	if got, want := fmt.Sprint(executed), "["+effectiveArgs+"]"; got != want {
		t.Fatalf("continuation executed args = %s, want %s", got, want)
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
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	request := func(context.Context) (tool.AuthorizationRequest, bool, error) {
		entered <- struct{}{}
		<-release
		return tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)}, true, nil
	}
	first := &authorizationTool{fakeTool: fakeTool{name: "mcp__first__list", readOnly: true}, requestFn: request}
	second := &authorizationTool{fakeTool: fakeTool{name: "mcp__second__list", readOnly: true}, requestFn: request}
	e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("first", first.name, `{}`), toolCall("second", second.name, `{}`))), Catalog: catalogWith(t, first, second), Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	r := e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true})

	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("first broker authorization request did not start")
	}
	select {
	case <-entered:
		t.Fatal("second broker authorization request overlapped the first")
	case <-time.After(50 * time.Millisecond):
	}
	close(release)
	drain(r)
	if first.calls != 1 || second.calls != 0 || sess.State != session.StateAuthorizing {
		t.Fatalf("broker requests/state = %d/%d/%s, want 1/0/authorizing", first.calls, second.calls, sess.State)
	}
}

func TestSessionMCPAuthorization_Scenario6_UnrelatedReadsRemainParallel(t *testing.T) {
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	var overlap overlapTracker
	read := func(ctx context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		overlap.enter()
		defer overlap.leave()
		entered <- struct{}{}
		select {
		case <-release:
			return session.NewToolResult(call.ID, "read"), nil
		case <-ctx.Done():
			return session.ToolResult{}, ctx.Err()
		}
	}
	first := &fakeTool{name: "first-read", readOnly: true, exec: read}
	second := &fakeTool{name: "second-read", readOnly: true, exec: read}
	protected := &authorizationTool{fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true}, request: tool.AuthorizationRequest{ID: "request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)}}
	e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(toolCall("first", first.name, `{}`), toolCall("second", second.name, `{}`), toolCall("protected", protected.name, `{}`))), Catalog: catalogWith(t, first, second, protected), Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	r := e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true})
	for range 2 {
		select {
		case <-entered:
		case <-time.After(time.Second):
			t.Fatal("unrelated reads did not overlap")
		}
	}
	close(release)
	drain(r)
	if overlap.max() != 2 || protected.calls != 1 || sess.State != session.StateAuthorizing {
		t.Fatalf("read overlap/broker requests/state = %d/%d/%s, want 2/1/authorizing", overlap.max(), protected.calls, sess.State)
	}
}

// TestInvariant_mcp_authorization_parks_mid_turn_after_preceding_completion
// exercises one actual same-process turn: a normal earlier call completes, the
// protected middle call parks, and the later sibling remains unexecuted and is
// preserved only as the durable deferred continuation.
func TestInvariant_mcp_authorization_parks_mid_turn_after_preceding_completion(t *testing.T) {
	var laterRuns int
	earlier := &fakeTool{name: "earlier-read", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		return session.NewToolResult(call.ID, "earlier complete"), nil
	}}
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__read", readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("protected call executed instead of parking")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "transaction", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	later := &fakeTool{name: "later-read", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		laterRuns++
		return session.NewToolResult(call.ID, "must not run"), nil
	}}
	e := newEngine(agent.Deps{LLM: mockllm.New(mockllm.ToolCallTurn(
		toolCall("earlier", earlier.name, `{}`),
		toolCall("protected", protected.name, `{}`),
		toolCall("later", later.name, `{}`),
	)), Catalog: catalogWith(t, earlier, protected, later), Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	events := drain(e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true}))
	if laterRuns != 0 || sess.State != session.StateAuthorizing {
		t.Fatalf("later runs/state = %d/%s, want 0/authorizing", laterRuns, sess.State)
	}
	pending, ok := sess.PendingMCPAuthorization()
	if !ok || pending.Call.ID != "protected" || len(pending.Deferred) != 1 || pending.Deferred[0].ID != "later" {
		t.Fatalf("pending continuation = %#v, want protected then deferred later", pending)
	}
	var resultBeforeRequired, required bool
	for _, event := range events {
		if event.ToolResult != nil && event.ToolResult.CallID == "earlier" {
			resultBeforeRequired = !required
		}
		if event.Type == session.EvMCPAuthorizationRequired {
			required = true
		}
		if event.ToolResult != nil && event.ToolResult.CallID == "later" {
			t.Fatal("later sibling emitted a result while parked")
		}
	}
	if !resultBeforeRequired || !required {
		t.Fatalf("events did not retain earlier completion before required park: %v", typesOf(events))
	}
}

type authorizationApprovalHook struct{ tool string }

func (h authorizationApprovalHook) Run(_ context.Context, ev governance.HookEvent) (governance.HookOutcome, error) {
	if ev.Phase == governance.PhasePreToolUse && ev.Tool == h.tool {
		return governance.HookOutcome{Block: true, AskApproval: true, Message: "operator approval required"}, nil
	}
	return governance.HookOutcome{}, nil
}

// TestInvariant_mcp_authorization_tail_covers_normal_guardrail_and_resume pins
// that an allowed guardrail approval still enters the broker authorization tail;
// approving a hook gate is not authority to execute a protected backend.
func TestInvariant_mcp_authorization_tail_covers_normal_guardrail_and_resume(t *testing.T) {
	protected := &authorizationTool{
		fakeTool: fakeTool{name: "mcp__protected__list", readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("protected tool executed before broker authorization")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "broker-request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	llm := mockllm.New(mockllm.ToolCallTurn(toolCall("call-1", protected.name, `{}`)))
	e := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, protected), Hooks: authorizationApprovalHook{tool: protected.name}, Interactive: true, Store: memstore.New()})
	sess := newSession(t, session.Limits{})
	r := e.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go", AuthorizationPresentation: true})
	var sawRequired, sawResult bool
	for ev := range r.Events() {
		if ev.Type == session.EvPermissionAsk && ev.Ask != nil {
			r.Approve(ev.Ask.AskID, session.VerdictAllowOnce)
		}
		if ev.Type == session.EvMCPAuthorizationRequired {
			sawRequired = true
		}
		if ev.Type == session.EvToolResult {
			sawResult = true
		}
	}
	if !sawRequired || sawResult || protected.calls != 1 || sess.State != session.StateAuthorizing {
		t.Fatalf("required/result/requests/state = %v/%v/%d/%s, want true/false/1/authorizing", sawRequired, sawResult, protected.calls, sess.State)
	}
}

// TestSessionMCPAuthorization_Scenario7_RestoredPermissionParkCompletesEarlierSiblings
// pins restart recovery: calls executed before a restored permission ask are
// closed out rather than replayed before the broker authorization park.
func TestInvariant_restored_middle_call_authorization_park_preserves_pairing(t *testing.T) {
	store := awaitingSnapshotStore{SessionStore: memstore.New()}
	var earlierCalls atomic.Int32
	var laterCalls atomic.Int32
	earlier := &fakeTool{name: "earlier", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		earlierCalls.Add(1)
		return session.NewToolResult(call.ID, "earlier result"), nil
	}}
	pending := &fakeTool{name: "pending", readOnly: false}
	later := &fakeTool{name: "later", readOnly: true, exec: func(_ context.Context, call session.ToolCall, _ tool.Workspace) (session.ToolResult, error) {
		laterCalls.Add(1)
		return session.NewToolResult(call.ID, "later result"), nil
	}}
	llm := mockllm.New(mockllm.ToolCallTurn(
		toolCall("earlier-call", earlier.name, `{}`),
		toolCall("pending-call", pending.name, `{}`),
		toolCall("later-call", later.name, `{}`),
	))
	policy := permpolicy.NewPolicy([]governance.Rule{
		{Tool: earlier.name, Effect: governance.Allow, Scope: governance.ScopeBuiltinDefault},
		{Tool: later.name, Effect: governance.Allow, Scope: governance.ScopeBuiltinDefault},
	}, nil)
	first := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, earlier, pending, later), Policy: policy, Store: store, Interactive: true})
	sess := newSession(t, session.Limits{})
	run := first.Run(context.Background(), sess, agent.MemEnv("/ws"), agent.RunRequest{Text: "go"})
	for event := range run.Events() {
		if event.Type == session.EvPermissionAsk {
			if err := store.Save(context.Background(), sess); err != nil {
				t.Fatalf("persist awaiting snapshot: %v", err)
			}
			run.Cancel()
		}
	}
	if earlierCalls.Load() != 1 || laterCalls.Load() != 0 {
		t.Fatalf("first run calls = %d/%d, want 1/0", earlierCalls.Load(), laterCalls.Load())
	}

	restored, err := store.Load(context.Background(), sess.ID)
	if err != nil {
		t.Fatalf("load restored session: %v", err)
	}
	if restored.State != session.StateAwaiting {
		t.Fatalf("restored state = %s, want awaiting snapshot", restored.State)
	}
	protected := &authorizationTool{
		fakeTool: fakeTool{name: pending.name, readOnly: true, exec: func(context.Context, session.ToolCall, tool.Workspace) (session.ToolResult, error) {
			t.Fatal("protected tool executed before broker authorization")
			return session.ToolResult{}, nil
		}},
		request: tool.AuthorizationRequest{ID: "restored-broker-request", Backend: "protected", RouteID: "route", ConfigID: "config", ExpiresAt: time.Now().Add(time.Hour)},
	}
	resumed := newEngine(agent.Deps{LLM: llm, Catalog: catalogWith(t, earlier, protected, later), Policy: policy, Store: store, Interactive: true})
	ask, ok := restored.PendingAsk()
	if !ok {
		t.Fatal("restored session has no pending approval")
	}
	events := drain(resumed.ResumeApprovalWithPresentation(context.Background(), restored, agent.MemEnv("/ws"), ask.AskID, session.VerdictAllowOnce, true))

	if earlierCalls.Load() != 1 || laterCalls.Load() != 0 {
		t.Fatalf("calls after restore = earlier %d later %d, want 1/0 (no replay)", earlierCalls.Load(), laterCalls.Load())
	}
	if restored.State != session.StateAuthorizing {
		t.Fatalf("restored state = %s, want authorizing (events %v)", restored.State, typesOf(events))
	}
	pendingAuthorization, ok := restored.PendingMCPAuthorization()
	if !ok || pendingAuthorization.Call.ID != "pending-call" || len(pendingAuthorization.Deferred) != 1 || pendingAuthorization.Deferred[0].ID != "later-call" {
		t.Fatalf("pending authorization = %#v, want pending-call with later-call deferred", pendingAuthorization)
	}
	aborted, err := restored.AbortMCPAuthorization("test cleanup")
	if err != nil {
		t.Fatalf("abort parked authorization: %v", err)
	}
	if err := restored.RecordToolResults(aborted); err != nil {
		t.Fatalf("record aborted parked calls: %v", err)
	}
	if err := session.ValidateToolPairing(restored.Conversation.Messages); err != nil {
		t.Fatalf("tool pairing after restored park cleanup: %v", err)
	}
	var resultIDs []session.ToolCallID
	for _, event := range events {
		if event.ToolResult != nil {
			resultIDs = append(resultIDs, event.ToolResult.CallID)
		}
	}
	if len(resultIDs) != 1 || resultIDs[0] != "earlier-call" {
		t.Fatalf("interrupted result events = %v, want [earlier-call]", resultIDs)
	}
	var recorded []session.ToolResult
	for _, message := range restored.Conversation.Messages {
		if message.ToolResult != nil {
			recorded = append(recorded, *message.ToolResult)
		}
	}
	if len(recorded) != 3 || recorded[0].CallID != "earlier-call" || !recorded[0].IsError {
		t.Fatalf("recorded results = %#v, want earlier interrupted result followed by parked-call cleanup", recorded)
	}
	const earlierLostResult = "tool call completed before process loss, but its result was not durably recorded; its effects may have occurred and it must not be retried automatically"
	if recorded[0].Content != earlierLostResult {
		t.Fatalf("earlier interrupted result = %q, want %q", recorded[0].Content, earlierLostResult)
	}
}
