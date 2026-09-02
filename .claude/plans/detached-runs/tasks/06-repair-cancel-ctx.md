---
id: 06-repair-cancel-ctx
title: Repair — second-Ctrl+C cancel must use a fresh context (panel-review Critical)
blocked_by: []
status: pending
branch: "plan-detached-runs/06-repair-cancel-ctx"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

Panel-review ship-blocker (Critical). In `cmd/mecatui/main.go`, the
`detachControlCancel` closure (wired via `detachSignal.SetCancel` at ~line 264)
captures the signal handler's `ctx` — which the FIRST Ctrl+C cancels (line
~683). On the second Ctrl+C, `cl.CancelDetachedRun(ctx, id)` is called with an
already-cancelled context, so `Converse(ctx)` fails immediately with
`context.Canceled` and the `Cancel{SessionId}` frame never reaches the server.
The detached run keeps running — the headline safety control (ADR 0278 Scenario
4 / AC4.2) is broken in production while the test passes (the test wires a
no-op `SetCancel(func(){})` spy).

**Fix:** the cancel closure must use a context independent of the signal
handler's lifecycle — `context.WithTimeout(context.Background(), 5*time.Second)`
(the server-side `appendEvent`/lease-release cancel-detached discipline).
Strengthen the test so it catches this: the spy must record invocation AND the
production closure must not forward the cancelled parent ctx (drive a real or
fake `CancelDetachedRun` whose ctx is asserted not-done at call time).

Protects AC4.2 (`TestDetachedRun_Scenario4_DoubleCtrlCCancels`).

## Acceptance criteria

- AC6.1: After a first Ctrl+C (detach), the second Ctrl+C's cancel closure runs
  with a non-cancelled context (fresh, bounded).
  - verify: `TestDetachedRun_Repair_SecondCtrlCCancelUsesFreshContext`
- AC6.2: AC4.2's existing test still passes (double Ctrl+C cancels + exits).
