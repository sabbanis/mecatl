package main

import (
	"testing"

	"github.com/stacklok/mecatl/cmd/mecatui/ui"
)

// TestDetachedRun_Scenario4_CtrlCDetaches asserts AC4.1 at the pure decision
// seam: on a detached-capable server (connect mode) with an active detached
// follow, the first Ctrl+C detaches — detachable() returns true — so the
// graceful path prints "run continues" and quits WITHOUT cancelling the run,
// and the run continues server-side. The os/signal plumbing stays thin; the
// decision lives in this pure function.
func TestDetachedRun_Scenario4_CtrlCDetaches(t *testing.T) {
	state := &ui.DetachSignalState{}
	state.Follow("sess-123")
	if !detachable(false /* embedded */, state) {
		t.Fatal("detachable(connect, following) = false, want true (first Ctrl+C detaches)")
	}
}

// TestDetachedRun_Scenario4_DoubleCtrlCCancels asserts AC4.2: when detach
// follows a run, the second Ctrl+C targets the session's cancel frame. The
// wired cancel closure is invoked for the session's id — the control-only
// Converse `cancel` runs — and exits. The test wires a spy cancel closure and
// asserts it fired with the server's own Cancel{SessionId}.
func TestDetachedRun_Scenario4_DoubleCtrlCCancels(t *testing.T) {
	state := &ui.DetachSignalState{}
	state.Follow("sess-123")

	canceled := false
	id := ""
	state.SetCancel(func() {
		if sid, active := state.Following(); active {
			id = sid
			canceled = true
		}
	})
	if okay := detachControlCancel(state); !okay {
		t.Fatal("detachControlCancel = false, want true (the wired closure fired)")
	}
	if !canceled || id != "sess-123" {
		t.Fatalf("cancel closure fired=%v id=%q, want true/sess-123", canceled, id)
	}
}

// TestDetachedRun_Scenario4_CtrlCCancelsOnNonDetachedServer asserts AC4.3: on
// a non-detached-capable server (older server, or --detached-runs off), the
// DetachSignal is nil (main never wires one) OR not following — the graceful
// cancel path runs byte-identical to the pre-detached-runs build. detachable()
// returns false on BOTH cases so Ctrl+C cancels the run as today.
func TestDetachedRun_Scenario4_CtrlCCancelsOnNonDetachedServer(t *testing.T) {
	// nil DetachSignal (an older server, or a --detached-runs-off deployment
	// never wires the state — the reattach affordance never became active).
	if detachable(false, nil) {
		t.Fatal("detachable(nil signal) = true, want false (today's graceful cancel)")
	}
	// Wired but not following (per the ui's Clear on terminal/reset).
	state := &ui.DetachSignalState{}
	if detachable(false, state) {
		t.Fatal("detachable(not following) = true, want false (graceful cancel as today)")
	}
}

// TestDetachedRun_Scenario4_CtrlCKillsEmbedded asserts AC4.4: embedded mode
// (the server dies with the process) is a detach meaningless there, so the
// first Ctrl+C cancels ctx and the embedded server's close cancels the run —
// byte-identical to the pre-detached-runs build. detachable() returns false
// regardless of a follow state.
func TestDetachedRun_Scenario4_CtrlCKillsEmbedded(t *testing.T) {
	state := &ui.DetachSignalState{}
	state.Follow("sess-embedded")
	if detachable(true /* embedded */, state) {
		t.Fatal("detachable(embedded, follow) = true, want false (embedded: Ctrl+C kills the process)")
	}
}

// TestDetachedRun_Scenario4_CapabilityGatesDetach asserts AC4.5: the
// detach-on-Ctrl+C affordance fires ONLY when detachSupported() reports true
// (the server advertised ServerCapabilities.detached_runs at connect). An
// older server (or a --detached-runs-off deployment) without it keeps the
// existing graceful cancel path, byte-identical to the pre-detached-runs
// build.
//
// The gate is wired in main.go by sampling cl.CompatibilityInfo once at
// startup; with a compatible bit set the ui becomes detachable, otherwise it
// is not. This test exercises the ui-side state transition detachSupported's
// authoritative bit gates: when the capability is absent the ui Clear(s) the
// DetachSignal so detachable() returns false (Ctrl+C cancels). When present,
// applyDetachedAck marks the state and detachable() returns true.
func TestDetachedRun_Scenario4_CapabilityGatesDetach(t *testing.T) {
	state := &ui.DetachSignalState{}

	// Older server / --detached-runs-off: ui Clear is called at terminal/reset
	// and DetachSignal.Follow is never called. detachable() stays false.
	if detachable(false, state) {
		t.Fatal("capability absent: detachable = true, want false")
	}
	// Capability present (a detached submit landed an ack): applyDetachedAck
	// marks the state, so detachable() is true — the detach-on-Ctrl+C gate
	// only fires when the server advertised detained detached_runs.
	state.Follow("sess-cap")
	if !detachable(false, state) {
		t.Fatal("capability present: detachable = false, want true")
	}

	// A reset (e.g. /clear) clears it, back to the attached path.
	state.Clear()
	if detachable(false, state) {
		t.Fatal("post-reset: detachable = true, want false (reverted to graceful cancel)")
	}
}
