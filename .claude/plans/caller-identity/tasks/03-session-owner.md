---
id: 03-session-owner
title: The session records its owner, durably (write-once, never backfilled)
blocked_by: [01-principal-context]
status: pending
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

Scenario 3 of `docs/acceptance/caller-identity.md`; `ADR-0100` decision 4.
Tasks 00 and 01 already landed the `Principal` value object, the write-once
`Session` owner label, its snapshot round-trip, and the context helper. This
task **stamps** it and **surfaces** it.

**Stamp at `CreateSession`, write-once, from the token only.** In
`internal/adapter/server/service.go`, `CreateSession` reads
`session.PrincipalFromContext` and stamps the owner through the aggregate's
write-once method. **`CreateSessionRequest` gains no owner field** — a caller
must never be able to name its own owner in the request body. An absent
principal ⇒ an ownerless session (the byte-identical no-auth path), never a
fabricated one.

**Propagation rules.**
- Children (`subagent-` / `parallel-` / `team-` / `sched--`) inherit the
  **parent's** owner. An ownerless parent yields an ownerless child — never a
  fabricated one, and never a rejection (that would break the no-auth path).
- A **fork** inherits the **source's** owner, not the forking caller's. Stamping
  the caller's own owner would make fork an ownership-laundering path — pin that
  explicitly.
- **Resume** keeps the persisted owner.
- **Never backfilled.** A session persisted before this plan stays ownerless and
  renders as unowned, rather than being adopted by whoever touches it first.
- The owner must survive reopen, interrupt, recover, a process restart (the
  offline two-`app.Build` pattern), and a `Service.rehydrateSession` per-session
  engine rebuild.

**Also add an owner-injection seam for the scheduler.** A `WithOwner`
CreateSessionOption, a sibling of the existing `WithSessionID`, that overrides
the context-principal stamp. Task 06 (the schedule fire path) is its consumer;
land the seam here with the create path so the two do not collide on the same
function. It is inert until 06 uses it — but pin that an explicit `WithOwner`
beats the context principal.

**The list row surfaces the owner.** This **is** a deliberate proto change (the
"no proto change" claim in Scenario 4 is about the *event* path only): proto
`SessionSummary` gains an `owner` field (`task generate` via buf — never
hand-edit `contracts/gen/`), the server `SessionSummary` struct mirrors it, and
`port.SessionMeta` gains `Owner` so the `MetaLister` fast path (which skips
`Load`) populates the row **identically** to the Load-per-row slow path. This is
the recurring per-path-divergence class — assert both paths in one test, not two.
**Display only, no filtering** — a request bearing Bob's principal still lists
Alice's session. Scoping is the isolation track's (#368), not this plan's; do not
silently introduce it.

`port.SessionMeta` is engine-exported ⇒ `task api:update` + an
`engine/CHANGELOG.md` note (Added/minor).

`Session` stays an aggregate — the owner is read and written through its
methods, never by poking the struct (`AGENTS.md`).

## Acceptance criteria

- AC3.1: A session created under a verified principal records that principal as its
  owner; the store row, the snapshot, and the `ListSessions` row all name her — and
  the row is populated identically on **both** the `MetaLister` fast path and the
  Load-per-row slow path (no empty-on-fast-path divergence).
  - verify: `TestCallerIdentity_Scenario3_OwnerRecordedAndListed`
- AC3.2: The owner survives reopen, interrupt, recover, a process restart (the
  two-Build pattern), AND a `Service.rehydrateSession` per-session engine rebuild —
  the same session re-loaded names the same owner. (The event-sourced `Fold`
  reconstruction is covered at AC4.2.)
  - verify: `TestCallerIdentity_Scenario3_OwnerSurvivesReopenRestart`
- AC3.3: A child session and a fork carry the **source's** owner, not the calling
  goroutine's — a fork cannot launder ownership to its caller.
  - verify: `TestCallerIdentity_Scenario3_ForkInheritsSourceOwner`
- AC3.4: A pre-ship (ownerless) session stays ownerless after this plan — nothing
  backfills it, and it renders as unowned, not adopted.
  - verify: `TestCallerIdentity_Scenario3_PreShipSessionNeverBackfilled`
- AC3.5: `SessionSummary.owner` is populated for the list row but drives **no**
  filtering — a request bearing Bob's principal still lists Alice's session (the
  accept-and-thread cut is pinned: no isolation is silently introduced). Scoping is
  the isolation track's, not this plan's.
  - verify: `TestCallerIdentity_Scenario3_ListRowOwnerIsDisplayOnly`
