---
id: 03-server-composition
title: Per-session server integration, catalogue collision, and restart
blocked_by: [01b-profile-auth-routes, 02-session-tools]
status: in-progress
branch: ""
worktree: ""
issue: ""
retries: 1
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Wire the configured broker Runtime through root composition and the server's per-session engine factory. Read `.claude/plans/session-vmcp-broker/RESTART-HANDOVER.md` before coding; it is the corrective architecture source for this task. Reserve the canonical ID before broker session resources open; mount its tools through `assembleCatalog` without altering `Config.MCPServers` or the global manager. Reject broker/global fully-qualified tool collisions before any ambiguous wrapper mounts. Rehydrate a persisted broker-enabled session through a root-internal broker binding/index keyed by the canonical session ID and immutable broker/config generation, or fail precondition; never silently use the shared engine. Do not add or persist a broker field in `engine/session`, `engine/adapter/sessnap`, `engine/api`, or `engine/port`. Keep controls private and add no public wire/UI change.

## Acceptance criteria

- AC1.1: Creating a broker-enabled session reserves its canonical session ID before the per-session factory opens broker state; a construction or persistence failure releases the reservation and closes every partially-created session resource.
  - verify: `TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession`
- AC1.2: A broker-enabled session receives executable wrappers for the configured fixed MCP tool catalogue through the same `assembleCatalog` path as other per-session tools, while `Config.MCPServers` and the process-global manager are unchanged.
  - verify: `TestSessionVMCPBroker_Scenario1_MountsSessionToolsOnly`
- AC1.5: A configured broker tool whose fully-qualified name collides with a process-global MCP tool causes broker-session construction to fail before it can mount either ambiguous wrapper; it never silently routes through global credentials. Non-conflicting broker tools remain mountable.
  - verify: `TestSessionVMCPBroker_Scenario1_RejectsGlobalToolCollision`
- AC4.5: Loading a persisted broker-enabled session after a process restart never silently falls back to the shared engine. It either re-derives the identical stable broker tool catalogue from the immutable configuration and reports authorization-required for reset in-memory grants, or fails loudly `FailedPrecondition` when the broker configuration cannot be reattached.
  - verify: `TestSessionVMCPBroker_Scenario4_RestartIsExplicit`
