---
id: 05-dispatch-parking-eligibility-serialization
title: Dispatch parking, eligibility, and serialization
blocked_by: [03d-broker-owner-commit-reuse, 04-authorizing-aggregate-and-snapshot-state]
status: done
branch: "plan-session-vmcp-authorization/05-dispatch-parking-eligibility-serialization"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Adapt protected broker wrappers to the neutral authorization-required signal after normal permission and PreToolUse gates. Park eligible main runs only after durable authorizing state is saved. Add the smallest serialization seam that preserves `ReadOnly()` semantics and unrelated read parallelism. All unattended/delegated surfaces must receive paired ordinary errors.

## Acceptance criteria

- AC5.1: Permission deny and PreToolUse block return their ordinary paired results and
  never call broker `Connect`.
  - verify: `TestSessionMCPAuthorization_Scenario5_GatesPrecedeConnect`
- AC5.2: A PreToolUse argument mutation is exactly the call stored and later executed;
  the original call is never replayed.
  - verify: `TestInvariant_mcp_authorization_replays_effective_call`
- AC5.3: The protected broker tool card emitted before the gate carries safe call/tool
  identity but no arguments in live events, durable events, or wire projections.
  - verify: `TestInvariant_protected_broker_tool_card_redacts_arguments`
- AC5.4: Pending authorization records no result for the pending call, sends no protected
  request, runs no PostToolUse, writes no ToolCallRecorder entry, increments no failure
  counter, and emits no terminal `EvResult`.
  - verify: `TestSessionMCPAuthorization_Scenario5_PendingHasNoExecutionEffects`
- AC5.5: Earlier sibling results are recorded once in original order before entering
  authorizing; the pending call is exact; later siblings do not execute.
  - verify: `TestSessionMCPAuthorization_Scenario5_ParksMidTurnDeterministically`
- AC5.6: The private authorizing snapshot save succeeds before
  `mcp.authorization.required` is emitted or relayed.
  - verify: `TestInvariant_mcp_authorization_save_precedes_required_event`
- AC5.7: If the save fails after Runtime pending creation, the exact transaction is
  invalidated, one paired ordinary error is recorded, and no usable handle or authorizing
  state survives.
  - verify: `TestSessionMCPAuthorization_Scenario5_SaveFailureCancelsTransaction`
- AC5.8: `agent.Run` exposes a distinct `authorization_parked` completion outcome,
  separate from `session.StopReason`; gRPC and SSE relays treat channel closure after that
  outcome as expected, deregister only that Run, keep the Session nonterminal, and record
  parked metrics without fabricating success/failure or `EvResult`.
  - verify: `TestSessionMCPAuthorization_Scenario5_ParkedRunOutcome`
- AC6.1: An owner-authorized remote interactive main run may enter authorizing on a
  process-headless mecak8s server.
  - verify: `TestSessionMCPAuthorization_Scenario6_RemoteMainMayPark`
- AC6.2: ACP, scheduled, detached, background, child, Parallel, Team, and other
  presentation-ineligible runs create no Runtime transaction and receive one bounded
  ordinary paired tool error.
  - verify: `TestInvariant_unattended_runs_never_park_for_mcp_authorization`
- AC6.3: A broker wrapper's `ReadOnly()` remains the configured tool's real semantic
  hint; read tools remain read-only and mutating tools remain mutating for permissions
  and plan-mode advertisement.
  - verify: `TestInvariant_broker_tools_preserve_read_only_semantics`
- AC6.4: All broker calls are dispatch-serialized relative to sibling broker calls, so
  one session has at most one pending authorization and result order is stable.
  - verify: `TestSessionMCPAuthorization_Scenario6_BrokerCallsSerialize`
- AC6.5: Unrelated non-broker read-only tools retain the existing parallel dispatch
  behavior.
  - verify: `TestSessionMCPAuthorization_Scenario6_UnrelatedReadsRemainParallel`
