---
id: 03c-broker-reload-and-finalization-repair
title: Repair broker reload and finalization ownership
blocked_by: [03b-broker-session-ownership-repair, 04-authorizing-aggregate-and-snapshot-state]
status: done
branch: "plan-session-vmcp-authorization/03c-broker-reload-and-finalization-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Correct the remaining Service broker-session ownership holes before Task 05. `LoadSessionWithMCP` must route enrolled sessions through the broker-aware factory and retain the registered wrappers; it must not replace the catalogue through a generic direct `SessionEngine` call. Remove the permanently growing `brokerFinalized` tombstone design: it must not block valid same-process retry/reload or reconnect behavior, and its replacement must stay bounded while still preventing a close race from registering a stale opener. Remove `Runtime.RouteToolNames` if it exists only as obsolete provenance support.

Audit and repair factory-failure/retry behavior and same-process reload behavior. Add genuine Service-level tests covering a factory failure followed by successful retry, a same-process reload preserving broker tools/owner, and the finalization/close-race behavior that enables a valid later retry without resurrecting stale resources. Keep Task 05 paused; do not add dispatch parking, command-root, listener, or deployment work.

## Acceptance criteria

- Repair R3.6: `LoadSessionWithMCP` retains broker wrappers and borrows the registered Service owner for enrolled sessions; no generic engine replacement can drop those wrappers.
  - verify: `TestSessionMCPAuthorization_Scenario3_LoadWithMCPRetainsBrokerTools`
- Repair R3.7: Factory failure leaves a valid retry path, and a same-process reload reuses one live broker owner without reopening or dropping its wrapper catalogue.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerReloadRetriesWithoutResurrection`
- Repair R3.8: Finalization prevents a stale concurrent opener from registering but does not permanently tombstone a session ID or grow unbounded; a subsequent valid create/reload may proceed.
  - verify: `TestInvariant_broker_finalization_is_attempt_scoped`
- Repair R3.9: Obsolete `Runtime.RouteToolNames` provenance support is removed.
  - verify: `TestInvariant_broker_runtime_has_no_legacy_route_tool_provenance`
