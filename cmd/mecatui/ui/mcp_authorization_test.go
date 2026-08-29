package ui

import (
	"strings"
	"testing"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
)

func TestInvariant_mecatui_mcp_authorization_is_not_permission_approval(t *testing.T) {
	m := New(Deps{Theme: theme.New("aztec", theme.AztecPalette())})
	m = applyAll(m, client.MCPAuthorizationMsg{AuthorizationID: "auth-1", Backend: "github", CallID: "call-1", Status: "pending"})
	if m.phase != phaseAuthorizing {
		t.Fatalf("phase = %v, want authorizing", m.phase)
	}
	view := m.View().Content
	for _, forbidden := range []string{"Allow", "Always", "Deny"} {
		if strings.Contains(view, forbidden) {
			t.Fatalf("authorization view exposed permission action %q: %s", forbidden, view)
		}
	}
	for _, required := range []string{"Open Browser", "Recheck", "Cancel"} {
		if !strings.Contains(view, required) {
			t.Fatalf("authorization view missing %q: %s", required, view)
		}
	}
}

func TestSessionMCPAuthorization_Scenario9_MecatuiReconnect(t *testing.T) {
	m := New(Deps{Theme: theme.New("aztec", theme.AztecPalette())})
	m = applyAll(m, client.MCPAuthorizationMsg{AuthorizationID: "auth-1", Backend: "github", CallID: "call-1", Status: "pending"})
	m = applyAll(m, client.MCPAuthorizationMsg{AuthorizationID: "auth-1", Backend: "github", CallID: "call-1", Status: "pending"})
	if m.phase != phaseAuthorizing || m.authorization.authorizationID != "auth-1" {
		t.Fatalf("replayed safe status did not restore authorization state: %+v", m.authorization)
	}
}
