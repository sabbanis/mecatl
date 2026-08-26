---
id: 05-callback-execution
title: Callback binding and protected broker tool execution
blocked_by: [03-server-composition, 04-oauth-transaction]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: "blocked on Task 04 correction: production ToolHive ownership must precede downstream callback execution."
accumulator: acc/session-vmcp-broker
---

# Task brief

Read `.claude/plans/session-vmcp-broker/RESTART-HANDOVER.md` before coding. Complete the one-backend ToolHive callback boundary and make the already-mounted protected wrapper execute through embedded vMCP after a valid connection. Bind callback completion strictly to the original opaque broker transaction; consume it once; do not permit replay or cross-session installation. The callback receives ToolHive's downstream authorization code and exchanges it only at ToolHive `/oauth/token`; it never accepts or exchanges an upstream provider authorization code. Preserve the model-visible catalogue and tool identity before and after connection.

## Acceptance criteria

- AC2.5: A valid broker callback commits a protected credential only to the session/backend bound into its original transaction. Wrong, expired, duplicate, cross-session, or late callbacks cannot install or resurrect a grant.
  - verify: `TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay`
- AC2.6: After successful callback completion, `Connect` returns `Connected` and the already-mounted protected tool executes through vMCP with the correct fake upstream credential; its model-visible tool identity is unchanged.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectedToolExecutesWithoutCatalogueMutation`
