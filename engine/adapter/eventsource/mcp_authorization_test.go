package eventsource

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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
	_, err := Fold(SessionMeta{ID: "s1", CreatedAt: time.Date(2026, 8, 29, 11, 0, 0, 0, time.UTC)}, func(yield func(session.Event, error) bool) {
		for _, event := range events {
			if !yield(event, nil) {
				return
			}
		}
	})
	require.ErrorIs(t, err, ErrPrivateStateRequired)
}
