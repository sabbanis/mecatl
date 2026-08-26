---
id: 07-teardown-lifecycle
title: Scoped disconnect, forget, session close, and runtime shutdown
blocked_by: [03-server-composition, 06-refresh-custody]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Finish the broker lifecycle: scoped idempotent disconnect, irreversible session tombstone/forget, close drains for in-flight calls, and shared Runtime shutdown ordering. Ensure session tool close runs before ForgetSession and no session close can close Runtime or another session's tools. Keep lifecycle state internal and do not mask ToolHive residuals with goleak exclusions.

## Acceptance criteria

- AC4.1: `Disconnect(session, backend)` cancels that backend's pending flow, removes its broker binding and removable upstream credential, preserves the session's other backends, and is idempotent.
  - verify: `TestSessionVMCPBroker_Scenario4_DisconnectIsBackendScoped`
- AC4.2: Reconnecting a disconnected OAuth backend returns the documented typed limitation rather than silently creating a second ToolHive lineage; the result names no credential material.
  - verify: `TestSessionVMCPBroker_Scenario4_ReconnectRequiresConnectUpstream`
- AC4.3: `ForgetSession(session)` tombstones the session, cancels and joins its pending login/refresh work, removes all broker bindings and token state, deletes indexed upstream credentials, and is idempotent.
  - verify: `TestSessionVMCPBroker_Scenario4_ForgetRevokesAndTombstones`
- Supporting regression: Late callback, refresh, disconnect, or forget work cannot resurrect a tombstoned session.
  - verify: `TestSessionVMCPBroker_Scenario4_LateOperationsCannotResurrect`
- AC4.6: A session close that races an in-flight broker tool call waits for the call to settle before `ForgetSession` removes its state; after close, new calls are rejected and `ForgetSession` runs exactly once.
  - verify: `TestSessionVMCPBroker_Scenario4_CloseDrainsInFlightCall`
- AC5.1: Closing a session drains and closes only its `SessionTools`, then calls `ForgetSession`; it does not close the Runtime or another session's tools.
  - verify: `TestSessionVMCPBroker_Scenario5_SessionCloseOrdering`
- AC5.2: `Runtime.Close` rejects new control/MCP work, cancels and joins broker login/refresh work, closes vMCP/authserver/storage in ownership order, and is idempotent.
  - verify: `TestSessionVMCPBroker_Scenario5_RuntimeCloseOrdering`
