---
id: 05-callback-execution
title: Callback binding and protected broker tool execution
blocked_by: [03-server-composition, 04-oauth-transaction]
status: in-progress
branch: "plan-session-vmcp-broker/05-callback-execution"
worktree: ""
issue: ""
retries: 0
last_error: "reopened: failed downstream token exchange must preserve the exact pending handle/URL; AC2.6 needs embedded ToolHive vMCP credential-injection proof, not a generic MCP transport fake."
accumulator: acc/session-vmcp-broker
---

# Task brief

Read `.claude/plans/session-vmcp-broker/RESTART-HANDOVER.md` before coding. Turn the stored transaction into one real completed ToolHive connection: the broker callback receives ToolHive's downstream code plus opaque state, atomically locates and consumes the matching transaction, then exchanges that code only at ToolHive `/oauth/token` with the original private PKCE verifier. On a downstream exchange failure, preserve or safely restore the same pending transaction: a subsequent `Connect` must return its exact original handle and browser URL, not create a new flow. Retain the resulting downstream refresh/access lineage privately; later `Connect` returns `Connected`; inject the short-lived vMCP bearer only in the session-local MCP transport. AC2.6 must exercise `NewToolHiveStreamingHTTPRuntime` against embedded ToolHive vMCP and a fake protected upstream that validates the specific upstream credential ToolHive injected; a generic MCP endpoint accepting any Authorization header or an opener override is insufficient. Do not accept or exchange an upstream provider authorization code, call an upstream issuer/token endpoint, expose credentials to the model/session/event data, or mutate the model-visible catalogue/tool identity. Wrong, expired, duplicate, cross-session, or late callbacks must not install or resurrect a grant.

## Acceptance criteria

- AC2.5: A valid broker callback commits a protected credential only to the session/backend bound into its original transaction. Wrong, expired, duplicate, cross-session, or late callbacks cannot install or resurrect a grant.
  - verify: `TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay`
- AC2.6: After successful callback completion, `Connect` returns `Connected` and the already-mounted protected tool executes through vMCP with the correct fake upstream credential; its model-visible tool identity is unchanged.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectedToolExecutesWithoutCatalogueMutation`
