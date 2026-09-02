---
id: 02-control-only-converse
title: Control-only Converse stream (cancel/approve without a prompt)
blocked_by: []
status: done
branch: "plan-detached-runs/02-control-only-converse"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/detached-runs
---

# Task brief

Relax the Converse handler's first-frame rule to also accept `cancel` or
`resume_approval` as the first frame — a control-only Converse stream. This lets
a detached client cancel or approve without submitting a new prompt.

Add `string session_id = 1` to `Cancel` and to `ResumeApproval` (additive field;
existing clients leave it empty and the server infers it from the run context as
today). The Converse handler's first-frame switch gains two arms:

- `first.GetCancel() != nil` → call `Service.Cancel(ctx, sessionID, expectedRunID)`
  directly, send an ack, return.
- `first.GetResumeApproval() != nil` → call `Service.ApproveRun(ctx, sessionID,
  askID, verdict, expectedRunID)`, relay the resumed run if it returns one (the
  rehydrate path), else ack and return.

The existing `prompt`/`retry` first-frame paths are byte-identical.

**Work:**
- contracts: add `string session_id = 1` to `Cancel` and to `ResumeApproval`;
  `task generate` regenerates `contracts/gen/`.
- `internal/adapter/server/grpc.go`: the Converse handler's first-frame switch
  gains the two control-only arms.
- The HTTP side already has `POST /v1/sessions/{id}/cancel` and `/approve` as
  unary endpoints — no change needed there.

## Acceptance criteria

- AC2.1: A Converse stream whose first frame is `cancel` with a valid
  `session_id` cancels the session's in-flight run and returns an ack.
  - verify: `TestDetachedRun_Scenario2_ControlOnlyCancel`
- AC2.2: A Converse stream whose first frame is `resume_approval` with a valid
  `session_id` resolves the paused ask; if the run was dead (rehydrate path), the
  resumed run's events are relayed on the stream.
  - verify: `TestDetachedRun_Scenario2_ControlOnlyApprove`
- AC2.3: A Converse stream whose first frame is `cancel` or `resume_approval`
  with an empty `session_id` is rejected with `InvalidArgument`.
  - verify: `TestDetachedRun_Scenario2_ControlOnlyRequiresSessionID`
- AC2.4: A Converse stream whose first frame is `cancel` or `resume_approval`
  for a session with no in-flight run returns `FailedPrecondition` (the existing
  `ErrNoActiveRun` / `ErrSessionLeasedElsewhere` discipline).
  - verify: `TestDetachedRun_Scenario2_ControlOnlyNoActiveRun`
- AC2.5: The existing `prompt`/`retry` first-frame paths are byte-identical (no
  regression).
  - verify: `TestDetachedRun_Scenario2_ExistingFirstFramePathsUnchanged`
