---
id: 05e-authorization-parking-final-correctness-repair
title: Finalize restored parking, invalidation ownership, relays, and proofs
blocked_by: [05d-authorization-parking-completion-repair]
status: done
branch: "plan-session-vmcp-authorization/05e-authorization-parking-final-correctness-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Finish the remaining Task 05 blockers before Task 06. This is a narrow correctness repair; do not add continuation-control behavior.

Propagate `*dispatchPark` through every restored permission-approval path (`resolvePendingCall`, including hook-originated) and route it through the same durable parking handler ordinary dispatch uses. A restored approval must never record a zero result or lose a required broker authorization park. Add a restart/rehydration test—not live approval—that proves it parks durably.

Make exact invalidation authoritative. On pause/save failure, either cancellation guarantees the Runtime handle is unusable before aggregate detachment, or retain a durable ownership state that prevents reuse until cancellation succeeds. A cancellation error cannot merely change a message while losing correlation. Add a requester test that deliberately retains the handle and prove it cannot be reused.

Implement explicit parked outcome handling in BOTH production HTTP and gRPC relays: treat it as expected nonterminal closure, deregister only the Run, retain authorizing state, and record distinct parked metrics/outcome. Add real HTTP and gRPC relay tests asserting those facts.

Replace all remaining shallow tests with independent behavior proofs: mutating PreToolUse then execution, PreToolUse block, prior/pending/later sibling order, observed Store completion before required event, concurrent actual broker serialization vs unrelated reads, pending no posthook/recorder/failure effects, full unattended surface table, parked child drain/retraction, and safe payload from durable event through proto wire with no private data. Correct `Run.Events` and save/saveRequired comments.

## Acceptance criteria

- Repair R5.17: restored approval propagates and persistently parks authorization exactly like live dispatch.
  - verify: `TestInvariant_restored_permission_approval_preserves_mcp_authorization_park`
- Repair R5.18: a failed cancellation cannot leave an unowned reusable authorization transaction.
  - verify: `TestInvariant_mcp_authorization_failed_invalidation_retains_ownership`
- Repair R5.19: HTTP and gRPC explicitly record parked nonterminal completion.
  - verify: `TestMCPAuthorizationParkedRelayLifecycle`
- Repair R5.20: all remaining Task 05 acceptance proofs exercise concrete behavior.
  - verify: `TestInvariant_mcp_authorization_parking_behavior_matrix`
