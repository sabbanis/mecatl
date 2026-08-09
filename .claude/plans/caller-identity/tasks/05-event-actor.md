---
id: 05-event-actor
title: Event.Actor — log-only attribution stamped at appendEvent only
blocked_by: [03-session-owner]
status: pending
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

The event half of Scenario 4 in `docs/acceptance/caller-identity.md`;
`ADR-0100` decision 5. Every event in the **durable log** names its actor.

**`engine/session/event.go` — the `Actor` field.** `*Principal` on `Event`, nil
at **every** emit site. The loop must never stamp it: the loop is
storage-agnostic and emits only (`AGENTS.md` — "the durable event log persists at
the RELAY, not the loop"). No emit site in `engine/agent` learns about principals.

**One stamping site: `appendEvent`.** In
`internal/adapter/server/service.go`, `Service.appendEvent` reads the **loaded
session's owner** and stamps `Actor` before the durable `Append`. That is the
same chokepoint that already owns cancel-detached durable writes and redaction —
do not add a second stamping path.

**Log-only, exactly like `EvApproval` / `EvCompactionArchive`.** `toProto` omits
it (it never reaches the client wire, in **either** relay — gRPC `Converse` and
HTTP SSE), and the event-sourced `Fold`
(`engine/adapter/eventsource`, ADR-0038) **ignores** it: a Fold-rebuilt session
keeps the owner it restored from the snapshot, and the fold neither requires nor
re-derives `Event.Actor`. **No proto change on the event path.**

**Ownerless is absent, never fabricated.** An event for a pre-ship (ownerless)
session records a nil actor.

The denormalization is deliberate (an event read in isolation names its actor);
the session owner remains the identity-of-record. `Actor` is derive-at-append,
never the source of truth.

`Event` is engine-exported ⇒ `task api:update` + an `engine/CHANGELOG.md` note
(Added/minor).

AC4.2 asserts absences (not on the wire, does not perturb the fold) — plant the
violation, watch each go red, then remove it. A green negative test you have not
seen fail is not yet a test.

Do not touch the schedule path — that is task 06.

## Acceptance criteria

- AC4.1: An event appended for a session owned by Alice is recorded with
  `Actor == Alice's principal`; the loop-side emit leaves it nil and only
  `appendEvent` stamps it.
  - verify: `TestCallerIdentity_Scenario4_EventActorStampedAtAppendOnly`
- AC4.2: The event annotation is log-only — it does not appear on the client wire
  (`toProto` omits it) and does not perturb event-sourced rehydration: a session
  rebuilt by `eventsource.Fold` keeps the owner it restored from the snapshot, and
  the fold neither requires nor re-derives `Event.Actor`.
  - verify: `TestCallerIdentity_Scenario4_EventActorLogOnly`
- AC4.5: An event for an ownerless (pre-ship) session records a nil/absent actor —
  never a fabricated one.
  - verify: `TestCallerIdentity_Scenario4_OwnerlessEventActorAbsent`
