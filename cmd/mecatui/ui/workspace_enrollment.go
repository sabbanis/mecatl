package ui

import (
	"context"
	"fmt"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
)

// connectAction is the shared "connect" literal for both the builtin/connection-mode
// name and the workspace-enrollment action, avoiding a repeated untyped string.
const connectAction = "connect"

// workspaceEnrollmentPollInterval is how often a pending bundle is silently
// rechecked while waiting for the browser-consent callback to land server-side.
// Nothing pushes that callback's arrival on its own — ConnectWorkspaceServices
// only OBSERVES a Connected transition when it happens to be called again, it
// does not learn of one spontaneously — so something has to keep asking. This
// ticker is that something; the push event (applyWorkspaceEnrollmentEvent)
// still exists to fan the eventual observation out live to every subscriber
// (including this tab, and any other attached client/session), not to replace
// the need to ask at all.
const workspaceEnrollmentPollInterval = 3 * time.Second

// workspaceEnrollmentPollTickMsg drives the poll above. enrollmentID pins it
// to the bundle it was scheduled for, so a tick from a superseded/resolved
// bundle (cancelled, connected, or replaced by a fresh /tools-connect) is
// silently dropped instead of restarting a chain nothing is waiting on.
type workspaceEnrollmentPollTickMsg struct{ enrollmentID string }

func workspaceEnrollmentPollTickCmd(enrollmentID string) tea.Cmd {
	return tea.Tick(workspaceEnrollmentPollInterval, func(time.Time) tea.Msg {
		return workspaceEnrollmentPollTickMsg{enrollmentID: enrollmentID}
	})
}

// applyWorkspaceEnrollmentPollTick fires a silent "check" recheck for the
// still-pending bundle the tick was scheduled for, then (via
// applyWorkspaceEnrollment's own pending branch) reschedules the next tick —
// the chain runs until the bundle resolves or is superseded. It never
// overlaps a request already in flight (m.enrollment.busy) or interactive
// action; the next reachable state simply reschedules from there instead.
func (m Model) applyWorkspaceEnrollmentPollTick(msg workspaceEnrollmentPollTickMsg) (tea.Model, tea.Cmd) {
	if m.enrollment.ID == "" || m.enrollment.ID != msg.enrollmentID {
		return m, nil
	}
	if m.enrollment.busy {
		// Something else (an interactive /tools-connect retry, or a previous
		// tick still in flight) owns the next observation; do not double up —
		// that call's own response reschedules the chain.
		return m, nil
	}
	m.enrollment.busy = true
	return m, workspaceEnrollmentCmd(m.deps.Ctx, m.deps.WorkspaceEnrollment, m.sessionID, m.enrollment.ID, "check")
}

// workspaceEnrollmentState is distinct from permission approval and per-tool MCP
// authorization. It retains only safe whole-bundle correlation and counts.
type workspaceEnrollmentState struct {
	ID               string
	Status           client.WorkspaceEnrollmentStatus
	RequiredServices uint32
	busy             bool
	err              string
}

type workspaceEnrollmentMsg struct {
	result             client.WorkspaceEnrollment
	action             string
	sessionID          string
	targetEnrollmentID string
	err                error
}

func workspaceEnrollmentCmd(ctx context.Context, control client.WorkspaceEnrollmentController, sessionID, enrollmentID, action string) tea.Cmd {
	return func() tea.Msg {
		var result client.WorkspaceEnrollment
		var err error
		switch action {
		case connectAction, "check":
			result, err = control.ConnectWorkspaceServices(ctx, sessionID)
		case "retry":
			result, err = control.RetryWorkspaceEnrollment(ctx, sessionID, enrollmentID)
		case "cancel":
			result, err = control.CancelWorkspaceEnrollment(ctx, sessionID, enrollmentID)
		default:
			err = fmt.Errorf("unknown workspace enrollment action")
		}
		return workspaceEnrollmentMsg{result: result, action: action, sessionID: sessionID, targetEnrollmentID: enrollmentID, err: err}
	}
}

// applyWorkspaceEnrollment reduces the direct RPC response from /tools-connect
// or /tools-cancel (workspaceEnrollmentCmd). The passive pending→resolved
// transition is handled separately by applyWorkspaceEnrollmentEvent, which
// this shares its Connected finalize path with — a busy /tools-connect call
// racing a push event for the SAME resolution both converge on
// finalizeWorkspaceEnrollmentConnected.
func (m Model) applyWorkspaceEnrollment(msg workspaceEnrollmentMsg) (tea.Model, tea.Cmd) {
	if msg.sessionID != m.sessionID || msg.action == connectAction && m.enrollment.ID != "" || msg.action != connectAction && msg.targetEnrollmentID != m.enrollment.ID {
		return m, nil
	}
	m.enrollment.busy = false
	if msg.err != nil {
		m.enrollment.err = "workspace enrollment failed"
		m.statusMsg = m.deps.Theme.Style("warning").Render(m.enrollment.err)
		return m, nil
	}
	// Strip presentation data at the reducer boundary. It is never retained in the
	// model, rendered, logged, or included in an error.
	presentationURL := msg.result.PresentationURL
	m.enrollment.ID = msg.result.ID
	m.enrollment.Status = msg.result.Status
	m.enrollment.RequiredServices = msg.result.RequiredServices
	m.enrollment.err = ""
	if msg.result.Status == client.WorkspaceEnrollmentConnected {
		return m.finalizeWorkspaceEnrollmentConnected()
	}
	if msg.result.Status == client.WorkspaceEnrollmentCancelled {
		m.enrollment = workspaceEnrollmentState{}
		m.workspaceEnrollmentNotice = ""
		m.statusMsg = "workspace services connection cancelled"
		return m, nil
	}
	// Pending: browser consent still required. workspaceEnrollmentPollTickCmd
	// keeps silently rechecking; the push event (applyWorkspaceEnrollmentEvent)
	// still fans the eventual resolution out live once ANY check observes it.
	m.workspaceEnrollmentNotice = "waiting for browser consent — you'll be notified when connected"
	pollCmd := workspaceEnrollmentPollTickCmd(m.enrollment.ID)
	if presentationURL != "" && m.deps.OpenURL != nil {
		return m, tea.Batch(pollCmd, func() tea.Msg {
			if err := m.deps.OpenURL(m.deps.Ctx, presentationURL); err != nil {
				return workspaceEnrollmentMsg{action: "open", err: err}
			}
			return nil
		})
	}
	return m, pollCmd
}

// applyWorkspaceEnrollmentEvent reduces a pushed EvWorkspaceEnrollmentResolved
// (client.WorkspaceEnrollmentEventMsg), mirroring applyMCPAuthorization: it is
// what lets the client learn a bundle's terminal resolution — most commonly
// the browser-consent callback landing — without a manual recheck. Exact-ID
// match only (mirrors applyMCPAuthorization's authorizationID check): an
// empty m.enrollment.ID means nothing is locally tracked, so a stray/replayed
// event is a no-op rather than acting on state nothing is waiting for.
func (m Model) applyWorkspaceEnrollmentEvent(msg client.WorkspaceEnrollmentEventMsg) (tea.Model, tea.Cmd) {
	if m.enrollment.ID == "" || m.enrollment.ID != msg.EnrollmentID {
		return m, nil
	}
	if client.WorkspaceEnrollmentStatus(msg.Status) == client.WorkspaceEnrollmentConnected {
		return m.finalizeWorkspaceEnrollmentConnected()
	}
	m.enrollment = workspaceEnrollmentState{}
	m.workspaceEnrollmentNotice = ""
	m.statusMsg = "workspace services connection " + msg.Status
	return m, nil
}

// finalizeWorkspaceEnrollmentConnected is the shared success path for both
// reducers above: clear enrollment/notice state, focus the prompt (a no-op if
// it was never blurred — the non-blocking design keeps it focused throughout,
// but this stays defensive), and fire any prompt that was queued waiting for
// this exact resolution.
func (m Model) finalizeWorkspaceEnrollmentConnected() (tea.Model, tea.Cmd) {
	m.enrollment = workspaceEnrollmentState{}
	m.workspaceEnrollmentNotice = ""
	focusCmd := m.prompt.Focus()
	m.statusMsg = "workspace services connected"
	cmd := tea.Batch(focusCmd, (&m).armLiveFeed())
	if p := strings.TrimSpace(m.pendingInitialPrompt); p != "" {
		m.pendingInitialPrompt = ""
		m.prompt.Rewrite(p)
		mm, submitCmd := m.submitPrompt()
		return mm, tea.Batch(cmd, submitCmd)
	}
	return m, cmd
}

// friendlyWorkspaceEnrollmentRejection rewrites the raw server text for the one
// FailedPrecondition rejection startRunContent returns when a prompt is
// attempted before bundled workspace services are connected
// ("workspace services must be connected before prompting",
// internal/adapter/server/service.go) into an actionable message naming the
// slash command that resolves it. Any other error string passes through
// unchanged — this is deliberately a narrow substring match, not a general
// error classifier (see classifyMCPErr in cmd/mecatui/client/mcp.go for that
// shape in a different domain), since it exists only to fill the one gap
// where a model-facing gate had no model-visible way out.
func friendlyWorkspaceEnrollmentRejection(raw string) string {
	if isWorkspaceEnrollmentRejection(raw) {
		return "workspace services aren't connected — run /tools-connect to enable protected tools before prompting"
	}
	return raw
}

// isWorkspaceEnrollmentRejection reports whether raw is the same server rejection
// friendlyWorkspaceEnrollmentRejection rewrites — shared so a StreamErrMsg handler
// can decide whether to stash the just-rejected prompt for auto-resubmit, not just
// reword the message.
func isWorkspaceEnrollmentRejection(raw string) bool {
	return strings.Contains(raw, "workspace services must be connected before prompting")
}
