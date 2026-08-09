---
id: 02-edge-accept
title: Accept a verified principal at the authn.go edge (OIDC, behind its own predicate)
blocked_by: [01-principal-context]
status: in-progress
branch: ""
worktree: ""
issue: "367"
retries: 0
last_error: ""
accumulator: acc/caller-identity
---

# Task brief

Scenario 1 of `docs/acceptance/caller-identity.md`; `ADR-0100` decisions 2 and 3.
Extend the **existing** `internal/adapter/server/authn.go` seam — it already has
the gRPC unary + stream interceptors, the HTTP middleware, and per-client rate
limiting. Do not build a parallel auth stack.

**The validator is behind a seam, not a hard dependency.** `toolhive-core/authn`
is being built by a sibling agent and does **not** exist in the module cache
today (`toolhive-core v0.0.26` has no `authn` package). So: define a narrow
mecatl-side interface in `internal/adapter/server` — one method, roughly
`Validate(ctx, bearer) (*session.Principal, error)` — plus the small error
taxonomy the ACs need (a bad-token error vs a transient JWKS-unreachable error;
`errors.Is`-able sentinels). Tests drive a **fake** verifier implementing it
(offline, always — no live IdP, no network). Wiring the real
`toolhive-core/authn` behind the same interface is a later flip, out of scope
here. Do NOT hand-roll JWT/JWKS parsing in mecatl — the seam's whole point is
that validation is delegated.

**Its own enabled-predicate.** Add `identityConfigured` (or similarly named),
true iff a verifier is wired. It is **independent of `authEnabled()`**, which
means "a static shared token is configured" and is a latent fail-open in both
directions (a shared-token deployment has one credential and zero subjects; an
OIDC deployment may have subjects and no static token). Neither predicate may
trip the other's gate.

**Behaviour at the edge.** With a verifier wired: `bearerFromAuthValue` →
`Validate` → `session.WithPrincipal` on the handler context. A rejected token is
a clean 401-class error; a non-JWT is a clean malformed error, never a fallback
branch that lets the request through. A JWKS-unreachable condition is a
**transient 503-class** signal, distinct from a 401 bad token — an IdP outage
must not be misread as an authn failure. With no verifier wired: nothing changes
— the handler sees a nil principal and the path is **byte-identical to today**,
including the TUI's default no-token path.

**Rate limiting re-keyed.** Under OIDC, key on the validated `(iss, sub)`, not
the raw token string (`clientKeyFromToken`) — token rotation must not be a limit
bypass, so two different valid tokens for the same subject share one bucket. A
**rejected** token is never keyed (a bad token must not consume or create a
bucket).

**Composition (`cmd/mecated` + `cmd/mecak8s`).** `--oidc-issuer`,
`--oidc-jwks-uri` (static — short-circuits discovery; the offline-test and
air-gap hook), `--oidc-audience` (required when OIDC is on). The validator is
constructed with the **server-root** context (it governs background JWKS
refresh), never a per-request ctx. **OIDC-misconfigured is fatal at startup:**
flags set but validator construction failing ⇒ the server refuses to start,
never a silent degrade to the unauthenticated path.

Note for the shared mecated/mecak8s credential wiring: `internal/cliconfig` is
where the four real-provider mains share flag/env plumbing — follow the existing
shape rather than duplicating flag parsing in each main.

Do not stamp any session owner (task 03), do not touch the internal goroutines
(task 04).

## Acceptance criteria

- AC1.1: With OIDC configured, a request bearing a valid RS256/ES256/PS256 token from
  the configured issuer+audience yields the `(iss, sub)` principal on the handler's
  context.
  - verify: `TestCallerIdentity_Scenario1_ValidTokenYieldsPrincipal`
- AC1.2: A token from the wrong issuer, wrong audience, expired, not-yet-valid
  (`nbf` in the future beyond leeway), bad signature, `alg=none`, or HS\*-confused
  is rejected; a non-JWT is a clean malformed error, never a fallback branch.
  - verify: `TestCallerIdentity_Scenario1_BadTokensRejected`
- AC1.3: With OIDC **not** configured, a request with no token is processed
  unauthenticated — the handler sees a nil principal, the log says unauthenticated,
  and no user is invented. The behaviour is byte-identical to today (the TUI's
  default no-token path is unchanged).
  - verify: `TestCallerIdentity_Scenario1_NoAuthByteIdentical`
- AC1.4: The OIDC enable predicate is independent of `authEnabled()`: a
  shared-token-only deployment has one credential and zero subjects, and an OIDC
  deployment may have subjects and no static token — neither trips the other's gate.
  - verify: `TestCallerIdentity_Scenario1_IdentityPredicateIndependent`
- AC1.5: A JWKS-unreachable condition surfaces as a transient 503-class signal
  distinct from a 401 bad-token, so an IdP outage is not misread as an authn failure.
  - verify: `TestCallerIdentity_Scenario1_JWKSDownIsTransientNotUnauthorized`
- AC1.6: With OIDC flags set but validator construction failing (an unreachable JWKS
  with no `--oidc-jwks-uri` static override), the server refuses to start rather than
  silently degrading to the byte-identical unauthenticated path — OIDC-misconfigured
  is fatal, never a silent fail-open.
  - verify: `TestCallerIdentity_Scenario1_MisconfiguredOIDCFailsToStart`
- AC1.7: Under OIDC the rate limiter keys on the validated `(iss, sub)`, not the raw
  token — two requests bearing different tokens for the same subject share one bucket
  (token rotation is not a limit bypass), and a rejected token is never keyed.
  - verify: `TestCallerIdentity_Scenario1_RateLimitKeyedOnPrincipal`
