package ui

import (
	"context"
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
