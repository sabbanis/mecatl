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
		reenteredRunning := false
		if m.authorization.authorizationID == msg.AuthorizationID {
			m.authorization = mcpAuthorizationState{}
			if m.phase == phaseAuthorizing {
				m.phase = phaseRunning
				reenteredRunning = true
			}
		}
		m.conv.addNotice(mcpAuthorizationNotice(msg))
		mm, cmd := m.afterEvent()
		if reenteredRunning {
			// phaseAuthorizing is not spinner-visible (model.go's spinnerVisible), so
			// the spinner's self-perpetuating tick chain was dropped the moment the
			// park began (update.go's spinner.TickMsg case deliberately terminates it
			// off-phase to avoid an idle 10fps re-render). Every OTHER transition back
			// into a visible phase explicitly re-arms it with m.sp.Tick (see
			// submitPrompt, the model/effort/workspace restarts, approval resume) —
			// this resume path was the one spot that didn't, leaving the spinner glyph
			// frozen even once the run was genuinely progressing again.
			cmd = tea.Batch(cmd, m.sp.Tick)
		}
		return mm, cmd
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
type mcpAuthorizationEventMsg struct{ msg tea.Msg }
type mcpAuthorizationStreamClosedMsg struct{}

// MCP authorization stream state belongs to Model, not the MCP modal. The modal
// transfers these messages through the sealed surface intent protocol because it
// intercepts non-input messages before Model's generic reducer.
type mcpAuthorizationEventIntent struct{ msg tea.Msg }
type mcpAuthorizationStreamClosedIntent struct{}
type mcpAuthorizationStreamIntent struct{ msg mcpAuthorizationStreamMsg }

func (mcpAuthorizationEventIntent) isSurfaceIntent()        {}
func (mcpAuthorizationStreamClosedIntent) isSurfaceIntent() {}
func (mcpAuthorizationStreamIntent) isSurfaceIntent()       {}

//nolint:unparam // the fourth result preserves the common surface-intent reducer contract.
func (m Model) applyMCPSurfaceIntent(intent surfaceIntent) (model tea.Model, cmd tea.Cmd, handled bool, stopSurfaceDispatch bool) {
	switch intent := intent.(type) {
	case mcpAuthorizationEventIntent:
		mm, eventCmd := m.updateStreamEvent(intent.msg)
		m = mm.(Model)
		if m.authorizationEvents != nil {
			eventCmd = tea.Batch(eventCmd, m.waitMCPAuthorizationEvent())
		}
		return m, eventCmd, true, false
	case mcpAuthorizationStreamClosedIntent:
		m.authorizationEvents = nil
		return m, nil, true, false
	case mcpAuthorizationStreamIntent:
		model, cmd = m.updateMCPAuthorizationStream(intent.msg)
		return model, cmd, true, false
	default:
		return m, nil, false, false
	}
}

func (m Model) updateMCPAuthorizationStream(msg mcpAuthorizationStreamMsg) (tea.Model, tea.Cmd) {
	if msg.stream == nil {
		return m, nil
	}
	ch := make(chan tea.Msg, 16)
	m.authorizationEvents = ch
	go msg.stream.ReadLoop(m.deps.Ctx, ch)
	return m, m.waitMCPAuthorizationEvent()
}

func (m Model) waitMCPAuthorizationEvent() tea.Cmd {
	ch := m.authorizationEvents
	return func() tea.Msg {
		msg, ok := <-ch
		if !ok {
			return mcpAuthorizationStreamClosedMsg{}
		}
		return mcpAuthorizationEventMsg{msg: msg}
	}
}

func (m Model) renderMCPAuthorization() string {
	body := fmt.Sprintf("MCP authorization required\n\nBackend: %s\n\n[o] Open Browser   [r] Recheck   [c] Cancel", sanitizeTerminal(m.authorization.backend))
	return centerCard(m.deps.Theme, body, m.width, m.vp.Height())
}
