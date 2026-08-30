---
id: 05g-restored-park-sibling-and-contract-repair
title: Repair restored authorization park sibling pairing and contracts
blocked_by: [05f-authorization-parking-durability-relay-proof]
status: done
branch: "plan-session-vmcp-authorization/05g-restored-park-sibling-and-contract-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Task 05 final correction; do not begin Task 06.

In `driveFromAwaiting`, when restored approval produces a broker park on a middle tool call, inspect already-recorded tool results. For each unanswered preceding call synthesize one ordered interrupted result, emit it, and pass those results as `completed` to `parkAuthorization`; only later unanswered calls become `park.deferred`. Prove a real restart boundary with earlier → permission-pending protected → later: preceding result durable once, exact pending authorization, later deferred, `ValidateToolPairing`, no replay.

`ResumeApproval` must not unconditionally grant `AuthorizationPresentation`; authorized Service caller supplies it explicitly and all other resume callers fail closed. Add named R5.21 verifier if absent and make all existing named matrix proofs concrete: hook mutation, concurrent serial vs unrelated overlap, recorder/posthook/failure absence, child drain, Store completion-before-event.

Inventory `parkedCompletions` in ADR 0027 List 1. Replace OAuth resource inference by string-trimming authorization endpoint with a trusted explicit issuer/resource configuration value.

Run full gates/docs/generation/api update and commit.

## Acceptance criteria

- Repair R5.25: restored middle-call authorization parking preserves ordered pairing and sibling semantics across restart.
  - verify: `TestInvariant_restored_middle_call_authorization_park_preserves_pairing`
- Repair R5.26: presentation capability and OAuth resource derive only from authorized trusted composition values.
  - verify: `TestInvariant_mcp_authorization_resume_presentation_is_caller_granted`
- Repair R5.27: new parked-completion resource is inventoried and Task 05 evidence tests actual behavior.
  - verify: `TestInvariant_mcp_authorization_parking_behavior_matrix`
