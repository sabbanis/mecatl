---
id: 04-oauth-transaction
title: Secure singleflight OAuth connection transactions
blocked_by: [02-session-tools]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Implement composition-private `Connect(sessionID, backendID)` transaction creation for one protected backend. Use ToolHive plus `x/oauth2`, explicit bounded no-proxy exact-origin/DNS-pinned OAuth egress, opaque state, expiry collection, target validation, and per-session/backend singleflight. Browser input proves only broker-created state. Do not create a public API or modify direct MCP OAuth controller behavior.

## Acceptance criteria

- AC2.1: The first `Connect(session, protectedBackend)` with no usable upstream grant returns `AuthorizationRequired` containing one opaque handle, one HTTPS browser URL at the configured issuer origin, and an expiry; it returns no token, refresh value, verifier, code, secret, or ToolHive locator. Broker OAuth discovery, callback, token, and credential-bearing redirects use a dedicated no-proxy bounded client and refuse foreign/private origins except explicit loopback test fixtures.
  - verify: `TestSessionVMCPBroker_Scenario2_FirstConnectRequiresAuthorization`; `TestSessionVMCPBroker_Scenario2_RejectsForeignOAuthEgress`
- AC2.2: Concurrent and repeated `Connect` calls for the same session/backend share one pending browser transaction and return the same opaque handle and URL; cancellation of one waiter does not cancel the shared flow.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectSingleflight`
- AC2.3: `Connect` and `Disconnect` accept only an opened, non-tombstoned canonical parent session and configured backend. Unknown, delegation-child, forgotten, or unconfigured IDs allocate no transaction/binding, contact no upstream, and expose no additional session/backend information.
  - verify: `TestSessionVMCPBroker_Scenario2_RejectsInvalidControlTargets`
- AC2.4: Expiry removes a pending transaction, its verifier/state, waiter bookkeeping, and singleflight entry. Its callback remains inert, and a later valid `Connect` creates exactly one fresh opaque handle.
  - verify: `TestSessionVMCPBroker_Scenario2_ExpiredTransactionIsCollected`
