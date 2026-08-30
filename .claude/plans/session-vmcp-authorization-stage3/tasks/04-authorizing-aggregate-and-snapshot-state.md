---
id: 04-authorizing-aggregate-and-snapshot-state
title: Authorizing aggregate and snapshot state
blocked_by: [02-process-broker-construction]
status: done
branch: "plan-session-vmcp-authorization/04-authorizing-aggregate-and-snapshot-state"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Add the distinct authorizing aggregate state and its private durable pending value, with explicit transition, pairing, validation, snapshot, and old-reader behavior. Keep it independent from permission awaiting. Do not dispatch a broker operation or expose controls here.

## Acceptance criteria

- AC4.1: `running -> authorizing` is legal only through a dedicated aggregate method with
  a valid pending value; permission-awaiting fields and policy learning remain untouched.
  - verify: `TestSessionMCPAuthorization_Scenario4_TransitionMatrix`
- AC4.2: `PendingMCPAuthorization` deep-copies the exact post-PreToolUse `ToolCall`,
  the ordered deep-copied suffix of later unexecuted sibling calls, authorization ID,
  safe backend label, expiry, and minimum non-secret route/config provenance at entry,
  accessor, and snapshot boundaries.
  - verify: `TestInvariant_pending_mcp_authorization_deep_copy`
- AC4.3: State/pending mismatch, both pending families, empty or malformed correlation,
  invalid expiry, duplicate/mismatched call ID, or a pending call inconsistent with the
  trailing assistant turn is rejected without execution.
  - verify: `TestSessionMCPAuthorization_Scenario4_RejectsMalformedState`
- AC4.4: New prompt, steer, mode change, rehome, fork/carryover, adoption, compaction,
  history replacement, usage reset, and any other operation that could alter the frozen
  call reject `StateAuthorizing` before mutation; title-only metadata remains governed by
  an explicit state-matrix decision.
  - verify: `TestInvariant_authorizing_state_rejects_conflicting_mutations`
- AC4.5: Dedicated claim, abort, and restart-interruption operations pair the exact call
  before leaving authorizing; after returning to running they produce one ordered
  `RecordToolResults` input containing the pending call's real/synthetic result followed
  by one deterministic synthetic result per deferred sibling. Generic
  Complete/Stop/Cancel/Fail/Abandon/reset cannot silently clear the pending state.
  - verify: `TestInvariant_authorizing_resolution_preserves_tool_pairing`
- AC4.6: The sole temporarily unmatched history shape is the stored pending call plus
  explicitly tracked later siblings; every resolved/aborted history passes
  `ValidateToolPairing`.
  - verify: `TestSessionMCPAuthorization_Scenario4_PairingExceptionIsExact`
- AC4.7: Snapshot round-trip preserves authorizing state and private call data across
  memstore, jsonlstore, Redis, and gRPC-driver conformance paths.
  - verify: `TestInvariant_authorizing_snapshot_store_conformance`
- AC4.8: An older or malformed reader encountering authorizing state fails closed before
  state mutation, `Connect`, or execution; it never coerces the state to idle/running.
  - verify: `TestSessionMCPAuthorization_Scenario4_OldReaderFailsClosed`
