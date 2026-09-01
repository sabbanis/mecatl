---
id: 05-security-guardrails
title: Security guardrails + hardening (posture gating, deadline, concurrency bound)
blocked_by: [01-detached-prompt-drain]
status: pending
branch: "plan-detached-runs/05-security-guardrails"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

The hardening wave. A detached run executes tools with no client watching. The
guardrails are: posture gating (detached runs allowed under strict/trusted/auto;
WARN or refuse under yolo), permission asks park awaiting (no auto-approve), a
mandatory wall-clock deadline (the "forgot to come back" bound), and a
server-wide concurrency gate (prevents resource exhaustion).

**Work:**
- `internal/adapter/server/service.go`: the detached-run path applies the
  session's existing `Limits` (MaxTurns/MaxToolCalls) + an optional wall-clock
  deadline (a `time.AfterFunc` that calls `s.Cancel` on lapse, mirroring
  `scheduler_fire.go:169-179`).
- `internal/adapter/server/service.go`: a server-wide detached-run concurrency
  gate (a counting semaphore, mirroring `childGate`,
  `defaultMaxConcurrentChildren=8`) acquired at detached-run start, fail-fast
  when full. Operator-configurable cap (`--max-detached-runs`, default ~4).
- `internal/app/posture.go`: detached runs are allowed under
  `strict`/`trusted`/`auto`. Under `yolo`, a detached run is a loud WARN or
  refused — detachment removes the last human checkpoint that `yolo` implicitly
  assumes is present.
- The `modelhook` `PreToolUse` enforcement is wired into the engine, not the
  stream. A `PreToolUse` Block fires on a detached run and stops it.
  Operator-tier-only guardrail config preserves — a project file cannot weaken
  it.

## Acceptance criteria

- AC5.1: A detached run under `yolo` posture is refused (or WARNs loudly) —
  detachment removes the last human checkpoint.
  - verify: `TestDetachedRun_Scenario5_YoloDetachedRefused`
- AC5.2: A detached run that hits a main-session mutating ask parks awaiting
  (the existing `PauseForApproval` behavior). It does NOT auto-approve. A
  reconnecting client resolves the ask via the existing `resumeFromAwaiting`
  path.
  - verify: `TestDetachedRun_Scenario5_DetachedAskParksAwaiting`
- AC5.3: A detached run with a wall-clock deadline is cancelled on lapse
  (`s.Cancel` + persist the terminal snapshot).
  - verify: `TestDetachedRun_Scenario5_DeadlineCancelsDetachedRun`
- AC5.4: The server-wide detached-run concurrency gate refuses a new detached
  run when the cap is reached (fail-fast, ids only).
  - verify: `TestDetachedRun_Scenario5_ConcurrencyGateRefuses`
- AC5.5: The `modelhook` `PreToolUse` enforcement fires on a detached run and
  stops it (the block degrades to a terminal block headless).
  - verify: `TestDetachedRun_Scenario5_GuardrailBlocksDetachedRun`
