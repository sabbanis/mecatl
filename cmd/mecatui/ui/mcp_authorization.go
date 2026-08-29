package ui

import (
	"context"
	"fmt"

	"charm.land/bubbles/v2/key"
	tea "charm.land/bubbletea/v2"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
)

// mcpAuthorizationState is intentionally distinct from permission approval.
// It holds correlation only; presentation URLs are fetched on demand and never
// retained in model state or reconstructed from replayed events.
type mcpAuthorizationState struct {
	authorizationID string
	backend         string
	callID          string
}

func (m Model) applyMCPAuthorization(msg client.MCPAuthorizationMsg) (tea.Model, tea.Cmd) {
	if msg.Status != "pending" {
		if m.authorization.authorizationID == msg.AuthorizationID {
			m.authorization = mcpAuthorizationState{}
			if m.phase == phaseAuthorizing {
				m.phase = phaseRunning
			}
		}
		m.conv.addNotice(mcpAuthorizationNotice(msg))
		return m.afterEvent()
	}
	m.authorization = mcpAuthorizationState{authorizationID: msg.AuthorizationID, backend: msg.Backend, callID: msg.CallID}
	m.phase = phaseAuthorizing
	m.activeTool = ""
	m.toolProgress = ""
	return m.afterEvent()
}

func (m Model) onMCPAuthorizationKey(msg tea.KeyPressMsg) (tea.Model, tea.Cmd) {
	if m.authorization.authorizationID == "" || m.deps.MCPAuthorization == nil {
		return m, nil
	}
	id := m.authorization.authorizationID
	sessionID := m.sessionID
	switch {
	case key.Matches(msg, m.keys.Close):
		return m, nil // cancellation is explicit; escape cannot silently resolve it.
	case msg.String() == "o":
		if m.deps.OpenURL == nil {
			m.statusMsg = "browser opening is unavailable"
			return m, nil
		}
		return m, func() tea.Msg {
			url, err := m.deps.MCPAuthorization.MCPAuthorizationPresentation(m.deps.Ctx, sessionID, id)
			if err == nil {
				err = m.deps.OpenURL(m.deps.Ctx, url)
			}
			if err != nil {
				return client.StreamErrMsg{Err: fmt.Errorf("open MCP authorization: %w", err)}
			}
			return nil
		}
	case msg.String() == "r":
		return m, controlMCPAuthorizationCmd(m.deps.Ctx, m.deps.MCPAuthorization, sessionID, id, false)
	case msg.String() == "c":
		return m, controlMCPAuthorizationCmd(m.deps.Ctx, m.deps.MCPAuthorization, sessionID, id, true)
	default:
		return m, nil
	}
}

func controlMCPAuthorizationCmd(ctx context.Context, control client.MCPAuthorizationController, sessionID, authorizationID string, cancel bool) tea.Cmd {
	return func() tea.Msg {
		var stream *client.EventStream
		var err error
		if cancel {
			stream, err = control.CancelMCPAuthorization(ctx, sessionID, authorizationID)
		} else {
			stream, err = control.RecheckMCPAuthorization(ctx, sessionID, authorizationID)
		}
		if err != nil {
			return client.StreamErrMsg{Err: err}
		}
		return mcpAuthorizationStreamMsg{stream: stream}
	}
}

type mcpAuthorizationStreamMsg struct{ stream *client.EventStream }

func (m Model) updateMCPAuthorizationStream(msg mcpAuthorizationStreamMsg) (tea.Model, tea.Cmd) {
	if msg.stream == nil {
		return m, nil
	}
	ch := make(chan tea.Msg, 16)
	go func() {
		msg.stream.ReadLoop(m.deps.Ctx, ch)
	}()
	return m, client.WaitForMsg(ch)
}

func (m Model) renderMCPAuthorization() string {
	body := fmt.Sprintf("MCP authorization required\n\nBackend: %s\n\n[o] Open Browser   [r] Recheck   [c] Cancel", sanitizeTerminal(m.authorization.backend))
	return centerCard(m.deps.Theme, body, m.width, m.vp.Height())
}
