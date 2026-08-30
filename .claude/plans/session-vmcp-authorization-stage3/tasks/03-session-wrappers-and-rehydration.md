---
id: 03-session-wrappers-and-rehydration
title: Session wrappers and broker-aware rehydration
blocked_by: [02-process-broker-construction]
status: done
branch: "plan-session-vmcp-authorization/03-session-wrappers-and-rehydration"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Mount and own session-local broker wrappers through the existing per-session catalogue and rehydration seams. Persist only non-secret broker enrollment/provenance, fail closed rather than falling back to the shared/global MCP catalog, and preserve per-session Runtime isolation. Do not change aggregate authorizing state or dispatch suspension; those belong to later tasks.

## Acceptance criteria

- AC3.1: Session ID reservation precedes `Runtime.OpenSession`, and create/save/factory
  failure releases the reservation and closes the partially opened broker session.
  - verify: `TestSessionMCPAuthorization_Scenario3_ReserveBeforeOpen`
- AC3.2: The model sees a fixed ordinary tool catalogue whose wrappers retain private
  backend routes; backend IDs, callback data, ToolHive locators, and credentials are not
  model inputs or tool metadata.
  - verify: `TestInvariant_session_broker_route_is_not_model_input`
- AC3.3: Broker enrollment and enough non-secret configuration provenance persist so a
  restored default-profile/default-model session is forced through broker-aware
  rehydration.
  - verify: `TestSessionMCPAuthorization_Scenario3_PersistsBrokerEnrollment`
- AC3.4: A restored broker session recreates session-local wrappers from current trusted
  operator configuration before any fresh tool call.
  - verify: `TestSessionMCPAuthorization_Scenario3_RestoresBrokerCatalog`
- AC3.5: Missing Runtime construction, changed incompatible route inventory, failed
  discovery, or broker/global name collision returns failed-precondition and never uses
  the shared engine/global MCP authority.
  - verify: `TestInvariant_broker_rehydration_never_falls_back_global`
- AC3.6: A Service-owned broker-session registry makes concurrent create, rehydrate,
  per-session engine rebuild, and cache eviction for one ID reuse one live `SessionTools`
  owner or fail closed; only final session close may call `ForgetSession`, and partial
  factory failure cannot tombstone a still-live session.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerSessionOwnership`
- AC3.7: Closing one session drains its calls and forgets only its broker state; another
  session and the process Runtime remain usable.
  - verify: `TestSessionMCPAuthorization_Scenario3_SessionIsolation`
- AC2.6: Construction failure closes every acquired ToolHive/profile resource, and
  normal shutdown closes session tools before the Runtime and the Runtime before any
  global profile credential sources.
  - verify: `TestSessionMCPAuthorization_Scenario2_RollbackAndCloseOrdering`
