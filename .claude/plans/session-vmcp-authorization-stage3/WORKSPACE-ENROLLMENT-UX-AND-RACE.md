# Findings: startup-resume race with workspace enrollment, and enrollment UX friction

## 1. Bug: `--resume` + seeded prompt races the workspace-enrollment gate

### Symptom

`ConnectWorkspaceServices` failed with:

```
server: failed precondition: workspace enrollment must precede the first prompt
```

on a session that should have had zero messages at the time enrollment was attempted.

### Root cause

`cmd/mecatui/ui/update.go`'s `finishStartupResume` (invoked by `startupResumeReadyMsg`,
which `Init()` fires immediately whenever `m.deps.Resume != nil`, i.e. `--resume`) calls
`startInitialPrompt()` **unconditionally**:

```go
func (m Model) finishStartupResume() (tea.Model, tea.Cmd) {
	cmd := (&m).maybeKittyTransmit()
	if liveCmd := (&m).armLiveFeed(); liveCmd != nil {
		cmd = tea.Batch(cmd, liveCmd)
	}
	if mm, submitCmd, ok := m.startInitialPrompt(); ok {
		return mm, tea.Batch(cmd, submitCmd)
	}
	return m, cmd
}
```

`startInitialPrompt()` itself has no phase/capability awareness — it submits
`m.pendingInitialPrompt` (the `-p`/`--prompt` CLI seed) the moment it's non-empty.

Compare this to the normal connect path, `applySessionReady`, which correctly defers:

```go
if msg.Capabilities.WorkspaceEnrollment {
	m.phase = phaseWorkspaceEnrollment
	m.enrollment = workspaceEnrollmentState{}
	m.prompt.Blur()
	m.statusMsg = "workspace services require connection"
	// InitialPrompt remains queued until the complete frozen catalogue is
	// admitted; never submit it through the server's fail-closed gate.
	return m, nil, true
}
```

`startupResumeReadyMsg` fires straight out of `Init()`, before any `SessionReadyMsg` has
populated `m.caps`/`m.phase`. So `--resume` combined with a seeded `-p/--prompt` submits
the prompt immediately — recording it as the session's first message — before the client
even knows whether workspace enrollment is required. Any later enrollment attempt on that
session then trips the server's `must precede the first prompt` precondition permanently
(see the companion finding, `WORKSPACE-ENROLLMENT-RECONNECT-GAP.md`, for why there is
also no recovery path once this happens).

### Fix

`finishStartupResume` now checks `m.caps.WorkspaceEnrollment` before calling
`startInitialPrompt()`, deferring exactly like `applySessionReady` does when it's true.

The signal is precise, not a heuristic: `m.caps` is set from `resume.Snapshot.Capabilities`
synchronously at `Init()` — well before `finishStartupResume` runs — and that field is
populated server-side by `capabilitiesForSession(id)`
(`internal/adapter/server/service.go`):

```go
func (s *Service) capabilitiesForSession(id session.SessionID) *mecatlv1.ServerCapabilities {
	capabilities := s.capabilities()
	capabilities.WorkspaceEnrollment = capabilities.WorkspaceEnrollment && !s.cfg.VMCPBroker.ProtectedCatalogueReady(id)
	return capabilities
}
```

So `WorkspaceEnrollment` is already narrowed to *this specific session's* admission
state (required AND not yet admitted) — not merely "the deployment has protected
backends configured." `GetSession` (which resume's snapshot fetch goes through) calls
this same per-session helper, so a resumed session that already completed enrollment in
an earlier run correctly sees `WorkspaceEnrollment == false` and its seeded prompt still
fires immediately; only a resumed session that still needs to (re-)connect gets deferred.

Fixed in `cmd/mecatui/ui/update.go`, `finishStartupResume`.

## 2. UX friction: forced modal + fully manual recheck

Two separate complaints about the current workspace-enrollment UX, both borne out by
reading the modal/keybinding code (`cmd/mecatui/ui/workspace_enrollment.go`,
`cmd/mecatui/ui/update.go`, `cmd/mecatui/ui/view.go`):

### 2a. The connect step is a forced modal, not an on-demand action

Any session whose server has protected MCP servers configured gets the "Connect
workspace services" modal placed in front of it **unconditionally at session open** —
prompt blurred (`m.prompt.Blur()`), no way to do anything else first:

```go
if msg.Capabilities.WorkspaceEnrollment {
	m.phase = phaseWorkspaceEnrollment
	m.enrollment = workspaceEnrollmentState{}
	m.prompt.Blur()
	...
}
```

The fail-closed *intent* is sound — the model must never believe protected tools are
admitted before the RPC actually completes — but the *form* conflates two different
things: "protected tools aren't admitted yet" (a fact that's already enforced at the
authority-set level, independent of any UI) and "the user must be blocked from doing
anything until they connect" (a UI policy choice). Nothing about the fail-closed
guarantee requires the second half. A deliberate, on-demand action (see §3) would fit
the TUI's existing idiom (`/model`, `/mcp`, `/skills`, …) better than a hard gate that
fires before the user has expressed any intent to use a protected tool at all.

### 2b. Recheck-after-consent is fully manual, with no server push available

Once the browser opens for the upstream OAuth consent screen, the modal shows:

```go
default:
	body += "\n\nWorkspace service connection pending.   [r] Recheck bundle   [x] Cancel bundle"
```

There is no timer, no poll loop, and no server-side event that could tell the client the
consent finished — the user must notice the browser flow completed and press `r`. This
was checked directly: no `EvWorkspaceEnrollment*` event type exists anywhere in
`engine/session/event.go` or the server, unlike the analogous
`EvMCPAuthorizationRequired`/`EvMCPAuthorizationResolved` pair that already exists for
per-tool MCP authorization (`internal/adapter/server/mcp_authorization.go`). Workspace
enrollment is pure request/response polling, and right now even the polling is manual.

## 3. Proposed redesign

### 3a. Replace the forced modal with a non-blocking status + on-demand `/connect`

Keep the fail-closed *guarantee* exactly as-is — it already lives one layer down from
the UI, at two independent points that don't care what the modal does:

- The authority set literally has no `mcp__github__*` tools admitted until the
  catalogue is frozen (`freezeProtectedCatalogue`), so the model can't be told tools
  exist that aren't there.
- `startRunContent` independently refuses to start a run at all while
  `WorkspaceEnrollmentRequired() && !ProtectedCatalogueReady(id)`
  (`internal/adapter/server/service.go`), so even a client that never shows any UI for
  this can't slip a prompt through.

Given both of those hold regardless of what the TUI does, the modal is UI *policy*, not
a safety requirement. Proposed change:

1. On session open with `caps.WorkspaceEnrollment == true`, show a **non-blocking**
   status line instead of a modal — e.g. footer note `workspace services not connected
   — /connect to enable {N} protected tool(s)` — and leave the prompt focused. The user
   can look around, run `/model`, ask something that doesn't need GitHub, etc.
2. Add a `/connect` slash command (fits the existing `/model`, `/mcp`, `/skills` idiom)
   that drives the exact same `ConnectWorkspaceServices` → poll/pending → consented
   sequence the modal drives today, just invoked deliberately instead of forced.
3. If the model or user tries to actually use a protected tool before connecting, the
   existing `startRunContent` rejection needs to surface as an actionable message
   pointing at `/connect` — today's raw `"workspace services must be connected before
   prompting"` is functional but doesn't tell the model what to *do* about it. Per the
   AGENTS.md invariant "a model-facing gate is incomplete without a model-visible
   prompt instruction" — the model needs to be told `/connect` (or the tool call it
   maps to) exists and is the way out, not just that it's blocked.

This turns "you are blocked until you do this" into "here's a thing you can do, and
you'll be blocked from the one feature that needs it until you do" — same safety
guarantee, much less friction for a session that has no intention of touching GitHub
this turn.

### 3b. Push instead of poll for the pending→connected transition

Mirror the pattern already built for per-tool MCP authorization
(`EvMCPAuthorizationRequired`/`EvMCPAuthorizationResolved`,
`internal/adapter/server/mcp_authorization.go`) with an analogous
`EvWorkspaceEnrollmentResolved` (or fold it into the same event family) emitted the
moment the broker's OAuth callback lands and the catalogue freezes. The client already
holds a live event subscription per session for exactly this class of push; workspace
enrollment is the one flow that still doesn't use it.

If wiring a new event type is more than this warrants short-term, the minimum viable
improvement is a client-side poll timer (e.g. every 3–5s while `status == pending`)
instead of the fully manual `[r]`. That is strictly worse than a push event (it either
polls too eagerly or feels slow) but is a much smaller change than 3a/3b's full
redesign and could land first.

## Status

Bug (§1) fixed in this pass, `cmd/mecatui/ui/update.go`, `finishStartupResume`. UX (§2/§3)
is a design proposal — not yet implemented.
