package server

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/stacklok/mecatl/engine/session"
)

// TestInvariant_mcp_authorization_events_are_safe_correlation_only pins the
// wire event grammar: both required and resolved events carry status and safe
// correlation only, never the browser transaction or effective call arguments.
func TestInvariant_mcp_authorization_events_are_safe_correlation_only(t *testing.T) {
	t.Parallel()

	ev := toProto(session.Event{
		Type: session.EvMCPAuthorizationRequired,
		MCPAuthorization: &session.MCPAuthorizationPayload{
			AuthorizationID: "authorization-1",
			Backend:         "github",
			Call:            "call-1",
			ExpiresAt:       time.Date(2026, 8, 29, 12, 0, 0, 0, time.UTC),
			Status:          session.MCPAuthorizationPending,
		},
	})

	got := ev.GetMcpAuthorization()
	require.NotNil(t, got)
	require.Equal(t, "pending", got.GetStatus())
	require.Equal(t, "authorization-1", got.GetAuthorizationId())
	require.Equal(t, "github", got.GetBackend())
	require.Equal(t, "call-1", got.GetCallId())
	for _, forbidden := range []string{"url", "argument", "code", "verifier", "token", "tsid", "secret"} {
		fields := got.ProtoReflect().Descriptor().Fields()
		for i := 0; i < fields.Len(); i++ {
			fd := fields.Get(i)
			require.NotContains(t, strings.ToLower(string(fd.Name())), forbidden)
		}
	}
}

func TestSessionMCPAuthorization_Scenario9_WireControlParity(t *testing.T) {
	t.Parallel()

	ev := toProto(session.Event{Type: session.EvMCPAuthorizationResolved, MCPAuthorization: &session.MCPAuthorizationPayload{
		AuthorizationID: "authorization-1", Backend: "github", Call: "call-1", Status: session.MCPAuthorizationCancelled,
	}})
	require.Equal(t, "cancelled", ev.GetMcpAuthorization().GetStatus())
}
