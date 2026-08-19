# Surface migration — the general template (issue #555 Phase 2)

**Status:** plan (no production code). **Scope:** the GENERAL migration template
for moving a `cmd/mecatui/ui` overlay onto the `surface` interface. Soul is the
FIRST migrator (the proof-of-pattern that pins the interface); section 6 is the
checklist for the rest.

Issue #555 describes "ADR 0108" as the surface-migration ADR; that is a stale
reference. `docs/adr/0108-on-demand-logical-skill-assets.md` is the skill-assets ADR.
The stale citation needs a docs fix; it is deliberately **not** fixed here.

## Binding decisions (already made — do not reopen)

1. **One surface at a time, no stack.** `closeOverlays`-style mutual exclusion already
   holds (each overlay's `view != None` arm is exclusive; opening one closes the
   rest). Model holds ONE optional modal surface, not a stack. The approval ask queue
   is asks-behind-one-approval-surface. Stack/tiling/focus-tree is Phase 3.
2. **No stored pointer-to-surface field on Model; surface state is created
   dynamically at Open.** The Model has NO permanent `m.soul`-style pre-declared
   tombstone field. The surface's state (`soulState`) is constructed at the Open
   transition and lives ONLY inside the ONE `modal surface` interface field. A
   pointer receiver is used per-call on that interface value (the `&m.approval`
   idiom) so `HandleKey`/`HandleMsg` can mutate it, but no `*soulState` is ever a
   Model field. Mutations happen through the per-call pointer; there is no copy-back
   ceremony (the interface already holds the one instance).
3. **Explicit deps struct, not a host interface.** Mirror `approvalDeps`
   (`cmd/mecatui/ui/approval_surface.go:32-83`): ONE shared `surfaceDeps` is built
   fresh per call by a Model method and holds ONLY what surfaces may touch. No
   `surfaceHost` interface. (Section 1 below names it `surfaceDeps`, not a
   per-surface `soulDeps`.)
4. **"Surfaces size, parents place."** The surface knows its offered geometry
   (width/height) but NOT its screen position. `Model`/view.go centres the returned
   body today via `centerCard`. Region coordinates are frame-relative; the parent
   offsets to screen coords.
5. **Render returns body + regions together (measure-once).** The layout pass that
   builds the body also emits hit-test regions so render and hit-test never drift —
   the invariant `permissionModalBodyParts` owns today. For soul, regions are empty
   (read-only, no clickable). Do NOT split into `Render()` + `Regions()` that could
   re-derive layout.
6. **Elm/TEA discipline is preserved.** Value-receiver `Update`, `tea.Cmd` for
   effects, `handled bool` for key consumption — today's `onSoulKey` shape is the
   template. The surface has NO `tea.Model`-returning method; the Model stays the
   `tea.Model`.
7. **Message routing is surface-owned, consume/kill/defer.** RPC/stream results
   (`client.SoulMsg` et al.) are routed through the surface's `HandleMsg`, NOT a
   per-overlay switch in update.go. The surface consumes (handled), kills
   (close/defer), or passes (handled=false). This replaces the Model-side
   `updateSoulMsg`-style reducer; it is what lets surface state be created
   dynamically at Open with no pre-declared field, and it generalises to dynamic
   views.

## 1. The `surface` interface

New file `cmd/mecatui/ui/surface.go`. All methods take the deps struct by value;
the receiver is the surface's own state (value semantics — the method set is
declared on a POINTER receiver so `m.modal.HandleKey(...)` can mutate the
instance the interface holds,
mirroring `approvalState.onApprovalKey`'s `*approvalState` receiver; the state
itself still lives on Model as a value field, copied on assignment back).

```go
package ui

// surface is an overlay that owns the conversation region while open: it
// renders a centered card, consumes keys/wheel, and holds its teardown.
// Model holds at most ONE (modal surface field); nil-vs-set IS the
// open predicate. Implemented by value-state structs (soulState today).
// Methods are on a pointer receiver strictly so the Model can call them on
// its value-embedded state field without copying it out.
type surface interface {
    // Render returns the centered body and the regions it built in the SAME
    // layout pass, given the offered geometry (width, height of the
    // conversation region). Regions are frame-relative; the parent offsets
    // them to screen coordinates if it ever hit-tests them. nil regions =
    // not clickable. deps is rebuilt per call.
    Render(deps surfaceDeps, width, height int) (body string, regions []ClickableRegion)

    // HandleKey consumes or passes a key press. handled=true means the
    // surface swallowed it (idle input never sees it). Close is driven
    // INSIDE HandleKey (esc self-closes): the returned closed flag tells
    // the Model to nil the field and re-focus the textarea.
    HandleKey(msg tea.KeyPressMsg, deps surfaceDeps) (cmd tea.Cmd, handled bool, closed bool)

    // HandleWheel consumes or passes a mouse wheel event. Overlays without
    // their own scroll surface return handled=false so the event falls
    // through to the conversation viewport (soul today: always false).
    HandleWheel(msg tea.MouseWheelMsg, deps surfaceDeps) (cmd tea.Cmd, handled bool)

    // HandleMsg consumes or passes a NON-input message: an RPC result
    // (client.SoulMsg), a timer tick, a status notice. The Model routes
    // every non-key/wheel Msg through the open modal BEFORE its own
    // generic reducer, so the surface owns its RPC-backed state and can be
    // created dynamically at Open with no pre-declared Model field. The
    // surface consumes (handled), kills (closed), or passes (handled=false);
    // on closed the Model nils the field + refocuses, exactly as the
    // HandleKey closed path.
    HandleMsg(msg tea.Msg, deps surfaceDeps) (cmd tea.Cmd, handled bool, closed bool)

    // Close tears the surface down with NO side effects beyond what the
    // Model owns: the state is zeroed by the caller (the Model), the
    // returned cmd re-focuses the textarea (today ta.Focus()). The surface
    // holds no resource the Model must clean up — rpc fetch results that
    // arrive after close are dropped at the reducer (see below).
    Close(deps surfaceDeps) tea.Cmd
}
```

Justification per method:

- **Render(body + regions, geometry):** the single pass that owns both the bytes the
  user sees and where a click lands. Soul returns `regions == nil`; the signature
  is ready for the clickable surfaces (approval already builds
  `[]ClickableRegion`). Parents place; surfaces size — hence width/height in,
  placed-ready body out.
- **HandleKey:** consume-or-pass is how `onOverlayKey` works today. `closed` as a
  third return makes Close self-driven from keys (esc) without a Model check for
  which key closed it.
- **HandleWheel:** consume-or-pass for mouse: soul has no scroll surface and
  always returns `false`; approval/plan-view/args-view (later Phase) claim wheels.
- **Close:** returns the `tea.Cmd` (`ta.Focus()`) so Model doesn't know what
  teardown means. For surfaces whose teardown has no cmd, return nil.
- **No `Open()`/`active()` method, no `tea.Model` return.** "Open" is a Model-side
  transition (install the surface, blur the textarea, fire the initial RPC); the
  open predicate is `modal != nil`. A surface method returning `tea.Model` would
  invite it to pretend to be the Model — it returns `tea.Cmd`/flags only, and the
  Model stays the `tea.Model`.

The deps struct, defined next to the interface:

```go
// surfaceDeps is the explicit list of what ANY surface may touch, built
// fresh per call by Model.surfaceDeps() and never stored. Fields are the
// superset of what the migrated surfaces need; each surface reads only its
// own subset. Mirrors approvalDeps (approval_surface.go).
type surfaceDeps struct {
    theme theme.Theme
    keys  keyMap                              // for key.Matches
    marks helpKeys                             // render hints (helpKeyMarkings)
    caps  client.Capabilities                  // capability-gated copy
}
```

Model-side builder:

```go
func (m *Model) surfaceDeps() surfaceDeps {
    return surfaceDeps{
        theme: m.deps.Theme,
        keys:  m.keys,
        marks: m.helpKeyMarkings(),
        caps:  m.caps,
    }
}
```

`soulDeps` is deliberately NOT introduced: one shared struct with per-surface
read-only fields is the Phase-1 lesson (approvalDeps is already the shared
collaborator struct). Adding a `soulDeps` now would be a parallel channel the
interface forbids; when a surface needs an RPC func (like approval's
`sendApproval`), it's a func field on this ONE deps struct.

**HandleMsg decision (the RPC-reducer wrinkle) — RESOLVED: surface-owned.**
`updateSoulMsg` MOVES onto the surface as `HandleMsg`. RPC/stream results are
routed through the surface (consume/kill/defer) so the surface owns its RPC-backed
state and can be created dynamically at Open with NO pre-declared Model field —
the requirement dynamic views demand. The Model's generic reducer only sees a Msg
the open modal passes on (`handled=false`). This is the OO-style consume/kill/
defer routing; the alternative (a per-overlay `switch msg.(type)` in update.go) is
the spaghetti issue #555 is killing. `client.SoulMsg` therefore mutates the
`soulState` the interface already holds — the same pointer-receiver idiom as
`HandleKey`. Approval is unaffected: it owns its RPC-shaped path through
`approvalDeps.sendApproval`, a different seam.

## 2. How the Model routes through it

Model gains ONE field (name: `modal`; type: `surface`; placement: next to the
overlay states in `model.go`, with a comment). Its nil-vs-set IS the "an overlay
is open" predicate. The interface holds the ONE live surface state instance;
there is NO `m.soul`-style pre-declared tombstone field — the surface state is
constructed at Open and discarded at Close.

```go
modal surface // the ONE open modal overlay (nil = none)
```

Soul's arm moves; the other overlays stay pre-migration and are routed by their
existing arms. `modal` receives ONLY the migrated surfaces.

### Before/after per touchpoint for soul

**`renderBody` (view.go:101-102).**

Before:

```go
case m.soul.view != soulNone:
    return renderSoulOverlay(m.deps.Theme, m.soul, m.caps, m.helpKeyMarkings(), m.width, m.vp.Height())
```

After:

```go
case m.modal != nil:
    body, _ := m.modal.Render(m.surfaceDeps(), m.width, m.vp.Height())
    return body
```

The soul-specific `renderSoulOverlay` call and the `m.soul.view != soulNone`
predicate collapse into the `modal != nil` arm. Regions are ignored here (soul
has nil regions; clickable-surface migration will offset+consume them). Remaining
unmigrated overlay arms stay.

**`onOverlayKey` (update.go:1359-1382).**

Before: `onOverlayKey` iterates a list of per-overlay routes, including
`m.onSoulKey`.

After: BEFORE the loop over the remaining legacy routes, route through the
open modal:

```go
if m.modal != nil {
    cmd, handled, closed := m.modal.HandleKey(msg, m.surfaceDeps())
    if handled {
        if closed {
            m.modal = nil
            return m, tea.Batch(cmd, m.ta.Focus()), true
        }
        return m, cmd, true
    }
}
```

Then fall through to the legacy per-overlay list (which no longer includes
`m.onSoulKey`). The `HandleKey` returns are `(cmd, handled, closed)`; the soul
HandleKey holds its Close-internals (esc sets closed=true) and the Model nils
the field + refocuses. Because the interface holds the ONE live `soulState`
instance (a pointer receiver), mutations land on it directly — no copy-back.

**Message routing (`HandleMsg`).** In `Update`'s message dispatch, BEFORE the
Model's own generic reducer (and after the stream-event arm), route every
non-key/wheel Msg through the open modal:

```go
if m.modal != nil {
    cmd, handled, closed := m.modal.HandleMsg(msg, m.surfaceDeps())
    if handled {
        if closed {
            m.modal = nil
            return m, tea.Batch(cmd, m.ta.Focus())
        }
        return m, cmd
    }
}
```

`updateSoulMsg`'s body moves into `soulState.HandleMsg`: it type-switches on
`client.SoulMsg`, mutates `s.soul`/`s.loading`/`s.err`/`s.scroll`, returns
`handled=true`. Any other Msg returns `handled=false` so the Model's generic
reducer sees it. The Model-side `updateSoulMsg` is REMOVED. (The stream-event
arm that relays `client.SoulMsg` into Update is unchanged — it already delivers
the Msg; only its consumer moves.)

**`selectable` (selection.go:110-129).**

Before: `m.soul.view == soulNone &&` is one conjunct in the overlay predicate.

After: replace that one conjunct with `m.modal == nil &&`. The OTHER conjuncts
(unmigrated overlays) remain until their phase. The semantic is unchanged: no
selection may start while a surface owns the body.

**Mouse wheel (update.go:3038).** Soul is a no-scroll overlay, so its wheel
falls through to the conversation viewport. The legacy soul path already falls
through today (no `onSoulKey` arm for wheels; `selectable` exclusion means the
conversation wheel still processes). No change needed; the `HandleWheel`
interface method exists for the future surfaces that DO scroll (approval/plan).

**Close.** `closeSoul` (soul.go:60-64) becomes the interface's `Close(deps)
tea.Cmd`; soul's Close returns `m.ta.Focus()` — the same cmd it returns today.
Model calls `Close()` on a close transition, then nils the field.

**Builtin registration (`builtins.go:137-143`).** `Model.runSoul` stays the
registration seam; it becomes the Open transition: it validates (idle + wired),
blurs the textarea, constructs the state, sets `m.modal = &soulState{view:
soulPanel, loading: true}`, and returns the GetSoul RPC cmd (today
`client.GetSoulCmd`). The builtin list does NOT change shape — still `{name,
desc, run}` where `run` is a Model method. The state is created HERE (dynamic),
not held on Model.

## 3. The soul surface refactor (file-level)

`soul.go` stays THE soul file — the same one-file-owns-it invariant the
`approval_*.go` quartet enforces. These identifiers move/rename within it:
`soulView`, `soulNone`, `soulPanel`, `soulBodyLines`, `soulState`,
`openSoul`, `closeSoul`, `onSoulKey`, `updateSoulMsg`, `soulMaxScroll`,
`clampSoulScroll`, `soulContentLines`, `renderSoulOverlay`, `soulDisabledNote`,
`soulTrustLabel`, `renderSoulPanel`, `renderSoulMeta`, `renderSoulBody`.

Changes:

1. `soulState` implements `surface` on POINTER receivers: the methods are
   declared `func (s *soulState) Render(...)`, `func (s *soulState)
   HandleKey(...)`, `func (s *soulState) HandleMsg(...)`, `func (s *soulState)
   HandleWheel(...) (returns handled=false always)`, `func (s *soulState)
   Close(...) tea.Cmd`. The Model stores NO `soulState` field; `runSoul`
   constructs `m.modal = &soulState{view: soulPanel, loading: true}` at Open and
   the interface holds the only instance. The pointer is transient (the `&`
   address-of at Open), never a stored Model field — the discipline Phase 1
   already uses (`&m.approval` per call), here applied to an interface value.
2. The old METHODS (`openSoul`/`closeSoul`/`onSoulKey`/`updateSoulMsg`) on
   `Model` are REMOVED; the interface methods on `*soulState` carry the bodies
   (`openSoul`'s Model guard+blur lives in the Open transition in
   builtins/surface.go; `closeSoul`'s refocus lives in the Model's HandleKey
   closed-path; `onSoulKey`'s scroll clamps move onto `*soulState.HandleKey`;
   `updateSoulMsg`'s RPC write moves onto `*soulState.HandleMsg`).
3. `renderSoulOverlay` becomes `func (s *soulState) Render(deps surfaceDeps,
   width, height int) (string, []ClickableRegion)` returning `(body, nil)`.
   The inner helpers (`renderSoulPanel`/`renderSoulBody`/`renderSoulMeta`) are
   unchanged; only the entry signature changes.
4. `surface.go` is the ONLY new production file (interface + deps struct + the
   Open transition helper if one is generalized; otherwise the Open helper is
   inlined in `builtins.go`'s `runSoul`).

The Model holds exactly ONE `modal surface` field and NO `soulState` field. The
gate (below) asserts the one `surface` field; there is no soul-field assertion
because there is no soul field to count (the gate instead asserts soul
vocabulary lives only in soul.go).

## 4. The structural gate

New `cmd/mecatui/ui/surface_arch_test.go`, imitating `approval_arch_test.go`:

1. `surfaceFileHomes = {"surface.go": true, "soul.go": true}` and
   `surfaceFileCount = 2`; soul-vocabulary token regex matching
   `soulView|soulNone|soulPanel|soulBodyLines|soulState|openSoul|closeSoul|
   onSoulKey|updateSoulMsg|soulMaxScroll|clampSoulScroll|soulContentLines|
   renderSoulOverlay|soulDisabledNote|soulTrustLabel|renderSoulPanel|
   renderSoulMeta|renderSoulBody|surface|surfaceDeps` — every declaration
   matching the vocabulary lives in `surface.go` or `soul.go`. The delegation
   exceptions mirror approval: `view.go`'s `m.modal.Render(...)` call is
   vocabulary-free; `update.go`'s `m.modal.HandleKey/HandleMsg(...)` route is
   vocabulary-free.
2. `TestModelHasOneModalSurfaceField`: reflect over `Model`; count fields
   whose type is the `surface` interface (the type NAME is `surface`); require
   exactly 1. A second `surface` field is Phase-3 stack drift.
3. `TestModelHasNoSoulField`: reflect over `Model`; count fields whose type
   NAME is `soulState`; require exactly 0. The dynamic-Open decision means the
   soul state lives ONLY in `m.modal`; a pre-declared `m.soul` field is the
   tombstone drift this kills.

Naming the assertions IS the visible decision (the loud gate).

## 5. Golden/regression risk

Soul has goldens: `testdata/soul.golden`, `testdata/soul_empty_disabled.golden`,
`testdata/soul_empty_enabled.golden` (locked by `soul_test.go:257-285`). Render
path is `Model.View()` end-to-end, so the proof of no drift is:

1. `task test:golden` FAILS the task if any soul golden drifts. Do NOT update
   goldens — they are the oracle.
2. `task test` (root module; mecatui tests live there) and `go test
   ./cmd/mecatui/ui/` stay green.
3. `go run ./cmd/mecademo` (still prints a full session).
4. The route test updates in `soul_test.go` (open renders through
   `m.modal.Render`, close nils `m.modal`) stay byte-identical in output.

If any golden drifts, the refactor moved a render decision into the Model —
find it and move it back into the surface before proceeding.

## 6. Migration order after soul

For each overlay, the pattern needs ONE more capability; enforce it then
register the overlay:

1. **mcp** — multi-view enum inside one state struct (mcpPanel/resources/
   prompts/args). Pattern: the surface's own view enum routes internally; the
   interface stays unchanged.
2. **sessions** — picker + transcript view + a phase (replay) coupling. Pattern:
   the surface may RETURN a phase hint via Closed (see `updateSessionsMsg`); do
   NOT widen the interface — the phase transition stays Model-side on close.
3. **skills** — type-to-filter text input + detail view + epochs. Pattern: the
   surface owns a bubbles component (textinput); deps must include whatever the
   component uses.
4. **models** — selecting picker (cursor + enter pick + provenance). Pattern:
   the surfaces may RETURN an action the Model executes (mirror
   `approvalAction`'s propose/dispose) — DO NOT widen the interface; a returned
   semantic value (not a func) rides HandleKey's cmd.
5. **approval** — the big one: ask queue, click regions, wheel claim, phase.
   Pattern: it migrates LAST because it must displace the phase coupling and own
   regions and a queue. Its migration proves the interface can carry approval's
   `approvalDeps` superset.

## 7. Explicitly OUT of scope (banked)

- The surface STACK (opening one overlay on top of another; focus order).
- Tiling/focus tree (Phase 3).
- `approvalButton` component extraction.
- bubblezone adoption.
- ANY change to the approval surface (this phase is soul-only).
- The stale "ADR 0108" citation (docs cleanup flagged, not done).

## 8. Acceptance checklist (a new surface touches ONE file + ONE registration point)

For a surface to be done; soul is the proof:

1. `cmd/mecatui/ui/surface.go` exists with `surface` interface + `surfaceDeps`.
2. `cmd/mecatui/ui/soul.go` carries every soul-vocabulary declaration
   (gate-enforced); `soulState` implements `surface` (incl. `HandleMsg`).
3. `cmd/mecatui/ui/model.go` has exactly ONE `surface` field and NO `soulState`
   field.
4. `cmd/mecatui/ui/surface_arch_test.go` exists and passes.
5. The legacy `m.onSoulKey` route and the `m.soul.view != soulNone` arms in
   `renderBody`/`selectable` are removed (soul route is through `m.modal`).
6. `builtins.go` has exactly one registration of soul (`runSoul`), unchanged
   shape.
7. All three soul goldens unchanged (`task test:golden` proves it).
8. `task lint && task test` green; `go run ./cmd/mecademo` still prints a
   session.

## Task tag

- **Size:** ONE task. **Diff band:** M (interface + soul refactor + gate + test
  shims ≈ 300-400 LOC). **Complexity:** mechanical (straight-line moves, one
  interface, value-discipline already proven by approval).
- **Dependencies:** none — Phase-1 approval consolidation is already landed.
- **Ordering:** implement in single pass; the gate + goldens make partial
  merges safe.
- **Verification:** `task lint`, `task test` (root module;
  `cmd/mecatui` is NOT the separate `engine` module), `go run
  ./cmd/mecademo`, `task test:golden`.
