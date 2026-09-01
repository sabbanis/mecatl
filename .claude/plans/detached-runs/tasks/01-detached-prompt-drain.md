---
id: 01-detached-prompt-drain
title: Detached prompt on the existing Converse stream + server-owned drain goroutine
blocked_by: []
status: pending
branch: "plan-detached-runs/01-detached-prompt-drain"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

The core server mechanism. Add `bool detach = 4` to the existing `Prompt` message
(`contracts/proto/mecatl/v1/harness.proto`). When the Converse handler receives a
`Prompt` with `detach: true`, it starts the run via the existing `StartRunContent`
path, spawns a server-owned drain goroutine (the `scheduler_fire.go:199-213`
pattern), sends an ack, and closes the stream cleanly. The run continues
server-side; the durable event log records every event including the terminal
`EvResult`.

The drain goroutine lives on the Service: it drains `run.Events()` through the
existing `RunEventRecorder` with a cancel-detached ctx (`context.WithoutCancel`),
breaks on terminal `EvResult`, and calls `FinishRun`. It joins on `Service.Close`
(which cancels all in-flight runs). It is inventoried in ADR 0027 List 1.

When `detach` is false (or absent — the proto3 default), the existing relay path
is byte-identical.

**Work:**
- contracts: add `bool detach = 4` to `Prompt`; `task generate` regenerates
  `contracts/gen/` (never hand-edit).
- `internal/adapter/server/grpc.go`: the Converse handler's prompt arm, when
  `first.GetPrompt().GetDetach()` is true, calls `StartRunContent`, spawns the
  drain goroutine, sends an ack event, and returns nil.
- `internal/adapter/server/service.go`: a `StartDetachedRunContent` method that
  wraps `startRunContent` + spawns the drain goroutine. Reuses `runPurposeChat`.
- `internal/adapter/server/grpc.go`: the drain goroutine — range `run.Events()`,
  `recorder.Observe(ev)`, break on `EvResult`, `FinishRun`. Cancel-detached ctx.
- `docs/adr/0027-cloud-native.md` List 1: inventory the drain goroutine (owner:
  `Service`; scope: per detached run; cleanup: `FinishRun` on terminal /
  `Service.Close` cancels all in-flight runs).

## Acceptance criteria

- AC1.1: A `Prompt` with `detach: true` starts a run that continues after the
  Converse stream closes. The durable event log records the terminal `EvResult`.
  - verify: `TestDetachedRun_Scenario1_DetachedRunSurvivesStreamClose`
- AC1.2: A `Prompt` with `detach: false` (or absent) behaves exactly as today —
  the run is cancelled on stream break.
  - verify: `TestDetachedRun_Scenario1_AttachedRunCancelledOnStreamClose`
- AC1.3: The drain goroutine calls `FinishRun` on terminal `EvResult`, releasing
  the run from the registry.
  - verify: `TestDetachedRun_Scenario1_DrainGoroutineFinishesRun`
- AC1.4: `Service.Close` cancels all in-flight detached runs (the drain goroutine
  joins on close).
  - verify: `TestDetachedRun_Scenario1_ServiceCloseCancelsDetachedRuns`
- AC1.5: The drain goroutine uses a cancel-detached ctx for the durable log (a
  dead client never stops the log).
  - verify: `TestDetachedRun_Scenario1_DetachedLogSurvivesClientDisconnect`
