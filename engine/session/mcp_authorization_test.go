package session

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"
)

func authorizingPending() PendingMCPAuthorization {
	return PendingMCPAuthorization{
		AuthorizationID: "authorization-1",
		Backend:         "calendar",
		RouteID:         "route-calendar",
		ConfigID:        "config-20260827",
		ExpiresAt:       time.Unix(1_800_000_000, 0),
		Call:            NewToolCall("call-2", "mcp__calendar__create", json.RawMessage(`{"title":"review"}`)),
		Deferred: []ToolCall{
			NewToolCall("call-3", "mcp__calendar__list", json.RawMessage(`{"after":"today"}`)),
		},
	}
}

func authorizingSession(t *testing.T) *Session {
	t.Helper()
	s := newTestSession(Limits{})
	mustOK(t, s.BeginTurn())
	mustOK(t, s.RecordAssistant(NewAssistantMessage("", "", []ToolCall{
		NewToolCall("call-1", "Read", json.RawMessage(`{"path":"a"}`)),
		authorizingPending().Call,
		authorizingPending().Deferred[0],
	})))
	mustOK(t, s.RecordToolResults([]ToolResult{NewToolResult("call-1", "a")}))
	return s
}

func TestSessionMCPAuthorization_Scenario4_TransitionMatrix(t *testing.T) {
	s := authorizingSession(t)
	pending := authorizingPending()
	if err := s.PauseForMCPAuthorization(pending); err != nil {
		t.Fatalf("PauseForMCPAuthorization: %v", err)
	}
	if s.State != StateAuthorizing {
		t.Fatalf("State = %q, want %q", s.State, StateAuthorizing)
	}
	if _, ok := s.PendingAsk(); ok {
		t.Fatal("PendingAsk unexpectedly set")
	}
	if err := s.PauseForApproval(PendingAsk{AskID: "ask", Tool: "Read"}); !errors.Is(err, ErrIllegalTransition) {
		t.Fatalf("PauseForApproval = %v, want ErrIllegalTransition", err)
	}
	if _, err := s.ResumeWith(); !errors.Is(err, ErrNoPendingAsk) {
		t.Fatalf("ResumeWith = %v, want ErrNoPendingAsk", err)
	}
	if _, err := s.ClaimMCPAuthorization(); err != nil {
		t.Fatalf("ClaimMCPAuthorization: %v", err)
	}
	if s.State != StateRunning {
		t.Fatalf("State after claim = %q, want running", s.State)
	}
}

func TestInvariant_pending_mcp_authorization_deep_copy(t *testing.T) {
	s := authorizingSession(t)
	pending := authorizingPending()
	mustOK(t, s.PauseForMCPAuthorization(pending))

	pending.Call.Args[2] = 'X'
	pending.Deferred[0].Args[2] = 'X'
	got, ok := s.PendingMCPAuthorization()
	if !ok || string(got.Call.Args) != `{"title":"review"}` || string(got.Deferred[0].Args) != `{"after":"today"}` {
		t.Fatalf("pending after input mutation = %+v, %v", got, ok)
	}
	got.Call.Args[2] = 'X'
	got.Deferred[0].Args[2] = 'X'
	again, ok := s.PendingMCPAuthorization()
	if !ok || string(again.Call.Args) != `{"title":"review"}` || string(again.Deferred[0].Args) != `{"after":"today"}` {
		t.Fatalf("pending after accessor mutation = %+v, %v", again, ok)
	}
}

func TestSessionMCPAuthorization_Scenario4_RejectsMalformedState(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*PendingMCPAuthorization)
	}{
		{"empty authorization", func(p *PendingMCPAuthorization) { p.AuthorizationID = "" }},
		{"malformed authorization", func(p *PendingMCPAuthorization) { p.AuthorizationID = "bad\nvalue" }},
		{"empty backend", func(p *PendingMCPAuthorization) { p.Backend = "" }},
		{"zero expiry", func(p *PendingMCPAuthorization) { p.ExpiresAt = time.Time{} }},
		{"mismatched call", func(p *PendingMCPAuthorization) { p.Call.ID = "other" }},
		{"duplicate deferred", func(p *PendingMCPAuthorization) { p.Deferred[0].ID = p.Call.ID }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := authorizingSession(t)
			p := authorizingPending()
			tc.mutate(&p)
			if err := s.PauseForMCPAuthorization(p); err == nil {
				t.Fatal("PauseForMCPAuthorization succeeded for malformed pending state")
			}
			if s.State != StateRunning {
				t.Fatalf("State = %q after rejection, want running", s.State)
			}
		})
	}
}

func TestInvariant_authorizing_state_rejects_conflicting_mutations(t *testing.T) {
	s := authorizingSession(t)
	mustOK(t, s.PauseForMCPAuthorization(authorizingPending()))
	before := append([]Message(nil), s.Conversation.Messages...)
	for name, op := range map[string]func() error{
		"prompt":      func() error { return s.RecordUserPrompt("new", nil) },
		"assistant":   func() error { return s.RecordAssistant(NewAssistantMessage("new", "", nil)) },
		"results":     func() error { return s.RecordToolResults(nil) },
		"usage":       func() error { return s.RecordUsage(Usage{InputTokens: 1}) },
		"reset usage": s.ResetUsage,
		"replace":     func() error { return s.ReplaceHistory(nil) },
		"seed":        func() error { return s.SeedHistory(nil) },
		"rehome":      func() error { return s.Rehome("other") },
		"mode":        func() error { return s.SetMode(ModePlan) },
		"complete":    s.Complete,
		"stop":        func() error { return s.Stop(StopEndTurn) },
		"cancel":      s.Cancel,
		"fail":        s.Fail,
		"abandon":     s.Abandon,
	} {
		t.Run(name, func(t *testing.T) {
			if err := op(); !errors.Is(err, ErrIllegalTransition) {
				t.Fatalf("operation = %v, want ErrIllegalTransition", err)
			}
			if s.State != StateAuthorizing || !reflect.DeepEqual(before, s.Conversation.Messages) {
				t.Fatal("authorizing state was mutated by rejected operation")
			}
		})
	}
	s.SetTitle("allowed inert title")
	if s.Title != "allowed inert title" {
		t.Fatalf("title = %q", s.Title)
	}
}

func TestInvariant_authorizing_resolution_preserves_tool_pairing(t *testing.T) {
	for _, resolve := range []struct {
		name string
		op   func(*Session) ([]ToolResult, error)
	}{
		{"abort", func(s *Session) ([]ToolResult, error) { return s.AbortMCPAuthorization("cancelled") }},
		{"interrupt", func(s *Session) ([]ToolResult, error) { return s.InterruptMCPAuthorization() }},
	} {
		t.Run(resolve.name, func(t *testing.T) {
			s := authorizingSession(t)
			mustOK(t, s.PauseForMCPAuthorization(authorizingPending()))
			results, err := resolve.op(s)
			mustOK(t, err)
			if s.State != StateRunning || len(results) != 2 || results[0].CallID != "call-2" || results[1].CallID != "call-3" {
				t.Fatalf("resolution = state %q results %+v", s.State, results)
			}
			mustOK(t, s.RecordToolResults(results))
			if err := ValidateToolPairing(s.Conversation.Messages); err != nil {
				t.Fatalf("ValidateToolPairing: %v", err)
			}
		})
	}
}

func TestSessionMCPAuthorization_Scenario4_PairingExceptionIsExact(t *testing.T) {
	s := authorizingSession(t)
	mustOK(t, s.PauseForMCPAuthorization(authorizingPending()))
	if err := s.ValidateMCPAuthorizationState(); err != nil {
		t.Fatalf("ValidateMCPAuthorizationState: %v", err)
	}
}
