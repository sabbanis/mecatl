---
id: 09-actor-is-the-caller
title: Event.Actor names the acting caller; every durable append path stamps
blocked_by: [08-repair-panel-findings]
status: pending
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

Repair wave 2 — the ship-blocker both reviews found. The contract has ALREADY
been amended on the accumulator (`docs/adr/0100-caller-identity-threading.md`
decision 5, and AC4.1 / AC4.4 / AC4.5 plus the Scenario 4 narrative in
`docs/acceptance/caller-identity.md`). **Read those first — they are the spec you
are implementing.** Do not edit either file; the orchestrator owns them.

## The defect

`Service.eventActor` resolved the attribution from the LOADED SESSION'S OWNER:

```go
st, ok := s.runs[id]
owner := *st.sess.Owner
```

This phase deliberately ships no authorization — `user-docs/deployment/mecated.md`
says plainly that "any authenticated caller can still list and act on any
session". So when caller B drives a session owned by A, every durably logged
event of that run was stamped `Actor = A`. Repudiation in both directions, and
worst on `EvApproval`, where the record *is* a human granting a tool permission.

## The fixes

**1. Stamp from the context principal.** `internal/adapter/server/service.go`.
`eventActor` reads `session.PrincipalFromContext` instead of the run registry's
session owner. All seven `appendEvent` call sites already pass a
`context.WithoutCancel(handlerCtx)`, which preserves context VALUES while
detaching cancellation — so the true caller is already in reach at every site
(`grpc.go`, `http.go`, `grpc_approveplan.go`). Verify that for yourself at each
site rather than trusting this brief.

Note what this also deletes: the undocumented dependency on the run still being
registered in `s.runs` during the drain. The old code degraded to a nil Actor with
no signal if the run had been unregistered; the new one has no such coupling.

Signature will change (`eventActor(ctx)` rather than `eventActor(id)`) — the `id`
may become unused there; let the compiler and linter guide you.

**2. Stamp the schedule lifecycle events too.**
`internal/adapter/server/schedule_manager.go` `emitScheduleEvent` builds a
`session.Event` and calls `m.eventLog.Append` **directly**, bypassing
`appendEvent` — so `fired`/`failed` events land with `Actor == nil` while the
fire session's run events are stamped. That contradicts `appendEvent`'s own
doc-comment ("Do not add a second stamping path") because a second path already
existed. Route it through the single chokepoint.

Watch out: it currently builds its context as
`context.WithoutCancel(context.Background())` — a FRESH background context that
carries no principal at all, so simply routing it through the chokepoint would
still stamp nil. Thread the real calling context through (the scheduler's, which
carries the system principal via `internal/syscaller`) so a `fired` event names
`system`/`scheduler`. Keep the existing cancel-detachment: a fire's ctx may be
cancelled when the run ends, and that must not abort the durable append.

**3. Update the field's doc-comment.** `engine/session/event.go`'s `Actor`
comment currently says it is stamped "from the LOADED SESSION'S OWNER" and that
"the session owner remains the identity of record". Rewrite it to the new
contract: the acting caller, from the context principal; the owner still answers
"whose is this?" and the actor answers "who did this?"; they routinely differ
because this phase ships no authorization.

## What must NOT change

- `Actor` stays **log-only**: `toProto` must still omit it on BOTH relays (gRPC
  `Converse` and HTTP SSE), and `eventsource.Fold` must still ignore it. AC4.2
  and its test stand as-is.
- Absence is never fabricated: no verified caller ⇒ nil Actor.
- The session OWNER semantics are untouched — write-once at create, children
  inherit the parent, fork inherits the source, `WithOwner` overrides. Only the
  EVENT attribution changes.
- The loop stays identity-agnostic: every emit site still leaves `Actor` nil, and
  nothing in `engine/agent` learns about principals.

## Tests

The three Scenario-4 `verify:` names must keep working (`ac-trace --strict` gates
them) but their ASSERTIONS change:

- `TestCallerIdentity_Scenario4_EventActorStampedAtAppendOnly` — the case that
  proves the fix: a session owned by **Alice**, a run driven under a context
  carrying **Bob**, appended events stamped **Bob**. The current test only
  exercises the single-principal case, where owner and actor coincide and the bug
  is invisible. Add the divergent case and watch it fail before the fix.
- `TestCallerIdentity_Scenario4_FireRunsAsOwnerClientCredentials` — the fire's
  SESSION still records the schedule owner with `client_credentials`; its EVENTS
  now name `system`/`scheduler`. Assert both halves, and assert the schedule
  lifecycle (`fired`) event is stamped too, not nil.
- `TestCallerIdentity_Scenario4_OwnerlessEventActorAbsent` — reframe around "no
  verified caller on the context ⇒ nil actor".

## Acceptance criteria

Gate: `task lint` rc=0, `task test` rc=0, the divergent owner-vs-actor case
watched failing before the fix, all 23 existing `verify:` tests green, and
`Actor` still absent from both client wires and from the fold.
