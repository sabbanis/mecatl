package ui

// surface.go is the ONE file the issue #555 Phase-2 surface interface owns: the
// `surface` interface an overlay implements (Resize/Render/HandleKey/HandleMsg/
// HandleWheel/Close) plus the shared `surfaceDeps` collaborator struct and the
// Model.surfaceDeps() builder. Migrating an overlay (soul is the proof) touches
// this file for the interface and its own file for the state/behaviour; the
// Model-side routing (view/update/builtins/selection) is the thin registration
// point. The structural gate (surface_arch_test.go) confines surface/soul
// vocabulary to surface.go + soul.go.

import (
	tea "charm.land/bubbletea/v2"

	"github.com/stacklok/mecatl/cmd/mecatui/client"
	"github.com/stacklok/mecatl/cmd/mecatui/theme"
)

// surface is an overlay that owns the conversation region while open: it
// renders a center-ready body, consumes keys/wheel/msgs, and holds its teardown.
// Model holds at most ONE (the modal surface field); nil-vs-set IS the active
// predicate. Implemented by value-state structs (soulState today) on POINTER
// receivers strictly so the Model can call them on the single instance the
// interface value holds and mutate it in place — no copy-back ceremony.
// Geometry is a state-setting method (Resize), mirroring how bubbletea's
// WindowSizeMsg arrives: parents place (the Model centers), surfaces size.
type surface interface {
	// Resize records the offered geometry (width, height of the conversation
	// region) on the surface's state. Render then reads it with NO geometry
	// params — the same one-way WindowSizeMsg flow bubbletea uses.
	Resize(width, height int)

	// Render returns the center-ready body and the regions it built in the SAME
	// layout pass, reading the geometry the LAST Resize recorded. Regions are
	// frame-relative; the parent offsets them to screen coordinates if it ever
	// hit-tests them. nil regions = not clickable. deps is rebuilt per call.
	Render(deps surfaceDeps) (body string, regions []ClickableRegion)

	// HandleKey consumes or passes a key press. handled=true means the surface
	// swallowed it (idle input never sees it). Close is driven INSIDE HandleKey
	// (esc self-closes): the returned closed flag tells the Model to nil the
	// field and re-focus the textarea.
	HandleKey(msg tea.KeyPressMsg, deps surfaceDeps) (cmd tea.Cmd, handled bool, closed bool)

	// HandleWheel consumes or passes a mouse wheel event. Overlays without
	// their own scroll surface return handled=false so the event falls through
	// to the conversation viewport (soul today: always false).
	HandleWheel(msg tea.MouseWheelMsg, deps surfaceDeps) (cmd tea.Cmd, handled bool)

	// HandleMsg consumes or passes a NON-input message: an RPC result
	// (client.SoulMsg), a timer tick, a status notice. The Model routes every
	// non-key/wheel Msg through the open modal BEFORE its own generic
	// reducer, so the surface owns its RPC-backed state and can be created
	// dynamically at Open with no pre-declared Model field. The surface
	// consumes (handled), kills (closed), or passes (handled=false); on closed
	// the Model nils the field + refocuses, exactly as the HandleKey closed
	// path.
	HandleMsg(msg tea.Msg, deps surfaceDeps) (cmd tea.Cmd, handled bool, closed bool)

	// Close tears the surface down with NO side effects beyond what the Model
	// owns: the state is zeroed by the caller (the Model), the returned cmd
	// re-focuses the textarea (today ta.Focus()). The surface holds no resource
	// the Model must clean up — rpc fetch results that arrive after close are
	// dropped at the reducer.
	Close(deps surfaceDeps) tea.Cmd
}

// surfaceDeps is the explicit list of what ANY surface may touch, built fresh
// per call by Model.surfaceDeps() and never stored. Fields are the superset of
// what the migrated surfaces need; each surface reads only its own subset.
// Mirrors approvalDeps (approval_surface.go). focusInput is the sanctioned way
// a surface reaches the Model's textarea without a *Model back-reference (the
// approvalDeps.sendApproval precedent).
type surfaceDeps struct {
	theme theme.Theme
	keys  keyMap              // for key.Matches
	marks helpKeys            // render hints (helpKeyMarkings)
	caps  client.Capabilities // capability-gated copy
	// focusInput returns the cmd the surface-was-closed path batches to re-focus
	// the prompt textarea (m.ta.Focus()). Built per call over &m so the closure
	// survives the value-Model copies.
	focusInput func() tea.Cmd
}

// surfaceDeps builds a surface's collaborators from the live Model. It is a
// pointer receiver so its focusInput closure can bluff past the Elm value-Model
// copies the same way approvalDeps() does (&m).
func (m *Model) surfaceDeps() surfaceDeps {
	return surfaceDeps{
		theme:      m.deps.Theme,
		keys:       m.keys,
		marks:      m.helpKeyMarkings(),
		caps:       m.caps,
		focusInput: func() tea.Cmd { return m.ta.Focus() },
	}
}
