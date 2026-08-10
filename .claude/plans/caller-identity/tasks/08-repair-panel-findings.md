---
id: 08-repair-panel-findings
title: Repair the mechanical panel + MoE review findings (identity copy, owner race, aliasing, test gaps)
blocked_by: [07-docs-crosscutting]
status: done
branch: "plan-caller-identity/08-repair-panel-findings"
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

Repair wave 1. Two independent reviews (a six-agent panel and an MoE review)
found findings on the assembled accumulator. This task fixes the **mechanical**
subset only — the ones with a clear correct answer and no design decision.

**EXPLICITLY OUT OF SCOPE** (a human is deciding these; do NOT touch them):
- The `Event.Actor` semantics question (whether it should name the session owner
  or the acting caller). Leave `Service.eventActor` and `appendEvent` alone.
- Consequently, the scheduler-lifecycle-event stamping gap in
  `scheduleManager.emitScheduleEvent` — its fix depends on that answer.
- Amending AC1.2 / AC2.2 wording in the acceptance plan.
- Wiring a real OIDC validator (blocked on `toolhive-core/authn`).

Do NOT edit `docs/acceptance/caller-identity.md` — the orchestrator owns it.

## The fixes

**1. `PrincipalFromContext` must return a COPY.**
`engine/session/principal_context.go`. `WithPrincipal` copies on the way in, but
the read path hands back the stored pointer, so a caller can mutate `Subject`
and change what the context reports for every later reader — corrupting
ownership and audit attribution downstream. The doc-comment on `WithPrincipal`
already promises "a later mutation through the caller's pointer cannot change
what the context reports"; today that promise only covers half the round trip.
Return a copy, and pin it with a test that mutates the returned principal and
asserts the context is unchanged (watch it fail first).

**2. Add `(*Principal) Clone()` and fix the ListSessions aliasing bug.**
Nine sites hand-roll the same "copy a `*Principal` across a boundary, nil stays
nil" rule; the ninth — `internal/adapter/server/service.go` in `ListSessions`
(`summary.Owner = sess.Owner`) — hands out a **live pointer into the loaded
session** and is the one that already diverged. This is the same class as the
`cloneSpec` aliasing bug that shipped in task 06.

Add a small `Clone` method beside the type in `engine/session/principal.go`
(nil-receiver-safe, returns nil for nil), then route the copy sites through it,
**including the ListSessions one that is currently wrong**. `Principal` is
all-strings today so a shallow copy is a deep copy — the point is that the day
it gains a slice or map field, all sites stay correct together rather than
becoming silent aliasing bugs. One nil/non-nil table test. Engine API widens ⇒
`task api:update` + an `engine/CHANGELOG.md` Added note.

**3. Close the schedule-owner deletion race (AC4.3).**
`internal/adapter/server/schedule_manager.go`. `validateScheduleOrigin` loads
the origin session, then `captureScheduleOwner` loads it a **second** time and
turns a miss into a nil owner. If the session is deleted between the two reads
(`childgc` sweeps on retention — the exact hazard ADR 0100 decision 6 was
written for), validation passes and the schedule is created **silently
ownerless**. The code comment currently reasons the re-read is safe because the
session was "Loaded moments earlier"; that is the window.

Thread the already-validated load's owner through instead of re-reading. Keep
the three capture rules intact (origin session's owner / context principal for
out-of-band / nil, never fabricated). Pin the race: assert that the owner comes
from the validated load, e.g. by driving a store whose second `Load` of that id
fails and asserting the schedule still records its owner.

**4. Harden the edge against a bad principal from the validator.**
`internal/adapter/server/authn.go` `identify`. It accepts any non-nil principal
the validator returns — including one with an empty `Issuer`/`Subject`, an
invalid `GrantType`, or `Issuer` equal to the internal namespace. An empty
principal is exactly the fabricated-anonymous caller ADR 0100 decision 2
rejects, arriving through the front door; and an external token presenting the
internal issuer is byte-identical to a system caller at every downstream
consumer — which the isolation track (#368) will read to make decisions.
`session.GrantType.Valid()` already exists and has **zero** production callers.

Reject at the seam: a principal missing `Issuer` or `Subject`, one whose
`GrantType` is not `Valid()`, and one presenting the internal issuer or the
system grant. All become `ErrInvalidToken` (401-class, not 503). Table-test each
rejection and assert no rate-limit bucket is created for a rejected principal.
`internal/adapter/server` may import `internal/syscaller` (`internal/cliconfig`
already does) for the issuer constant.

**5. Make AC2.2's test observe fire/delivery/reconcile, not just the tick.**
`internal/app/system_principal_test.go`. The scheduler driver's `SetFire`
callback is a no-op that never calls `seen(ctx)`, so only the tick loop's `Due`
poll is observed; fire, delivery and reconcile rest on an inheritance argument
in a comment. A future `context.Background()` in any of those paths passes CI
today. Make the fire callback observe its ctx, and reach the delivery and
reconcile paths too if you can do it without contorting the test. If one
genuinely cannot be driven offline, say so in your report rather than leaving a
silent gap.

**6. Extend AC3.3's anti-laundering proof to Parallel and Team.**
`engine/agent/caller_identity_owner_test.go`. Its comment claims
`subagent-`/`parallel-`/`team-` but it only loads `subagent-p1`. Parallel
branches and team members are created through the same `parentCaps.inheritOwner`
seam; prove the same source-owner-beats-caller-owner property for them (drive
the run under a DIFFERENT principal than the parent's owner, as the existing
Subagent case does).

**7. Test gRPC stream authentication.**
`internal/adapter/server/caller_identity_test.go` exercises only
`UnaryInterceptor`; `StreamInterceptor` has its own `principalStream` wrapping
logic that no test touches. Add the stream equivalents of the valid-token,
bad-token and no-identity cases.

## Acceptance criteria

No new numbered ACs — this task repairs findings against the existing ones. Its
gate is: `task lint` rc=0, `task test` rc=0, every fix above pinned by a test
that was watched failing first, and the existing 23 `verify:` tests still green.
Findings 1, 3 and 4 are all "an absence/corruption cannot happen" claims —
plant each violation, watch the test go red, then remove it.
