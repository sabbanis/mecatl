---
id: 04-oauth-transaction
title: Secure singleflight OAuth connection transactions
blocked_by: [01b-profile-auth-routes, 02-session-tools]
status: in-progress
branch: "plan-session-vmcp-broker/04-oauth-transaction"
worktree: ""
issue: ""
retries: 0
last_error: "reopened: Connect only simulated an issuer URL; it must own or receive embedded ToolHive composition and prove the returned /oauth/authorize URL is usable."
accumulator: acc/session-vmcp-broker
---

# Task brief

Read `.claude/plans/session-vmcp-broker/RESTART-HANDOVER.md` before coding; it supersedes the discarded direct-OAuth approach. Retain only the salvageable opaque broker handle, per-session/backend transaction key, expiry collection, tombstones/`ForgetSession`, and safe browser-presentable result. Rework `Connect` so its production constructor owns or receives the actual embedded ToolHive authserver/vMCP composition—not merely an issuer URL string. ToolHive owns upstream discovery, authorization URL construction, upstream PKCE/state, upstream callback, credential storage, and upstream token refresh. The focused proof must follow the returned real ToolHive `/oauth/authorize` URL through the embedded server, demonstrating that ToolHive creates/owns authorization-session state and begins the configured upstream flow; a URL-shaped simulation is insufficient. Add explicit `Connected` and `Pending` result states. Reject a delegation-child ID by its reserved prefix even if it was opened. This spike accepts ToolHive v0.40.0's built-in upstream OAuth client as an opaque dependency default: do not add a direct OAuth client or modify ToolHive merely to inject an egress policy. Record the observed default behavior and the absence of an injection seam in `STAGE2-RESULTS.md`; do not claim a mecatl-enforced no-proxy, DNS-pinned, or redirect policy. Do not create a public API or change the direct-MCP OAuth controller.

## Acceptance criteria

- AC2.1: The first `Connect(session, protectedBackend)` with no usable upstream grant returns `AuthorizationRequired` containing one opaque handle, one HTTPS browser URL at embedded ToolHive `/oauth/authorize`, and an expiry; it returns no token, refresh value, verifier, code, secret, or ToolHive locator. The spike records ToolHive v0.40.0's opaque default upstream OAuth client and its missing injection seam as a follow-up rather than adding a direct OAuth substitute.
  - verify: `TestSessionVMCPBroker_Scenario2_FirstConnectRequiresAuthorization`; inspection — `STAGE2-RESULTS.md` records the ToolHive version/default and missing injection seam.
- AC2.2: Concurrent and repeated `Connect` calls for the same session/backend share one pending browser transaction and return the same opaque handle and URL; cancellation of one waiter does not cancel the shared flow.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectSingleflight`
- AC2.3: `Connect` and `Disconnect` accept only an opened, non-tombstoned canonical parent session and configured backend. Unknown, delegation-child, forgotten, or unconfigured IDs allocate no transaction/binding, contact no upstream, and expose no additional session/backend information.
  - verify: `TestSessionVMCPBroker_Scenario2_RejectsInvalidControlTargets`
- AC2.4: Expiry removes a pending transaction, its verifier/state, waiter bookkeeping, and singleflight entry. Its callback remains inert, and a later valid `Connect` creates exactly one fresh opaque handle.
  - verify: `TestSessionVMCPBroker_Scenario2_ExpiredTransactionIsCollected`
