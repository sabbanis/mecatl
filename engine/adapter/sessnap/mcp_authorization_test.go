package sessnap_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/adapter/sessnap"
	"github.com/stacklok/mecatl/engine/session"
)

func authorizingSnapshotSession(t *testing.T) *session.Session {
	t.Helper()
	s := session.New("authorizing", session.ModeDefault, "/ws", session.Limits{}, time.Unix(1_700_000_000, 0))
	if err := s.BeginTurn(); err != nil {
		t.Fatal(err)
	}
	calls := []session.ToolCall{
		session.NewToolCall("done", "Read", json.RawMessage(`{"path":"done"}`)),
		session.NewToolCall("parked", "mcp__calendar__create", json.RawMessage(`{"title":"review"}`)),
		session.NewToolCall("later", "mcp__calendar__list", json.RawMessage(`{"after":"today"}`)),
	}
	if err := s.RecordAssistant(session.NewAssistantMessage("", "", calls)); err != nil {
		t.Fatal(err)
	}
	if err := s.RecordToolResults([]session.ToolResult{session.NewToolResult("done", "ok")}); err != nil {
		t.Fatal(err)
	}
	if err := s.PauseForMCPAuthorization(session.PendingMCPAuthorization{
		AuthorizationID: "authorization-1", Backend: "calendar", RouteID: "calendar-route", ConfigID: "config-1",
		ExpiresAt: time.Unix(1_800_000_000, 0), Call: calls[1], Deferred: calls[2:],
	}); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAuthorizingSnapshotRoundTrip(t *testing.T) {
	want := authorizingSnapshotSession(t)
	got, err := sessnap.Unmarshal(mustMarshal(t, want))
	if err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if got.State != session.StateAuthorizing {
		t.Fatalf("State = %q, want authorizing", got.State)
	}
	pending, ok := got.PendingMCPAuthorization()
	if !ok || pending.AuthorizationID != "authorization-1" || pending.Call.ID != "parked" || len(pending.Deferred) != 1 || pending.Deferred[0].ID != "later" {
		t.Fatalf("PendingMCPAuthorization = %+v, %v", pending, ok)
	}
}

func TestSessionMCPAuthorization_Scenario4_OldReaderFailsClosed(t *testing.T) {
	s := authorizingSnapshotSession(t)
	snap, err := sessnap.Of(s)
	if err != nil {
		t.Fatalf("Of: %v", err)
	}
	if err := sessnap.RestoreState(session.New("old", session.ModeDefault, "/ws", session.Limits{}, time.Time{}), snap.State, snap.StopReason, snap.Pending, snap.Counters, session.Usage{}, false, ""); err == nil {
		t.Fatal("old RestoreState accepted authorizing state")
	}
	snap.PendingMCPAuthorization = nil
	if _, err := snap.Restore(); err == nil {
		t.Fatal("Restore accepted authorizing snapshot without private pending state")
	}

	malformed := session.New("malformed", session.ModeDefault, "/ws", session.Limits{}, time.Time{})
	malformed.State = session.StateAuthorizing
	if _, err := sessnap.Of(malformed); err == nil {
		t.Fatal("Of accepted authorizing session without private pending state")
	}
}
