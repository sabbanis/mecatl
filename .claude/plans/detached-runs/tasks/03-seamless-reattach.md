---
id: 03-seamless-reattach
title: Seamless reattach — the tool remembers, the user forgets
blocked_by: [01-detached-prompt-drain]
status: done
branch: "plan-detached-runs/03-seamless-reattach"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

The client-side auto-reattach. The user runs `mecatui connect ADDRESS` with no
flags. The tool reads a persisted last-session pointer for this server target,
checks the session's state, and auto-branches: running → reattach via
`WatchSessionEvents` (replay from cursor, then follow live); idle/terminal →
resume as today; none → start fresh. The user never types a flag, never remembers
a session ID.

The persisted pointer lives in `~/.local/state/mecatui/sessions.yaml` (a sibling
to the existing `models.yaml`), keyed by connect target, storing `last_session` +
`last_seen` + `state`. It reuses the exact `selectionStore` infrastructure:
fail-soft read, atomic write, 0o600, O_NOFOLLOW symlink guard.

The auto-branch bypasses the existing `startupResumeEligible` conservative
exclusion of `running` sessions — the no-flag default path goes through the
persisted pointer → `GetSession` → state-branch, not through the session listing.
The listing path is the fallback when no pointer exists, and there it lists
`running` sessions with a "reattach" affordance (distinct from "continue").

**Work:**
- `cmd/mecatui/state.go`: a new `sessions.yaml` sibling to `models.yaml`, keyed
  by connect target, storing `last_session` + `last_seen` + `state`. Written on
  detach and on session switch. Read on `mecatui connect ADDRESS`.
- `cmd/mecatui/startup_resume.go`: the no-flag default path reads the persisted
  pointer, calls `GetSession(id)`, and branches on state. The `--resume <id>`
  flag also auto-branches (reattach if running, resume if idle/terminal). The
  `--resume-latest` flag's eligibility expands to include `running` sessions
  (reattach) when the server supports detached runs. A new `--new` flag forces a
  fresh session.
- `cmd/mecatui/client/`: a `WatchSessionEvents` wrapper + `WatchCmd`/
  `ReconnectWatchCmd` siblings to `LiveStreamCmd`/`ReconnectLiveCmd` that consume
  `WatchEnvelope`s (carrying `Event`, `Cursor`, `Phase`) and thread the cursor
  for reconnect.
- `cmd/mecatui/ui/`: new Model state fields (`watchCh`/`watchGen`/`watchStop`/
  `watchCursor`/`watchArmed`/`detached`) + a new `phaseFollowing` (read-only live
  view of a server-owned detached run). The `updateWatchMsg`/`armWatch`/
  `disarmWatch` reducers parallel `updateLiveMsg`/`armLiveFeed`.
- `cmd/mecatui/ui/sessions_surface.go`: `● running` badge for sessions in
  `StateRunning`; `enter` on a running row = reattach (same auto-branch).

## Acceptance criteria

- AC3.1: `mecatui connect ADDRESS` with no flags, when a last-session pointer
  exists and the session is `running`, auto-reattaches via `WatchSessionEvents`
  (replay from cursor `""`, then follow live). The user sees `⟳ reattaching to
  running session…` during replay, then the live spinner.
  - verify: `TestDetachedRun_Scenario3_AutoReattachToRunningSession`
- AC3.2: `mecatui connect ADDRESS` with no flags, when a last-session pointer
  exists and the session is `idle`/`completed`/`cancelled`/`failed`, resumes as
  today (load transcript, enter idle phase).
  - verify: `TestDetachedRun_Scenario3_AutoResumeIdleSession`
- AC3.3: `mecatui connect ADDRESS` with no flags, when no last-session pointer
  exists, falls through to the existing `--resume-latest`-style session listing
  (now including `running` sessions as reattach candidates). If none exist,
  starts fresh.
  - verify: `TestDetachedRun_Scenario3_NoPointerFallsThroughToListing`
- AC3.4: `mecatui connect ADDRESS --new` forces a fresh session even if a running
  one exists.
  - verify: `TestDetachedRun_Scenario3_NewFlagForcesFresh`
- AC3.5: The persisted pointer is written on detach and on session switch, and
  read on connect. It is fail-soft (a corrupt/missing file degrades to the
  listing path).
  - verify: `TestDetachedRun_Scenario3_PointerPersistedAndRead`
- AC3.6: The `WatchSessionEvents` replay→live boundary marker (`WatchPhaseReplay`
  → `WatchPhaseLive`) drives a `⟳ replaying N events…` footer indicator during
  replay, then switches to the normal live spinner.
  - verify: `TestDetachedRun_Scenario3_ReplayToLiveIndicator`
