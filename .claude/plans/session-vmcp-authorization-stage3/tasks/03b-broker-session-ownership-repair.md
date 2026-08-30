---
id: 03b-broker-session-ownership-repair
title: Repair durable broker enrollment and Service ownership
blocked_by: [03-session-wrappers-and-rehydration, 04-authorizing-aggregate-and-snapshot-state]
status: done
branch: "plan-session-vmcp-authorization/03b-broker-session-ownership-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Repair the Task 03 broker-session ownership model before dispatch parking begins. Do not begin Task 05 until this task is merged into the accumulator. Do not add command-root routes, listeners, or external deployment surfaces.

Replace `BrokerEnrolled bool` and `BrokerToolNames []string` with one opaque, non-secret durable `BrokerEnrollmentID string`; empty means unenrolled. Compute it deterministically from trusted broker configuration and the complete compiled route inventory. Its digest must cover tool name/schema, backend route, protected/read-only status, and relevant authority configuration without persisting private values. Rehydration requires exact identity equality; missing or mismatched identity returns `ErrFailedPrecondition`. Update `engine/api/session.txt` and `engine/CHANGELOG.md` for the corrected pre-release API.

Create a Service-owned registry keyed by session ID which owns exactly one `*vmcpbroker.SessionTools` per live persisted session. The registry, not individual session engines, owns broker sessions: create reserves, opens, and registers transactionally; engine rebuild/cache eviction borrows existing wrappers; mode changes do not re-open; `LoadSessionWithMCP` includes registered tools; concurrent rehydration elects one owner and closes only loser-created resources; close/delete/shutdown linearize with creation/rehydration; final close removes and closes its entry once; and factory/save failures remove only entries created by that attempt. `app.Built.Close` closes Service entries before Runtime. Never fold `SessionTools.Close` into `SessionEngineResult.Close`.

Remove `Runtime.ReopenSession` unless a non-resurrection use remains after the registry exists. A process restart constructs a new Runtime; do not clear tombstones in a live Runtime. Make `SessionTools.Close` fully idempotent across registry removal so a stale repeated close cannot affect a later owner.

Audit create, restart rehydration, mode rebuild, `LoadSessionWithMCP`, cache eviction/rebuild, final close/delete, and Service shutdown. No direct `SessionEngine` path may replace an enrolled session catalogue without broker wrappers.

Update the relevant List 1 and List 2 rows in `docs/adr/0027-cloud-native.md`, regenerate `llms.txt`, and run the documentation gate.

## Acceptance criteria

- Repair R3.1: Durable broker enrollment is one opaque non-secret identity derived from trusted authority configuration and the complete compiled inventory. Changes to a tool schema, backend route, protected/read-only status, or relevant authority configuration fail exact rehydration compatibility with `ErrFailedPrecondition`.
  - verify: `TestInvariant_broker_enrollment_identity_covers_compiled_inventory`
- Repair R3.2: `server.Service` owns exactly one live `SessionTools` per persisted session and reuses it for mode rebuild, cache eviction/rebuild, rehydration, and `LoadSessionWithMCP`; only final close/delete removes it.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerSessionOwnership`
- Repair R3.3: Concurrent rehydration, close, and shutdown are linearizable: one owner wins, loser resources close, no close race resurrects an entry, and shutdown leaks none.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerSessionRegistryRaces`
- Repair R3.4: A stale or repeated `SessionTools.Close` cannot tombstone a replacement owner; factory failure cannot tombstone a pre-existing owner; final close affects only the target session; and Service entries close before Runtime shutdown.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerSessionCloseOwnership`
- Repair R3.5: `Runtime.ReopenSession` has no resurrection role in a live Runtime.
  - verify: `TestInvariant_broker_runtime_never_resurrects_session`

## Required Service-level cases

1. Mode rebuild reuses one broker owner.
2. `LoadSessionWithMCP` retains broker tools.
3. Concurrent rehydration creates one owner.
4. Close racing rehydration cannot resurrect an entry.
5. Service shutdown racing rehydration cannot leak an entry.
6. Stale/repeated close cannot tombstone a replacement.
7. Same tool names with changed schema/backend/protection fail compatibility.
8. Factory failure does not tombstone a pre-existing live owner.
9. Final close affects only the target session.
10. Session entries close before process Runtime shutdown.
