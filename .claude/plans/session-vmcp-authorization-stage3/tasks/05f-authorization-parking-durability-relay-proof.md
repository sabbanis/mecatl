---
id: 05f-authorization-parking-durability-relay-proof
title: Prove authorization parking durability and relay completion
blocked_by: [05e-authorization-parking-final-correctness-repair]
status: done
branch: "plan-session-vmcp-authorization/05f-authorization-parking-durability-relay-proof"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Final Task 05 repair based on current-code audit. Do NOT rework already-correct `dispatchPark` propagation; strengthen its restart proof.

Make failed precise invalidation observable and fail closed. The existing `AuthorizationRequester.InvalidateAuthorization` void API cannot establish that a retained transaction became unusable. Introduce the smallest compatible contract/seam necessary to observe failure; on failure the engine must retain durable ownership rather than aborting/detaching in a way that loses the transaction. Test a malicious/retaining requester where `CancelAuthorization` fails and prove the original handle cannot be reused or is durably still owned.

Add a server-owned parked-completion outcome seam that is called after relay drain and before Run deregistration. Both HTTP and gRPC use it; it records `authorization_parked` distinctly from normal `EvResult` terminal metrics. Do not infer it from the authorization-required event. Wire existing telemetry or add the narrowest injected observer/callback needed; preserve default behavior without configuration. Add real HTTP and gRPC lifecycle/metric assertions.

Replace restored-approval coverage with a true save/load/rehydration test proving restored authorization park survives process boundary, retains `StateAuthorizing`, and emits no terminal `EvResult`.

Add remaining independent behavioral tests actually missing from the 05 matrix: concurrent execution rather than interface inspection, hook mutation/block, ordered siblings, no pending effects, full unattended table, parked child drain/retraction, safe payload through durable event and proto mapping. Correct no unrelated scopes.

## Acceptance criteria

- Repair R5.21: cancellation failure never produces an unowned reusable authorization handle.
  - verify: `TestInvariant_mcp_authorization_failed_invalidation_retains_ownership`
- Repair R5.22: both relays record an explicit parked completion outcome after relay draining.
  - verify: `TestMCPAuthorizationParkedRelayLifecycle`
- Repair R5.23: restart rehydration preserves a broker authorization park with no terminal event.
  - verify: `TestInvariant_restored_permission_approval_preserves_mcp_authorization_park`
- Repair R5.24: parking acceptance tests are independent concrete behavior proofs.
  - verify: `TestInvariant_mcp_authorization_parking_behavior_matrix`
