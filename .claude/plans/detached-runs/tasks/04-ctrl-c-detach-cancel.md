---
id: 04-ctrl-c-detach-cancel
title: Ctrl+C detaches; double Ctrl+C cancels
blocked_by: [01-detached-prompt-drain, 02-control-only-converse, 03-seamless-reattach]
status: done
branch: "plan-detached-runs/04-ctrl-c-detach-cancel"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

The Ctrl+C behavior. The user presses Ctrl+C while watching a running detached
session. The first Ctrl+C detaches (closes the watch stream, keeps the run,
prints the one-line "run continues" message, quits). The second Ctrl+C cancels
the run (sends a control-only Converse `cancel` frame) and exits. This reuses the
existing two-signal handler shape: first signal = graceful (detach), second
signal = force (cancel + exit).

The behavior is determined by the server's capability, not the user's mode
awareness. When the server advertises `ServerCapabilities.detached_runs`, Ctrl+C
always detaches. When it doesn't (older server, or `--detached-runs` off), Ctrl+C
cancels the run (today's behavior). Embedded mode: Ctrl+C kills the process (the
server dies with it) — today's behavior, unchanged.

**Work:**
- `cmd/mecatui/main.go`: the signal handler checks the capability bit + a running
  session. If detached-capable AND a run is active, the first Ctrl+C prints the
  one-line "run continues" message and quits without cancelling. The second
  Ctrl+C sends a control-only Converse `cancel` frame and exits. The existing
  two-signal hard-exit semantics are preserved.
- `cmd/mecatui/ui/`: the `endRun` path branches on `m.detached` — a detached run
  whose Converse stream closed does NOT call `endRun`; instead it transitions to
  `phaseFollowing` (the watch feed is already armed).
- `cmd/mecatui/client/`: the submit path forks on capability + connection mode.
  When `Deps.ConnectionMode == "connect"` AND the server advertises
  `detached_runs`, `submitPrompt` calls the detached Converse path (Prompt with
  `detach: true`) instead of the attached Converse path.
- contracts: add `bool detached_runs = 26` to `ServerCapabilities`; `task
  generate` regenerates `contracts/gen/`.
- `internal/adapter/server/`: the operator-tier gate `mecated --detached-runs`
  flag (default OFF). When off, the server ignores the `detach` field on the
  Prompt (treats it as false → attached behavior).

## Acceptance criteria

- AC4.1: Ctrl+C on a detached-capable server with a running session detaches
  (closes the watch stream, keeps the run, prints the "run continues" message,
  quits). The run continues server-side.
  - verify: `TestDetachedRun_Scenario4_CtrlCDetaches`
- AC4.2: Double Ctrl+C on a detached-capable server with a running session
  cancels the run (sends a control-only Converse `cancel` frame) and exits.
  - verify: `TestDetachedRun_Scenario4_DoubleCtrlCCancels`
- AC4.3: Ctrl+C on a non-detached-capable server (older server, or
  `--detached-runs` off) cancels the run (today's behavior, byte-identical).
  - verify: `TestDetachedRun_Scenario4_CtrlCCancelsOnNonDetachedServer`
- AC4.4: Ctrl+C in embedded mode kills the process (the server dies with it) —
  today's behavior, unchanged.
  - verify: `TestDetachedRun_Scenario4_CtrlCKillsEmbedded`
- AC4.5: The `ServerCapabilities.detached_runs` bit is advertised by the server
  and gates the client's detach affordance. An older server without it → the
  existing Converse path, byte-identical.
  - verify: `TestDetachedRun_Scenario4_CapabilityGatesDetach`
