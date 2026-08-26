---
id: 04-oauth-transaction
title: Secure singleflight OAuth connection transactions
blocked_by: [01b-profile-auth-routes, 02-session-tools]
status: blocked
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: "ToolHive v0.40.0 embeds its own upstream OAuth client and exposes no injected no-proxy, exact-origin, DNS-pinned, redirect-bounded HTTP-client hook; implementing AC2.1 would require a ToolHive change or forbidden direct OAuth."
accumulator: acc/session-vmcp-broker
---

# Task brief

Read `.claude/plans/session-vmcp-broker/RESTART-HANDOVER.md` before coding; it supersedes the discarded direct-OAuth approach. Implement composition-private `Connect(sessionID, backendID)` for exactly one protected backend by composing the accepted Stage 0 ToolHive authserver/vMCP single-upstream path. The broker may create an opaque broker callback rendezvous and bind it to the canonical session/backend, but ToolHive owns upstream discovery, authorization URL construction, upstream PKCE/state, upstream callback, credential storage, and upstream token refresh. `Connect` returns the embedded ToolHive `/oauth/authorize` browser URL, not an upstream issuer URL; after callback, the broker exchanges ToolHive's downstream authorization code only at ToolHive `/oauth/token`. Keep the dedicated bounded no-proxy exact-origin/DNS-pinned egress policy at the boundary that actually makes external OAuth requests. Do not create a public API, change the direct-MCP OAuth controller, or hand-write an upstream OAuth protocol.

## Acceptance criteria

- AC2.1: The first `Connect(session, protectedBackend)` with no usable upstream grant returns `AuthorizationRequired` containing one opaque handle, one HTTPS browser URL at the configured issuer origin, and an expiry; it returns no token, refresh value, verifier, code, secret, or ToolHive locator. Broker OAuth discovery, callback, token, and credential-bearing redirects use a dedicated no-proxy bounded client and refuse foreign/private origins except explicit loopback test fixtures.
  - verify: `TestSessionVMCPBroker_Scenario2_FirstConnectRequiresAuthorization`; `TestSessionVMCPBroker_Scenario2_RejectsForeignOAuthEgress`
- AC2.2: Concurrent and repeated `Connect` calls for the same session/backend share one pending browser transaction and return the same opaque handle and URL; cancellation of one waiter does not cancel the shared flow.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectSingleflight`
- AC2.3: `Connect` and `Disconnect` accept only an opened, non-tombstoned canonical parent session and configured backend. Unknown, delegation-child, forgotten, or unconfigured IDs allocate no transaction/binding, contact no upstream, and expose no additional session/backend information.
  - verify: `TestSessionVMCPBroker_Scenario2_RejectsInvalidControlTargets`
- AC2.4: Expiry removes a pending transaction, its verifier/state, waiter bookkeeping, and singleflight entry. Its callback remains inert, and a later valid `Connect` creates exactly one fresh opaque handle.
  - verify: `TestSessionVMCPBroker_Scenario2_ExpiredTransactionIsCollected`
