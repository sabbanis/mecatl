package ui

import (
	"context"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

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

// TestSessionMCPAuthorization_Scenario9_MecatuiControlStreamCleanup proves a
// completed recheck/cancel stream relinquishes its channel. Replayed status only
// restores the card; it never invokes the browser opener.
func TestSessionMCPAuthorization_Scenario9_MecatuiControlStreamCleanup(t *testing.T) {
	m := New(Deps{Theme: theme.New("aztec", theme.AztecPalette())})
	ch := make(chan tea.Msg)
	close(ch)
	m.authorizationEvents = ch

	m.modal = &mcpState{}
	msg := m.waitMCPAuthorizationEvent()()
	mm, _ := m.Update(msg)
	updated := mm.(Model)
	if updated.authorizationEvents != nil {
		t.Fatal("authorization event channel was not cleared")
	}
}

type mcpAuthorizationControllerFake struct {
	presentation, recheck, cancel int
}

func (f *mcpAuthorizationControllerFake) MCPAuthorizationPresentation(context.Context, string, string) (string, error) {
	f.presentation++
	return "https://authorization.example/", nil
}

func (f *mcpAuthorizationControllerFake) RecheckMCPAuthorization(context.Context, string, string) (*client.EventStream, error) {
	f.recheck++
	return nil, nil
}

func (f *mcpAuthorizationControllerFake) CancelMCPAuthorization(context.Context, string, string) (*client.EventStream, error) {
	f.cancel++
	return nil, nil
}

func TestSessionMCPAuthorization_Scenario9_MecatuiCommandsAndNoReplayOpen(t *testing.T) {
	controller := &mcpAuthorizationControllerFake{}
	opened := 0
	m := New(Deps{
		Theme:            theme.New("aztec", theme.AztecPalette()),
		MCPAuthorization: controller,
		OpenURL: func(context.Context, string) error {
			opened++
			return nil
		},
	})
	m.sessionID = "session-1"
	// Replayed state is presentation-only: it must not open a browser.
	m = applyAll(m, client.MCPAuthorizationMsg{AuthorizationID: "auth-1", Backend: "github", CallID: "call-1", Status: "pending"})
	if opened != 0 {
		t.Fatalf("replayed authorization opened browser %d times", opened)
	}

	for _, key := range []struct {
		key  string
		want func() int
	}{
		{"o", func() int { return controller.presentation }},
		{"r", func() int { return controller.recheck }},
		{"c", func() int { return controller.cancel }},
	} {
		_, cmd := m.onMCPAuthorizationKey(tea.KeyPressMsg{Code: rune(key.key[0]), Text: key.key})
		if cmd == nil {
			t.Fatalf("%s command was not installed", key.key)
		}
		_ = cmd()
		if key.want() != 1 {
			t.Fatalf("%s calls = %d, want 1", key.key, key.want())
		}
	}
	if opened != 1 {
		t.Fatalf("browser opens = %d, want explicit Open Browser only", opened)
	}
}
