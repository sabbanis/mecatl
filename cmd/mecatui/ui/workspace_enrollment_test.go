package ui

import (
	"context"
	"errors"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
)

// TestWorkspaceEnrollmentIsNonBlocking covers the non-blocking redesign
// (WORKSPACE-ENROLLMENT-UX-AND-RACE.md §3): opening a session whose bundled
// workspace services are not yet connected must NOT force a modal or disable
// the prompt — only a persistent footer notice, plus the /tools-connect and
// /tools-cancel builtins, replace the old forced [c]/[r]/[x] modal.
func TestWorkspaceEnrollmentIsNonBlocking(t *testing.T) {
	control := &workspaceEnrollmentControlFake{connect: client.WorkspaceEnrollment{
		ID: "bundle-1", Status: client.WorkspaceEnrollmentPending, RequiredServices: 2,
		PresentationURL: "https://provider-private.example/callback?token=token-canary",
	}}
	m := New(Deps{Ctx: context.Background(), WorkspaceEnrollment: control})
	m = applyAll(m, tea.WindowSizeMsg{Width: 100, Height: 30}, client.SessionReadyMsg{
		SessionID: "session-1", Capabilities: client.Capabilities{WorkspaceEnrollment: true},
	})

	if m.phase != phaseIdle || m.modal != nil {
		t.Fatalf("opening a session requiring enrollment must stay idle with no modal: phase=%v modal=%T", m.phase, m.modal)
	}
	if !strings.Contains(m.workspaceEnrollmentNotice, "/tools-connect") {
		t.Fatalf("workspaceEnrollmentNotice = %q, want it to point at /tools-connect", m.workspaceEnrollmentNotice)
	}
	if got := stripANSIstr(m.idleFooterLeft()); !strings.Contains(got, "/tools-connect") {
		t.Fatalf("footer-left = %q, want the workspace-enrollment notice rendered", got)
	}

	mm, cmd := m.runToolsConnect()
	m = mm.(Model)
	if cmd == nil {
		t.Fatal("/tools-connect returned no command")
	}
	m = applyAll(m, cmd())
	if control.connectCalls != 1 || m.enrollment.ID != "bundle-1" {
		t.Fatalf("connect calls/state = %d/%+v", control.connectCalls, m.enrollment)
	}
	if got := stripANSIstr(m.idleFooterLeft()); !strings.Contains(got, "waiting for browser consent") {
		t.Fatalf("footer-left after a pending connect = %q, want the waiting-for-consent notice", got)
	}
	if got := stripANSIstr(m.idleFooterLeft()); strings.Contains(got, "https://") || strings.Contains(got, "provider-private") || strings.Contains(got, "token-canary") {
		t.Fatalf("footer rendered private presentation data: %s", got)
	}

	// The whole point of the redesign: prompt submission is NOT blocked
	// client-side. The server's own fail-closed startRunContent guard is what
	// protects an un-admitted catalogue; nothing here should short-circuit it.
	if m.phase != phaseIdle {
		t.Fatalf("session phase after a pending connect = %v, want idle (prompt stays usable)", m.phase)
	}
}

// TestWorkspaceEnrollmentPendingReschedulesPoll pins the mechanism the push
// event alone cannot provide: nothing pushes the browser-callback landing on
// its own — ConnectWorkspaceServices only OBSERVES a Connected transition
// when it happens to be called again. A pending result must therefore
// schedule a recheck (workspaceEnrollmentPollTickCmd), and each subsequent
// pending observation must reschedule the next one, or the "you'll be
// notified when connected" promise silently never comes true.
func TestWorkspaceEnrollmentPendingReschedulesPoll(t *testing.T) {
	control := &workspaceEnrollmentControlFake{connect: client.WorkspaceEnrollment{
		ID: "bundle-1", Status: client.WorkspaceEnrollmentPending, RequiredServices: 1,
	}}
	m, _ := builtinDispatchModel(t, client.Capabilities{WorkspaceEnrollment: true}, false)
	m.deps.WorkspaceEnrollment = control

	mm, cmd := m.runToolsConnect()
	m = mm.(Model)
	if cmd == nil {
		t.Fatal("/tools-connect returned no command")
	}
	m = applyAll(m, cmd())
	if m.enrollment.ID != "bundle-1" || m.enrollment.busy {
		t.Fatalf("after the first pending response: enrollment=%+v", m.enrollment)
	}

	// The browser-consent callback "lands" server-side between polls; nothing
	// notifies this client of that directly -- only a recheck observes it.
	control.connect = client.WorkspaceEnrollment{ID: "bundle-1", Status: client.WorkspaceEnrollmentConnected}
	mm, tickCmd := m.applyWorkspaceEnrollmentPollTick(workspaceEnrollmentPollTickMsg{enrollmentID: "bundle-1"})
	m = mm.(Model)
	if tickCmd == nil {
		t.Fatal("poll tick for the pending bundle produced no recheck command")
	}
	m = applyAll(m, tickCmd())
	if control.connectCalls != 2 {
		t.Fatalf("connectCalls = %d, want 2 (the initial connect + the poll recheck)", control.connectCalls)
	}
	if m.enrollment.ID != "" {
		t.Fatalf("poll-observed Connected did not finalize: enrollment=%+v", m.enrollment)
	}

	// A tick for a superseded/resolved bundle (this one already finalized)
	// must be a silent no-op, not restart a chain nothing is waiting on.
	stale, staleCmd := m.applyWorkspaceEnrollmentPollTick(workspaceEnrollmentPollTickMsg{enrollmentID: "bundle-1"})
	if staleCmd != nil || stale.(Model).enrollment.ID != "" {
		t.Fatal("stale poll tick was not a no-op")
	}
}

// TestWorkspaceEnrollmentEventAutoResolves covers the pushed
// EvWorkspaceEnrollmentResolved event (Part B): a matching Connected event must
// auto-finalize (clear enrollment/notice, fire any queued initial prompt)
// without a manual recheck, and a mismatched/foreign event must be a no-op.
func TestWorkspaceEnrollmentEventAutoResolves(t *testing.T) {
	m, _ := builtinDispatchModel(t, client.Capabilities{WorkspaceEnrollment: true}, false)
	m.deps.WorkspaceEnrollment = &workspaceEnrollmentControlFake{}
	m.enrollment = workspaceEnrollmentState{ID: "bundle-1"}
	m.workspaceEnrollmentNotice = "waiting for browser consent — you'll be notified when connected"
	m.pendingInitialPrompt = "list my open pull requests"

	// A foreign/mismatched enrollment ID must not touch state waiting on a
	// DIFFERENT bundle.
	stale, staleCmd := m.applyWorkspaceEnrollmentEvent(client.WorkspaceEnrollmentEventMsg{
		EnrollmentID: "bundle-2", Status: "connected",
	})
	staleModel := stale.(Model)
	if staleCmd != nil || staleModel.enrollment.ID != "bundle-1" || staleModel.workspaceEnrollmentNotice == "" {
		t.Fatalf("foreign enrollment event escaped correlation gate: enrollment=%+v notice=%q", staleModel.enrollment, staleModel.workspaceEnrollmentNotice)
	}

	mm, cmd := m.applyWorkspaceEnrollmentEvent(client.WorkspaceEnrollmentEventMsg{
		EnrollmentID: "bundle-1", Backends: []string{"github"}, Status: "connected",
	})
	m = mm.(Model)
	if m.enrollment.ID != "" || m.workspaceEnrollmentNotice != "" {
		t.Fatalf("connected event did not clear enrollment/notice: enrollment=%+v notice=%q", m.enrollment, m.workspaceEnrollmentNotice)
	}
	if m.pendingInitialPrompt != "" {
		t.Fatalf("pendingInitialPrompt not consumed on auto-resolve: %q", m.pendingInitialPrompt)
	}
	if cmd == nil {
		t.Fatal("connected event returned no command (expected the queued prompt to fire)")
	}
}

// TestFriendlyWorkspaceEnrollmentRejection covers the actionable-message
// classifier (Part C.5): the one server rejection a model/user can actually
// hit before connecting gets a message naming the way out; anything else
// passes through unchanged.
func TestFriendlyWorkspaceEnrollmentRejection(t *testing.T) {
	raw := "rpc error: code = FailedPrecondition desc = workspace services must be connected before prompting"
	got := friendlyWorkspaceEnrollmentRejection(raw)
	if !strings.Contains(got, "/tools-connect") {
		t.Fatalf("friendlyWorkspaceEnrollmentRejection(%q) = %q, want a /tools-connect pointer", raw, got)
	}
	other := "some unrelated failure"
	if got := friendlyWorkspaceEnrollmentRejection(other); got != other {
		t.Fatalf("friendlyWorkspaceEnrollmentRejection(%q) = %q, want it unchanged", other, got)
	}
}

// TestStreamErrMsgAppliesWorkspaceEnrollmentRejection pins the third real call site
// (client.StreamErrMsg's generic transport-error fallback in updateStreamEvent) that
// a live qualification run found unwired: the rewrite was applied at the stream-open
// failure and terminal-ResultMsg sites, but a FailedPrecondition surfacing as a
// mid-stream StreamErrMsg (e.g. a fresh session's very first prompt, rejected before
// any run starts) still showed the raw server message with no /tools-connect pointer.
func TestStreamErrMsgAppliesWorkspaceEnrollmentRejection(t *testing.T) {
	m, _ := newQueueModel(t)
	mm, _ := m.Update(client.StreamErrMsg{Err: errors.New("rpc error: code = FailedPrecondition desc = server: failed precondition: workspace services must be connected before prompting")})
	m = mm.(Model)
	if len(m.conv.blocks) == 0 {
		t.Fatal("expected an error block after StreamErrMsg")
	}
	got := m.conv.blocks[len(m.conv.blocks)-1].raw
	if !strings.Contains(got, "/tools-connect") {
		t.Fatalf("stream error block = %q, want a /tools-connect pointer", got)
	}
}

// TestWorkspaceEnrollmentRejectionAutoResubmits pins the full round trip a live
// qualification run found missing: a rejected prompt must not be silently dropped.
// Submitting a prompt before workspace services connect stashes the exact text
// (lastSubmittedPromptText), the StreamErrMsg rejection hands it to
// pendingInitialPrompt, and the connected event fires it automatically — the user
// should never have to retype it.
func TestWorkspaceEnrollmentRejectionAutoResubmits(t *testing.T) {
	m, conv := newQueueModel(t)
	m = typeText(t, m, "list PRs")
	mm, _ := m.submitPrompt()
	m = mm.(Model)
	if m.lastSubmittedPromptText != "list PRs" {
		t.Fatalf("lastSubmittedPromptText = %q, want %q", m.lastSubmittedPromptText, "list PRs")
	}

	mm, _ = m.Update(client.StreamErrMsg{Err: errors.New("rpc error: code = FailedPrecondition desc = server: failed precondition: workspace services must be connected before prompting")})
	m = mm.(Model)
	if m.pendingInitialPrompt != "list PRs" {
		t.Fatalf("pendingInitialPrompt = %q after rejection, want %q", m.pendingInitialPrompt, "list PRs")
	}
	if m.lastSubmittedPromptText != "" {
		t.Fatalf("lastSubmittedPromptText not cleared after handoff: %q", m.lastSubmittedPromptText)
	}

	m.enrollment.ID = "bundle-1"
	mm, cmd := m.applyWorkspaceEnrollmentEvent(client.WorkspaceEnrollmentEventMsg{
		EnrollmentID: "bundle-1", Backends: []string{"github"}, Status: "connected",
	})
	m = mm.(Model)
	if m.pendingInitialPrompt != "" {
		t.Fatalf("pendingInitialPrompt not consumed on auto-resolve: %q", m.pendingInitialPrompt)
	}
	if cmd == nil {
		t.Fatal("connected event returned no command (expected the stashed prompt to resubmit)")
	}
	runBatchLeaves(cmd)
	got := promptTexts(conv.send)
	if len(got) != 1 || got[0] != "list PRs" {
		t.Fatalf("resubmitted prompt frames = %v, want [\"list PRs\"]", got)
	}
}

type workspaceEnrollmentControlFake struct {
	connect      client.WorkspaceEnrollment
	connectCalls int
}

func (f *workspaceEnrollmentControlFake) ConnectWorkspaceServices(context.Context, string) (client.WorkspaceEnrollment, error) {
	f.connectCalls++
	return f.connect, nil
}

func (*workspaceEnrollmentControlFake) RetryWorkspaceEnrollment(context.Context, string, string) (client.WorkspaceEnrollment, error) {
	return client.WorkspaceEnrollment{}, nil
}

func (*workspaceEnrollmentControlFake) CancelWorkspaceEnrollment(context.Context, string, string) (client.WorkspaceEnrollment, error) {
	return client.WorkspaceEnrollment{}, nil
}
