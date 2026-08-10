---
id: 10-authn-library-readiness
title: Ready the edge for toolhive-core/authn — GrantType derivation, validator teardown, config pinning
blocked_by: [09-actor-is-the-caller]
status: done
branch: "plan-caller-identity/10-authn-library-readiness"
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

`toolhive-core/authn` now exists (a worktree at
`/Users/jakub/devel/toolhive-core/.worktrees/authn`, branch `authn`). Reviewing it
against our `PrincipalValidator` seam turned up five deltas. This task closes the
four that can be closed **without** taking the dependency.

## The hard constraint — read this first

**You cannot import the library yet, and you must not try.** `authn` is NOT in any
tagged release: it is 13 commits ahead of `v0.0.38` on an unmerged branch, and
mecatl's `go.mod` has `toolhive-core v0.0.26` as an indirect dep. A local
`replace` directive pointing at someone's worktree must NEVER land on a committed
branch. So:

- Do NOT add or bump a `toolhive-core` requirement.
- Do NOT add a `replace`.
- Do NOT write an adapter that imports `authn`.
- `OIDCConfig.NewValidator` stays nil in both mains, and `--oidc-issuer` stays a
  fatal startup error. That posture is correct and stays.

Everything below is dependency-free: it operates on plain `map[string]any` claims,
on our own interfaces, and on docs. The final wiring — one adapter that constructs
`authn.NewValidator` and maps its types — is a FOLLOW-UP task once the library
merges and tags.

## Reference: the library's actual API (verified, do not re-derive)

```go
type Principal struct {                  // NOTE: no GrantType
    Issuer, Subject, Name string
    Claims map[string]any
}
func NewValidator(ctx context.Context, cfg Config) (*Validator, error)
func (v *Validator) Validate(ctx context.Context, token string) (Principal, error)  // VALUE, not pointer
func (v *Validator) Close()              // stops background JWKS refresh; idempotent
func ParseBearer(headerValue string) (string, error)
type Error struct { Code Code; Reason Reason; ... }   // NOT errors.Is-able sentinels
```

Error codes: `CodeInvalidRequest` (400), `CodeInvalidToken` (401),
`CodeUnavailable` (503 — key material unreachable).

## The fixes

**1. `GrantType` derivation — the one that would otherwise 401 every valid token.**
`authn.Principal` has no `GrantType`; `session.Principal` requires one; and task
08's `admissiblePrincipal` guard rejects `!p.GrantType.Valid()`. A naive
field-copy adapter therefore produces `GrantType == ""` and **every valid token is
rejected at the edge**. The library offers no helper — no `azp`, `cid`,
`client_id` or grant handling anywhere in it — so this derivation is entirely
ours.

Write it now, dependency-free, as a function over the claim set:

```go
// in internal/adapter/server (or a small sibling), taking plain claims
func grantTypeFromClaims(claims map[string]any) session.GrantType
```

Rules, and the reasoning to encode in its doc comment:
- A token minted by the **client-credentials** grant has no human behind it. The
  usual signals: no `sub`-distinct-from-client identity, or an explicit
  `grant_type`/`gty` claim (Auth0 uses `gty: "client-credentials"`), or `azp`
  equal to `sub`, or a `client_id` claim equal to `sub`. Pick the signals you can
  justify; document which and why.
- Otherwise default to `session.GrantTypeUser` — the conservative choice for an
  audit label, since mislabelling a machine as a user overstates human
  involvement far less dangerously than the reverse... **actually reason this
  through yourself and justify whichever default you pick in the comment.** The
  one thing that is NOT acceptable is returning an invalid/empty grant, because
  `admissiblePrincipal` turns that into a blanket 401.
- **NEVER derive `session.GrantTypeSystem` from a token.** That value is minted
  in-process by `internal/syscaller` only, and task 08's guard already refuses an
  external principal presenting it. A derivation that could return it would be a
  privilege-confusion bug.

Table-test it: a user-ish claim set, a client-credentials-ish one, an empty map,
and a claim set with a hostile `grant_type: "system"` (must NOT yield
`GrantTypeSystem`). Assert every returned value satisfies `Valid()`.

**2. Validator teardown — the seam has no `Close`, and ADR 0027 says something
now false.** The library's `Close()` stops the background JWKS refresh and
documents that `Validate` after `Close` fails fast with `CodeUnavailable`. Our
`PrincipalValidator` is a single-method interface with no teardown, and ADR-0027
List 1 row 39 currently claims cleanup happens "via the root context's cancel" —
**cancelling the ctx does not call `Close()`**, so that row is wrong.

Close the gap without taking the dep: have the edge (or composition) type-assert
an OPTIONAL `io.Closer` on the configured validator and call it on shutdown, the
same optional-capability idiom `port.HookApprovalLearner` uses (type-asserted,
never widening the base interface — widening `PrincipalValidator` would break the
fake and every test). Pin it with a fake validator that also implements
`io.Closer` and assert `Close` is called exactly once on shutdown.

Then correct ADR-0027 row 39 to state the real cleanup mechanism.

**3. Error mapping — write the mapper now, against the code taxonomy, not the
types.** Our two sentinels must keep their meanings (AC1.5 depends on the
401-vs-503 split, which the library made independently). Since the library's
errors are a struct rather than sentinels, the eventual adapter must switch on
`Code`:

| library | ours |
|---|---|
| `CodeInvalidToken` (401), `CodeInvalidRequest` (400) | `ErrInvalidToken` |
| `CodeUnavailable` (503) | `ErrIdentityUnavailable` |

You cannot type-assert `*authn.Error` without the dep. So do the part you can:
document this table in `internal/cliconfig/oidc.go`'s doc comment (next to the
`NewValidator` injection point, where the future adapter goes) so the mapping is
decided and reviewable now rather than improvised later. If you can express it as
a dependency-free helper over a `string` code, do that and test it; if that reads
as speculative scaffolding, the doc comment is enough — your call, say which you
chose and why.

**4. Pin the security-relevant config defaults, in docs.** The library's `Config`
is much richer than our three flags: `Audiences []string` (plural),
`AllowAnyAudience`, `Leeway`, `MaxJWKSStaleness`, `AcceptedTokenTypes`,
`MaxTokenLifetime`, `HTTPClient`, `InsecureAllowHTTP`, `AllowPrivateIP`,
`CACertPath`, `KeyProvider`.

Our `--oidc-audience` (singular) maps to `Audiences[0]`. Record in
`internal/cliconfig/oidc.go` which defaults mecatl will pin rather than inherit —
at minimum `AllowAnyAudience: false` and `InsecureAllowHTTP: false`, since an
audience-less verifier accepts tokens minted for another service and plaintext
JWKS defeats the whole exercise. State whether `--oidc-audience` should become
repeatable later. Do NOT add flags for the rest now (YAGNI); just record the
decision so the follow-up does not improvise it.

## What must NOT change

- No new dependency, no `replace`, no import of `authn`.
- `PrincipalValidator` stays a single-method interface (teardown is an optional
  type-assertion).
- `OIDCConfig.NewValidator` stays nil; `--oidc-issuer` stays fatal.
- Every existing AC and its named test stays green. AC1.2's deferral wording in
  `docs/acceptance/caller-identity.md` stays as-is — it is discharged by the
  FOLLOW-UP that takes the dep, not by this task. Do not edit that file; the
  orchestrator owns it.

## Acceptance criteria

No new numbered ACs. Gate: `task lint` rc=0, `task test` rc=0, the `GrantType`
derivation table-tested (including that a hostile `system` claim cannot produce
`GrantTypeSystem`), the `Close` path pinned by a closer-implementing fake, ADR-0027
row 39 corrected, and the config/error decisions recorded where the future adapter
will be written. All 23 existing `verify:` tests still green.

Note in your report what the follow-up task still needs to do, so it can be
scoped without re-deriving the library's API.
