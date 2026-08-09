---
id: 04-system-principal-goroutines
title: Internal goroutines run under an explicit system principal
blocked_by: [02-edge-accept, 03-session-owner]
status: pending
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

Scenario 2 (AC2.2) of `docs/acceptance/caller-identity.md`; `ADR-0100`
decision 7. Internal work that has no caller runs under an **explicit** system
principal, never an absent one — so the day an enforcement check lands (the
isolation track, #368), these callers do not break silently or, worse, get
treated as an anonymous user.

Wrap each internal goroutine's root context with
`session.WithPrincipal(ctx, &session.Principal{GrantType: system})` at the point
the goroutine's context is created — composition / server concerns, never loop
concerns (`AGENTS.md` — the layering rule; the loop stays storage- and
identity-agnostic and must not learn about principals).

The enumerated set (AC2.2):
- `childgc`
- both memory / dream consolidators
- the scheduler `tick`, `fire`, delivery, and reconcile loops, and the fire
  goroutine
- the validator's background JWKS refresh (task 02's server-root context)

**The test must enumerate the set once, not hard-code a per-call-site
assertion.** The point of the AC is that a *new* goroutine that forgets the
principal fails the test. Find the honest structural shape — a single registry /
table of the internal context roots that both the production wiring and the test
read, so adding a goroutine without registering it is what goes red. If the
cheapest honest shape is a table-driven test over named constructors, that is
fine; what is not fine is N independent assertions that a future goroutine can
simply not be added to.

Watch the negative half fail before you believe it: plant a goroutine root that
skips the wrap, confirm the test goes red, remove it.

## Acceptance criteria

- AC2.2: Every composition/server goroutine that crosses a port boundary — `childgc`,
  both dream consolidators, the scheduler tick/fire/delivery/reconcile loops, the
  fire goroutine, and the validator's JWKS background refresh — observes a non-nil
  principal with `GrantType == system`. The set is enumerated once in the test, not
  hard-coded per-call-site, so a new goroutine that forgets the principal fails.
  - verify: `TestCallerIdentity_Scenario2_InternalGoroutinesRunAsSystem`
