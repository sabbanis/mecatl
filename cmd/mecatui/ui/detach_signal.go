package ui

import "sync"

// DetachSignalState is the main-owned bridge between the ui (which knows when a
// detached run is being followed, and the session it follows) and the process
// signal handler (which must decide detach-vs-cancel on OS Ctrl+C, ADR 0278
// Scenario 4). main creates it BEFORE the Bubble Tea program starts and passes
// it to BOTH the ui Deps and setupSignalHandler; the ui flips it as it enters /
// leaves phaseFollowing, so the signal handler reads the CURRENT follow state.
// nil on Deps cleanly disables the signal-handler detach affordance (the
// graceful-cancel path, byte-identical to the pre-detached-runs build).
type DetachSignalState struct {
	mu sync.Mutex
	// active is true while the ui is FOLLOWING a detached run (phaseFollowing):
	// the signal handler's first-Ctrl+C-then-detach branch only fires on it.
	active bool
	// sessionID is the session the detached run belongs to; the second-Ctrl+C
	// cancel targets it.
	sessionID string
	// cancel is the main-wired best-effort control-only Converse cancel
	// (Cancel{SessionId} on a fresh stream); set at startup, cleared never.
	cancel func()
}

// Follow marks the ui as following a detached run on sessionID. The guard filters
// out stale IDs once the ui moves to a different session/run.
func (d *DetachSignalState) Follow(sessionID string) {
	if d == nil {
		return
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	d.active = true
	d.sessionID = sessionID
}

// Clear unmarks the follow (the run went terminal, or the session switched /
// reset). Idempotent.
func (d *DetachSignalState) Clear() {
	if d == nil {
		return
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	d.active = false
	d.sessionID = ""
}

// Following reports whether a detached run is currently being followed, and the
// session it follows.
func (d *DetachSignalState) Following() (sessionID string, active bool) {
	if d == nil {
		return "", false
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.sessionID, d.active
}

// Cancel returns the wired control-only cancel closure.
func (d *DetachSignalState) Cancel() func() {
	if d == nil {
		return nil
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.cancel
}

// SetCancel wires the main-owned cancel closure once (the ui never writes it).
func (d *DetachSignalState) SetCancel(cancel func()) {
	if d == nil {
		return
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.cancel == nil {
		d.cancel = cancel
	}
}
