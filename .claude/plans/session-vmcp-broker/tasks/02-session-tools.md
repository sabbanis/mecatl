---
id: 02-session-tools
title: Auth-none broker sessions and isolated tool execution
blocked_by: [01-runtime-contract]
status: done
branch: "plan-session-vmcp-broker/02-session-tools"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Implement Runtime session ownership and executable session-local streaming-HTTP tool wrappers for configured `auth:none` backends. Use the standard broker `/mcp` endpoint, prove independent session tool sets and close behavior, and reject an unconnected protected call with a bounded authorization-required result. Do not add public control endpoints, parking, replay, or a global-manager integration.

## Acceptance criteria

- AC1.3: An Engine run invokes a fake `auth:none` upstream tool through the standard broker `/mcp` endpoint and receives its ordinary tool result.
  - verify: `TestSessionVMCPBroker_Scenario1_AuthNoneEngineRoundTrip`
- AC1.4: Two sessions receive independent broker session tools; closing one session neither breaks the other session's tool call nor closes shared broker infrastructure.
  - verify: `TestSessionVMCPBroker_Scenario1_SessionToolIsolation`
- AC2.7: Calling the protected tool before explicit connection returns a bounded authorization-required tool error, while an anonymous configured tool remains executable. Stage 2 neither parks nor replays the agent run.
  - verify: `TestSessionVMCPBroker_Scenario2_UnconnectedProtectedToolIsBounded`
