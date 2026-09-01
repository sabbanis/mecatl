package eventsource

import (
	"errors"
	"testing"
	"time"

	"github.com/stacklok/mecatl/engine/session"
)

func TestSessionMCPAuthorization_Scenario9_EventFoldRequiresPrivateState(t *testing.T) {
	t.Parallel()
	events := []session.Event{{
		Type: session.EvMCPAuthorizationRequired,
		MCPAuthorization: &session.MCPAuthorizationPayload{
			AuthorizationID: "auth-1", Backend: "github", Call: "call-1",
			ExpiresAt: time.Date(2026, 8, 29, 12, 0, 0, 0, time.UTC), Status: session.MCPAuthorizationPending,
		},
	}}
	if err := foldMCPAuthorizationEvents(events); !errors.Is(err, ErrPrivateStateRequired) {
		t.Fatalf("fold error = %v, want ErrPrivateStateRequired", err)
	}
}

func TestSessionMCPAuthorization_Scenario9_EventFoldRejectsMalformedLifecycle(t *testing.T) {
	t.Parallel()

	for _, events := range [][]session.Event{
		{{Type: session.EvMCPAuthorizationResolved, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: "auth-1", Status: session.MCPAuthorizationConnected}}},
		{{Type: session.EvMCPAuthorizationRequired, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: "auth-1", Status: session.MCPAuthorizationConnected}}},
		{{Type: session.EvMCPAuthorizationRequired, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: "auth-1", Status: session.MCPAuthorizationPending}}, {Type: session.EvMCPAuthorizationResolved, MCPAuthorization: &session.MCPAuthorizationPayload{AuthorizationID: "auth-1", Status: session.MCPAuthorizationPending}}},
	} {
		if err := foldMCPAuthorizationEvents(events); !errors.Is(err, ErrPrivateStateRequired) {
			t.Fatalf("fold error = %v, want ErrPrivateStateRequired", err)
		}
	}
}

func foldMCPAuthorizationEvents(events []session.Event) error {
	_, err := Fold(SessionMeta{ID: "s1", CreatedAt: time.Date(2026, 8, 29, 11, 0, 0, 0, time.UTC)}, func(yield func(session.Event, error) bool) {
		for _, event := range events {
			if !yield(event, nil) {
				return
			}
		}
	})
	return err
}
