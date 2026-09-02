package ui

import (
	"context"
	"testing"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
)

// TestDetachedSubmitGatedOnConnectModeAndCapability asserts the client-side
// submit fork: detachedSubmitEnabled() is true ONLY on connect-mode AND
// ServerCapabilities.detached_runs. Embedded mode (even with the capability
// echoed) stays attached. A non-detached-capable server (older server, or
// --detached-runs off) stays attached, byte-identical to the
// pre-detached-runs build.
func TestDetachedSubmitGatedOnConnectModeAndCapability(t *testing.T) {
	capsOn := client.Capabilities{DetachedRuns: true}
	capsOff := client.Capabilities{}

	// connect + detached_runs → detached.
	if !detachedGateFor("connect", capsOn) {
		t.Fatal("connect + detached_runs = false, want true")
	}
	// embedded + detached_runs → attached (embedded: Ctrl+C kills the
	// process; detach is meaningless).
	if detachedGateFor("embedded", capsOn) {
		t.Fatal("embedded + detached_runs = true, want false")
	}
	// connect + !detached_runs → attached (today's cancel-on-Ctrl+C).
	if detachedGateFor("connect", capsOff) {
		t.Fatal("connect + !detached_runs = true, want false")
	}
	// embedded + !detached_runs → attached.
	if detachedGateFor("embedded", capsOff) {
		t.Fatal("embedded + !detached_runs = true, want false")
	}
}

// detachedGateFor is the test seam for the detachedSubmitEnabled() logic
// without building a Model.
func detachedGateFor(connectionMode string, caps client.Capabilities) bool {
	m := newTestModelFromDeps(Deps{ConnectionMode: connectionMode})
	mm, _ := m.Update(client.SessionReadyMsg{SessionID: "sess-test-0001", Capabilities: caps})
	mm2 := mm.(Model)
	return mm2.detachedSubmitEnabled()
}

// TestDetachedSubmitSubmitMarksPendingWithConnect asserts AC4.5 at the ui:
// when detachedSubmitEnabled() is true, submitPrompt sets pendingDetachedSubmit
// = true (it marks the in-flight detached submit so the ack/close path flips
// into phaseFollowing). When false (embedded), pendingDetachedSubmit stays
// false and the legacy path runs.
func TestDetachedSubmitSubmitMarksPendingWithConnect(t *testing.T) {
	conv := &fakeConv{recv: &fakeRecver{gate: make(chan struct{})}, send: &fakeSender{}, caps: client.Capabilities{DetachedRuns: true}}
	m := newDetachedSubmitModel(t, conv, "connect", client.Capabilities{DetachedRuns: true})
	m.prompt.Rewrite("run something")

	mm, cmd := m.submitPrompt()
	m = mm.(Model)
	if !m.pendingDetachedSubmit {
		t.Fatal("pendingDetachedSubmit = false after detached submit, want true")
	}
	if m.phase != phaseRunning {
		t.Fatalf("phase = %v, want phaseRunning until the run.detached ack lands", m.phase)
	}
	runBatchLeaves(cmd) // arm the reader goroutine; no Nil guard on cmd.

	// An embedded-mode submit (even with detached_runs) does NOT mark pending.
	conv2 := &fakeConv{recv: &fakeRecver{gate: make(chan struct{})}, send: &fakeSender{}, caps: client.Capabilities{DetachedRuns: true}}
	m2 := newDetachedSubmitModel(t, conv2, "embedded", client.Capabilities{DetachedRuns: true})
	m2.prompt.Rewrite("run something")
	if m2.pendingDetachedSubmit {
		t.Fatal("pendingDetachedSubmit = true on embedded submit, want false")
	}
}

// newDetachedSubmitModel builds a Model for the detached-fork tests. Session is
// a fake (the Sessions/etc. seams are nil), Conv is the same fake, Workspace is
// the fake's registered workspace, Mode is "default", Model is "mock-model",
// Ctx background, NoAltScreen true, ConnectionMode + caps as given.
func newDetachedSubmitModel(t *testing.T, conv *fakeConv, connectionMode string, caps client.Capabilities, extras ...func(*Deps)) Model {
	t.Helper()
	deps := Deps{
		Session:        conv,
		Conv:           conv,
		Watch:          &fakeWatchStreamer{script: reattachScript()}, // the reattach-path watch fake
		Theme:          theme.New("aztec", theme.AztecPalette()),
		Workspace:      "/workspace",
		Mode:           "default",
		Model:          "mock-model",
		Ctx:            context.Background(),
		NoAltScreen:    true,
		ConnectionMode: connectionMode,
	}
	for _, extra := range extras {
		extra(&deps)
	}
	m := newTestModelFromDeps(deps)
	// Seed caps via SessionReadyMsg so upstream tests exercise the flow rather
	// than the private field (applySessionReady overwrites m.caps from the msg).
	mm, _ := m.Update(client.SessionReadyMsg{SessionID: "sess-test-0001", Capabilities: caps})
	return mm.(Model)
}

// TestDetachedRunRunDetachedAckTransitions asserts AC4.5/the loop: a
// RunDetachedMsg (the server's `run.detached` ack) flips the ui into
// phaseFollowing from a pending detached submit (no endRun), and arms the
// watch. The follow state (DetachSignal) is marked so Ctrl+C detaches.
func TestDetachedRunRunDetachedAckTransitions(t *testing.T) {
	signal := &DetachSignalState{}
	conv := &fakeConv{recv: &fakeRecver{gate: make(chan struct{})}, send: &fakeSender{}, caps: client.Capabilities{DetachedRuns: true}}
	m := newDetachedSubmitModel(t, conv, "connect", client.Capabilities{DetachedRuns: true},
		func(d *Deps) { d.DetachSignal = signal })
	m.prompt.Rewrite("run something")
	mm, _ := m.submitPrompt()
	m = mm.(Model)

	if !m.pendingDetachedSubmit {
		t.Fatal("precondition: pendingDetachedSubmit should be true before the ack")
	}
	mm, cmd := m.applyDetachedAck()
	m = mm.(Model)
	defer (&m).disarmWatch()

	if m.phase != phaseFollowing {
		t.Fatalf("phase after RunDetachedMsg = %v, want phaseFollowing", m.phase)
	}
	if !m.detached {
		t.Fatal("detached = false after RunDetachedMsg, want true")
	}
	if m.pendingDetachedSubmit {
		t.Fatal("pendingDetachedSubmit = true after applyDetachedAck, want cleared")
	}
	if m.watchCh == nil {
		t.Fatal("watchCh should be armed after applyDetachedAck")
	}
	live, active := signal.Following()
	if !active || live != "sess-test-0001" {
		t.Fatalf("DetachSignal.Following = (%q, %v), want sess-test-0001+active", live, active)
	}
	_ = cmd
}

// TestDetachedRunPendingCloseFallback asserts the defensive StreamClosedMsg
// fallback: a detached Path closes between openRun and the ack (EOF →
// StreamClosedMsg) with pendingDetachedSubmit still marked — the fallback
// flips into phaseFollowing via applyDetachedAck rather than endRun("closed").
func TestDetachedRunPendingCloseFallback(t *testing.T) {
	signal := &DetachSignalState{}
	conv := &fakeConv{recv: &fakeRecver{gate: make(chan struct{})}, send: &fakeSender{}, caps: client.Capabilities{DetachedRuns: true}}
	m := newDetachedSubmitModel(t, conv, "connect", client.Capabilities{DetachedRuns: true},
		func(d *Deps) { d.DetachSignal = signal })
	m.prompt.Rewrite("run something")
	mm, _ := m.submitPrompt()
	m = mm.(Model)
	if !m.pendingDetachedSubmit {
		t.Fatal("precondition: pendingDetachedSubmit should be true before the close")
	}

	// Bring a StreamClosedMsg with pending true → fallback → phaseFollowing.
	mm, _, handled := m.updateLifecycle(client.StreamClosedMsg{})
	m = mm.(Model)
	if !handled {
		t.Fatal("updateLifecycle(StreamClosedMsg) should handle")
	}
	defer (&m).disarmWatch()

	if m.phase != phaseFollowing {
		t.Fatalf("phase after closing pending detached = %v, want phaseFollowing", m.phase)
	}
	if !m.detached {
		t.Fatal("detached = false after closing pending, want true")
	}
	live, active := signal.Following()
	if !active || live != "sess-test-0001" {
		t.Fatalf("DetachSignal.Following = (%q, %v), want sess-test-0001+active", live, active)
	}
}

// TestDetachedRunNonDetachingCloseIsGracefulCancel asserts AC4.3' sibling: a
// StreamClosedMsg after a NON-detached (attached) run AND no pending detach is
// the graceful-cancel path — the run ends with stop "closed" and the ui
// returns to phaseIdle. Asserts the fallback doesn't misfire.
func TestDetachedRunNonDetachingCloseIsGracefulCancel(t *testing.T) {
	conv := &fakeConv{recv: &fakeRecver{gate: make(chan struct{})}, send: &fakeSender{}, caps: client.Capabilities{}}
	m := newDetachedSubmitModel(t, conv, "connect", client.Capabilities{})
	m.prompt.Rewrite("run something")
	mm, _ := m.submitPrompt()
	m = mm.(Model)

	if m.pendingDetachedSubmit {
		t.Fatal("precondition: pendingDetachedSubmit should be false for a non-detached submit")
	}
	// StreamClosedMsg → graceful cancel → phaseIdle.
	mm, _, handled := m.updateLifecycle(client.StreamClosedMsg{})
	m = mm.(Model)
	if !handled {
		t.Fatal("updateLifecycle(StreamClosedMsg) should handle")
	}

	if m.phase != phaseIdle {
		t.Fatalf("phase after attached close = %v, want phaseIdle (graceful cancel)", m.phase)
	}
	if m.detached {
		t.Fatal("detached = true after attached close, want false (avoid misfire)")
	}
}
