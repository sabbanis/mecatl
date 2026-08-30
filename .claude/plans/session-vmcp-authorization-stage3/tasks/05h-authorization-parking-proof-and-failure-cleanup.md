---
id: 05h-authorization-parking-proof-and-failure-cleanup
title: Finalize authorization parking failure safety and behavioral proofs
blocked_by: [05g-restored-park-sibling-and-contract-repair]
status: done
branch: "plan-session-vmcp-authorization/05h-authorization-parking-proof-and-failure-cleanup"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Complete all remaining Task 05 substantive gaps and proof cleanup before Task 06. Correct Task 01 metadata separately (orchestrator has done it); do not edit plan files.

Fix failure safety: a `parkAuthorization` failure recording preceding completed results must invalidate the newly-created transaction. Failed cancellation/invalidation must never detach an unowned reusable handle; make the invalidation outcome observable and retain durable ownership/deny reuse. Validate OAuth token type empty or Bearer before transport use. Make restored park proof cross Save→Load/new engine after park. Prove Service generic approval does not grant presentation and authenticated interactive approval does. Both HTTP/gRPC must explicitly record parked outcome after drain, deregister Run only, preserve authorizing session, and test metrics/order.

Expand concrete tests: same-process earlier → protected-pending → later ParkMidTurn order; actual PreToolUse block in GatesPrecedeConnect; two connected or anonymous broker executions serialize under real overlap while unrelated reads overlap; table real ACP/scheduled/detached/background/child/Parallel/Team paths; parked background child drain/retraction; pending absence of PostToolUse/recorder/failure effects; Store completion before event; durable event/proto safe payload; real callback/cancel race. No aliases.

## Acceptance criteria

- Repair R5.28: all authorization parking failure branches invalidate or retain authoritative ownership.
  - verify: `TestInvariant_mcp_authorization_failure_never_leaves_unowned_transaction`
- Repair R5.29: all named Task 05 execution paths have independent behavior proofs.
  - verify: `TestInvariant_mcp_authorization_parking_behavior_matrix`
