---
id: 05-callback-execution
title: Callback binding and protected broker tool execution
blocked_by: [03-server-composition, 04-oauth-transaction]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Complete the one-backend OAuth callback boundary and make the already-mounted protected wrapper execute through vMCP after a valid connection. Bind callback completion strictly to the original opaque transaction; consume it once; do not permit replay or cross-session installation. Preserve the model-visible catalogue and tool identity before and after connection.

## Acceptance criteria

- AC2.5: A valid broker callback commits a protected credential only to the session/backend bound into its original transaction. Wrong, expired, duplicate, cross-session, or late callbacks cannot install or resurrect a grant.
  - verify: `TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay`
- AC2.6: After successful callback completion, `Connect` returns `Connected` and the already-mounted protected tool executes through vMCP with the correct fake upstream credential; its model-visible tool identity is unchanged.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectedToolExecutesWithoutCatalogueMutation`
