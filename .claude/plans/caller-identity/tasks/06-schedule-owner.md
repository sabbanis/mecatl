---
id: 06-schedule-owner
title: Schedule owner captured at create; fires run as the owner (client_credentials)
blocked_by: [05-event-actor, 04-system-principal-goroutines]
status: in-progress
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

The schedule half of Scenario 4 in `docs/acceptance/caller-identity.md`;
`ADR-0100` decision 6.

**Owner captured at CREATE, never derived at fire time.** `childgc` sweeps the
origin session on retention while the schedule lives on — a fire-time lookup
would derive the owner from a session that no longer exists. The capture rule
depends on the create surface:
- the **Schedule-tool** path reads the *executing session's* owner via the
  origin binder;
- an **out-of-band** REST/CLI create (no origin session) reads the *context
  principal*;
- ownerless / none stays empty — never fabricated.

`ScheduleSpec` gains `owner` (domain + proto — `task generate` via buf, never
hand-edit `contracts/gen/`), persisted through the existing schedule registry
round-trip (both the local and the `ScheduleStoreService` driver paths, per
ADR-0057/#257's remote registry — do not let one transport silently drop it).

**The fire runs as the owner, not as the scheduler.** A fire mints its `sched--`
session under the scheduler's **system-principal** context (task 04), so the
context stamp would name the system principal. Use the explicit
`WithOwner` CreateSessionOption that task 03 landed to override it: the fire's
session records `Owner.Subject ==` the schedule owner's subject with
`GrantType == client_credentials`, and its events carry the same actor (via task
05's `appendEvent` stamp — no second stamping path). Attribution collapses to the
accountable person; the grant type honestly signals automated-not-interactive.

Pin the `childgc` case concretely: create the schedule from a session, sweep the
origin session, and assert the schedule still names its owner (AC4.3). That is
the failure mode the ADR called out — do not settle for a create-then-read test.

## Acceptance criteria

- AC4.3: A schedule created from Alice's session records Alice as its owner at create
  time, and that owner persists even after the origin session is swept by `childgc`.
  - verify: `TestCallerIdentity_Scenario4_ScheduleOwnerCapturedAtCreate`
- AC4.4: A scheduled fire's `sched--` session records `Owner.Subject ==` the schedule
  owner's subject with `GrantType == client_credentials` (injected via the explicit
  CreateSessionOption, not the scheduler's system principal), and its events carry
  the same actor.
  - verify: `TestCallerIdentity_Scenario4_FireRunsAsOwnerClientCredentials`
- AC4.6: A schedule created out-of-band (REST/CLI, no origin session) under a
  verified principal records the context principal as its owner — not an
  origin-session lookup.
  - verify: `TestCallerIdentity_Scenario4_OutOfBandScheduleOwnerFromContext`
