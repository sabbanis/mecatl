---
id: 03d-broker-owner-commit-reuse
title: Commit and safely reuse broker session ownership
blocked_by: [03c-broker-reload-and-finalization-repair, 04-authorizing-aggregate-and-snapshot-state]
status: done
branch: "plan-session-vmcp-authorization/03d-broker-owner-commit-reuse"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Finish broker owner lifecycle correctness before Task 05. Keep Task 05 blocked and do not add dispatch parking, command-root, listener, or deployment work.

Use explicit provisional versus committed broker ownership. A new create remains provisional until `Store.Save` succeeds; a persisted rehydration commits ownership before factory execution. Failed create closes/removes its provisional entry; failed rehydration retains its committed entry for retry.

Permit safe same-process reload after `CloseSession`: make the complete `SessionTools.Close` operation once-guarded; remove the Runtime tombstone only after the old owner fully drains; verify owner identity before unregistering; a repeated stale close cannot affect a replacement owner. Give `brokerSession` once-safe ready/done signalling. `Service.Close` must mark every entry closing, close resources, and wake waiters even after replacing the registry map.

Include `ToolSpec.Description` in `EnrollmentID`, and remove unused `closeBrokerSession`.

## Acceptance criteria

- Repair R3.10: Broker ownership is provisional only during create persistence and committed before rehydration factory execution; failed create leaves no entry, while failed rehydration retains the entry for retry.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerOwnerCommitSemantics`
- Repair R3.11: Closing then same-process reloading safely creates/reuses an owner; stale repeated close cannot remove a replacement.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerOwnerReloadAfterClose`
- Repair R3.12: Service shutdown closes entries and wakes waiters blocked on a closing broker entry.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerOwnerShutdownWakesWaiters`
- Repair R3.13: Enrollment identity changes when `ToolSpec.Description` changes, and finalization remains attempt-scoped.
  - verify: `TestInvariant_broker_finalization_is_attempt_scoped`
