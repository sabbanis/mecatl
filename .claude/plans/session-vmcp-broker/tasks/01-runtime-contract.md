---
id: 01-runtime-contract
title: Broker runtime contract and static session-tool wrappers
blocked_by: []
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Create the root-internal `internal/adapter/vmcpbroker` boundary from the accepted Stage 0/1 proofs. Compile existing operator MCP profiles into an immutable, neutral, stable tool catalogue, retain broker-private backend routes in executable wrappers, and establish the Runtime/OpenSession/SessionTools API without widening `engine/` or `engine/port`. Reuse ToolHive's streaming-HTTP path; never expose backend IDs, bearer material, locators, OAuth state, or ToolHive types to the model. Add focused offline tests and leave full composition mounting to task 03.

## Acceptance criteria

- AC1.1: Creating a broker-enabled session reserves its canonical session ID before the per-session factory opens broker state; a construction or persistence failure releases the reservation and closes every partially-created session resource.
  - verify: `TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession`
- AC1.6: The model-facing call contains only the selected tool's declared arguments. `BackendID`, broker bearer material, ToolHive locators, and OAuth state are never tool arguments, tool descriptions, or tool results.
  - verify: `TestInvariant_vmcp_broker_route_is_not_model_input`
