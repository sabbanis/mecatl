# Handover — `toolhive-core/authn`: extract and harden OIDC token-validation primitives

*Status: handover for work in the `toolhive-core` repo. Authored from mecatl's
caller-identity track (see `docs/agent-identity-model.md` phase 1). This doc is the
contract for a change that lands in **ToolHive's shared library**, not in mecatl.*

**One sentence:** extract ToolHive's existing, battle-tested JWT bearer-token
validation into a new `github.com/stacklok/toolhive-core/authn` package — a single
`Validator` that verifies an inbound token and returns a credential-free principal —
hardening four known weaknesses in the same pass, so mecatl (and later ToolHive
itself) can validate-and-attribute without re-implementing it.

---

## Why this exists

mecatl is adding optional OIDC authentication at its API edge. Its scope is narrow:
**validate an inbound `Authorization: Bearer <token>` and derive one principal
(`iss` + `sub` + optional `name`).** No authorization-code flow, no scopes, no token
exchange, no refresh, no outbound on-behalf-of calls. The token is consumed at the
edge and dropped.

ToolHive already implements almost all of this correctly in `pkg/auth` — but as
**unexported methods** on a heavyweight `TokenValidator` that also carries
introspection, an embedded-auth-server key provider, upstream-token enrichment, and
lazy discovery. mecatl cannot import `pkg/auth` (huge dependency cone: k8s,
containers, registry) and should not fork it. The shared home both repos already
depend on is `github.com/stacklok/toolhive-core`.

Verified against `~/devel/toolhive` @ `3d44435d7` and `toolhive-core@v0.0.35`.

## What ToolHive has today (the reuse inventory)

| # | Primitive | Location (`pkg/auth/`) | Exported? | Reuse verdict |
|---|---|---|---|---|
| P1 | Alg allowlist gate | `token.go:830` `validateTokenHeader` | no | **lift**, then harden (H2) |
| P2 | JWKS key resolution by `kid` | `token.go:874` `getKeyFromJWKS` (+ cache `token.go:657`) | no | **lift** (drop local-provider branch), then harden (H1) |
| P3 | Issuer match | `token.go:933-941` in `validateClaims` | no | **fix, don't lift** (H3) |
| P4 | Audience membership | `token.go:943-960` in `validateClaims` | no | **lift** (correct as-is) |
| P5 | Time claims (exp/nbf/iat) | `token.go:963-966` (only `exp`) | no | **author** (H4) |
| P6 | Verify composition | `token.go:1039` `ValidateToken` | yes, but inseparable | **compose new** |
| P7 | Discovery → JWKS URI | `token.go:441` `discoverOIDCConfiguration` | no | **lift thin slice** |
| P8 | Claims → principal | `context.go:189` `claimsToIdentity`; `identity.go:22` `PrincipalInfo` (exported) | partial | **lift** + surface `iss` |

Confirmed corrections to earlier assumptions:

- **P7 is NOT `pkg/auth/discovery`.** The validator uses its own thin private
  `discoverOIDCConfiguration` (GET `{iss}/.well-known/openid-configuration`, decode,
  require `jwks_uri`). The public `pkg/auth/discovery` package
  (`ValidateAndDiscoverAuthServer`, `discovery.go:1077`) is a different, heavyweight
  client-side concern (DCR, resource metadata, `x/oauth2`) — irrelevant to inbound
  validation. Do not touch it.
- **P8's `claimsToIdentity` is at `context.go:189`, not `identity.go`.**
- **`PrincipalInfo` has no `Issuer` field.** mecatl's principal is the `(iss, sub)`
  pair, so `iss` must be surfaced (new field, or read from the returned claims map).

## Dependencies (confirmed clean)

The primitives proper need only:

- `github.com/golang-jwt/jwt/v5` — parse/verify, `MapClaims`, parser options.
- `github.com/lestrrat-go/jwx/v3/jwk` + `github.com/lestrrat-go/httprc/v3` — the JWKS
  cache (background refresh, `Lookup`, `LookupKeyID`, `Export`).
- stdlib.
- `toolhive-core/audit` (in-core already) — only if P8 keeps the RFC 8693 `act`-claim
  parse; mecatl does not need it, so **leave the delegation-chain parse behind**.

Do **not** pull: `pkg/networking`, `pkg/oauthproto` (the discovery-doc struct is ~20
lines — re-author or move it), `pkg/auth/upstreamtoken`, `pkg/authserver/.../keys`
(the local-key-provider seam — mecatl has no embedded auth server).

Go only compiles what is imported, so a `toolhive-core/authn` importing jwt/v5 +
jwx/v3 + stdlib costs a consumer exactly those in its build graph even though
`toolhive-core`'s require cone is large (sigstore, registry, postgres, redis).

## The four hardening fixes (do them in the same pass)

**H1 — P2: refresh-on-unknown-`kid` + negative cache.** ToolHive's `LookupKeyID`
miss is a hard error with no `cache.Refresh` retry and no negative caching
(`token.go:913-917`). Consequence: at the IdP's first key rotation, every request
fails until the background refresh lands; and an attacker spamming random `kid`s can
amplify JWKS fetches. Fix: on a `kid` miss, trigger exactly one serialized
`cache.Refresh`, and negative-cache the `kid` for ~30s.

**H2 — P1: allow RSA-PSS (PS256).** `validateTokenHeader` accepts only
`SigningMethodRSA` and `SigningMethodECDSA`, rejecting `SigningMethodRSAPSS`. PS256
is legitimate for OIDC. Accept the RSA-PSS family too; keep rejecting `none`, HMAC,
and EdDSA (unless an EdDSA need is named). The gate must keep running **before** key
selection (it is the algorithm-confusion defense, RFC 8725 §3.1).

**H3 — P3: exact-match issuer, drop `TrimSpace`.** `token.go:939` compares
`strings.TrimSpace(issuerClaim) != strings.TrimSpace(v.issuer)`, accepting
padded-whitespace issuers — a deviation from OIDC Core §3.1.3.2 byte-exact matching.
Fix: compare exact strings.

**H4 — P5: author time claims with leeway.** ToolHive checks only `exp`, with zero
clock-skew leeway and no `nbf`/`iat` handling (`token.go:963-966`). Author exp + nbf
+ iat with ~60s leeway. Prefer composing golang-jwt v5's parser options
(`jwt.WithLeeway`, `jwt.WithNotBefore`, `jwt.WithIssuedAt`) over hand-rolling.

Each fix gets its own pinning test.

## The deliverable

A new package `github.com/stacklok/toolhive-core/authn`:

- `type Config struct { Issuer, Audience, JWKSURL string; Leeway time.Duration; HTTPClient *http.Client; SupportedAlgs []string }`
  - `JWKSURL` set ⇒ skip discovery (static/air-gapped/offline-test path). Empty ⇒
    discover from `Issuer`.
  - `Audience` required when validating for a resource server (set-membership).
- `type Validator struct{ … }` — owns the jwx cache.
- `func NewValidator(ctx context.Context, cfg Config) (*Validator, error)` —
  fail-closed: an unreachable JWKS at construction is an error, never an accept-all.
- `func (v *Validator) Validate(ctx context.Context, bearer string) (*Principal, error)`
  — runs the full checklist: structure → alg allowlist (H2) → signature (P2/H1) →
  `iss` exact (H3) → `aud` membership (P4) → exp/nbf/iat with leeway (H4) → `sub`
  non-empty. JWT-only: a non-JWT (not 3 segments) is a clear error, **no
  introspection branch**.
- `type Principal struct { Issuer, Subject, Name string }` — credential-free. No
  token, no upstream tokens, no claims map required (mecatl needs `iss`+`sub`+`name`
  only; keep `Claims` out or optional).

Behavioral contract: signature verification is the non-negotiable; `aud` is required
(a token minted for another service in the same realm must not pass); expiry leeway
~60s; fail-closed everywhere; never log the raw token (log `sub` only).

## Out of scope (do not build)

- Authorization-code flow, PKCE, state, nonce, callback handlers — mecatl never
  redirects; the client brings a token it obtained out of band.
- Token introspection (RFC 7662) — JWT-only mandate; opaque tokens are refused.
- Token exchange (RFC 8693), refresh, UserInfo calls, revocation checking.
- Changing ToolHive's `pkg/auth` — this extraction is additive to `toolhive-core`;
  a later dedupe can make ToolHive consume `authn`, but that is not this change.

## Done when

- `toolhive-core/authn` exists with `NewValidator` + `Validate` + `Principal`,
  depending only on jwt/v5 + jwx/v3 + stdlib.
- The four hardening fixes are in, each pinned by a test (refresh-on-unknown-kid;
  PS256 accepted; padded-issuer rejected; leeway honored on exp/nbf/iat).
- A token with wrong issuer, wrong audience, expired, bad signature, `alg=none`, or
  an HS\*-confused alg is rejected; a valid RS256/ES256/PS256 token yields the
  `(iss, sub)` principal.
- `pkg/auth` is byte-identical (no behavior change to ToolHive itself).
- mecatl can `require github.com/stacklok/toolhive-core` and call
  `authn.NewValidator(...).Validate(...)` with no k8s/container/registry import.

## References

- Lifts: `pkg/auth/token.go:830` (P1), `:874`/`:657` (P2), `:943-960` (P4),
  `:441` (P7 thin), `pkg/auth/context.go:189` (P8), `pkg/auth/identity.go:22`
  (`PrincipalInfo`).
- Bugs: `pkg/auth/token.go:939` (TrimSpace issuer), `:963-966` (exp-only, no leeway),
  `:913-917` (no refresh-on-kid).
- jwx cache semantics: `lestrrat-go/jwx/v3/jwk/cache.go` (`Register`/`Lookup`/`Refresh`).
- mecatl side: [`docs/agent-identity-model.md`](agent-identity-model.md) (phase 1),
  [ADR-0100](adr/0100-caller-identity-threading.md), and the
  [caller-identity acceptance plan](acceptance/caller-identity.md).
