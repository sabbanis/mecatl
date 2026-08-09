---
id: 01-principal-context
title: WithPrincipal/PrincipalFromContext — the no-fabricated-principal seam
blocked_by: [00-field-prep]
status: pending
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

The context seam every later task threads through. Small and load-bearing.

**`engine/session` — the context helper.** An **unexported empty-struct**
context key plus `WithPrincipal(ctx, *Principal) context.Context` and
`PrincipalFromContext(ctx) *Principal`. Absent ⇒ **nil**, never a fabricated
value — this is the invariant the whole plan rests on (`ADR-0100` decision 2:
ToolHive's anonymous middleware mints a `sub: "anonymous"` with forged exp/iat;
that is the anti-pattern being rejected). A nil `*Principal` stored through
`WithPrincipal` must read back as absent, not as a non-nil empty principal.

Stdlib + domain only. No port interface gains a principal parameter — the
principal rides the context, and that is the design (`AGENTS.md` — the layering
rule; the existing depguard allowlist + the `engine/arch/layering_test.go` DAG
gate already enforce that nothing mis-layered creeps in).

AC2.1's `verify:` name is `TestInvariant_no_fabricated_principal` — that is an
**invariant** pin, so it lands with its invariant text: add a short bullet to
`AGENTS.md` under "Things That Will Bite You" naming the rule (absent = nil,
never fabricated; identity is `(iss, sub)`, never `sub` alone), and the test
enforces it. A new invariant never lands without its enforcing test. You touched
markdown ⇒ `task docs`.

AC2.3 has `verify: none` — it is satisfied by the existing depguard + DAG gate,
not by a new test. Confirm those gates stay green; do not add a bespoke test for
it.

Do not wire the OIDC verifier, do not stamp any owner, do not touch the internal
goroutines — those are tasks 02, 03, and 04.

## Acceptance criteria

- AC2.1: `WithPrincipal`/`PrincipalFromContext` round-trips a principal, and a
  context with none returns nil (absent), never a fabricated value — the
  no-fabricated-principal invariant.
  - verify: `TestInvariant_no_fabricated_principal`
- AC2.3: No port interface signature gains a principal parameter — the principal
  rides the context.
  - verify: none — guarded by the existing depguard + `engine/arch` layering DAG gate (the principal never appears in a port signature; the DAG test fails on a mis-layered import)
