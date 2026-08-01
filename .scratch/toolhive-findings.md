# ToolHive findings from a mecatl identity design review

Found while working out how mecatl (headless agent harness, in-process subagents)
would authenticate to vMCP and carry a subagent identity. All code-verified against
`~/devel/toolhive`. Ordered by what to do first.

Three lines of work are in flight and they aren't one lineage — `main`,
`token-delegation` (13 ahead / 138 behind), and `xaa-spike-1` (9 ahead / 57 behind).
The latter two diverged at release tag `2aca56387` and never touched each other.
Several findings below are about their interaction.

**State, kept strictly separate.** Merged and shipping: the RFC 8693 token-exchange
grant, `checkDelegationConsent` (fail-closed, CWE-863), `act`-chain nesting with a
depth cap, scope intersection and audience narrowing, Cedar nested-map claims
(`d70cc41a0`, #5713), outbound XAA. `token-delegation` only: `oidc-trust`,
`actor_token` acceptance, `id_token` as a subject-token type. `xaa-spike-1` only:
inbound RFC 7523 jwt-bearer, `jwks-trust`, `jti` replay. Nowhere: Direct Backend
Trust, a subagent as a distinct actor, and finding 1.

---

## 1. The blocking item is a decision, and one branch's `act` can't carry delegation at all

Three values for `act.sub` are in flight:

| Source | `act` shape | `act.sub` |
|---|---|---|
| `main`, shipped | `{sub}` + nested `act` | OAuth `client_id` |
| `xaa-spike-1` | `{iss, sub}` | the IdP's subject **for the user** |
| Cedar fixtures, `actor-id.md` opts B/C | — | SPIFFE URI |

`xaa-spike-1` also sets `sub` to an internal `User.ID`. So `(sub, act.sub)` doesn't
denote the same thing across the two paths, and no consumer can write a policy against
`act.sub` until one identifier space is picked.

**But it's worse than an identifier choice.** On `xaa-spike-1`, `act` records the
front-door IdP's issuer and that IdP's subject *for the same user already in `sub`*.
Client auth is skipped on that path, so no code captures which agent presented the
assertion. In RFC 8693 §4.1 terms that `act` is **actor-vacuous**: it restates the user
via a second code path and names no actor. Anything enforcing on
`(sub, outermost act.sub)` has nothing to bind to there.

`docs/arch/token-delegation-actor-id.md` names the question and defers it. (It cites
`pkg/auth/identity.go` as evidence of SPIFFE use; that file has zero SPIFFE hits on any
of the three branches. Strike the citation, keep the deferral.)

Everything below is cheap by comparison.

## 2. Trust-only providers trip the Cedar provider auto-select — ~10 lines, cheap only pre-merge

`resolvePrimaryUpstreamProvider` (`cmd/thv-operator/pkg/vmcpconfig/converter.go:374`)
is **byte-identical on all three branches**: bare `len(UpstreamProviders) > 0`, then
`[0].Name`, no type discrimination. `converter.go` mentions neither trust type on any
branch.

Both branches add their trust-only type as an enum value on the *existing*
`UpstreamProviderConfig.Type` — same slice. So it fires exactly when Cedar is
configured, which is the delegation deployment.

Two configurations, one root cause:

- **Trust-only, no login upstreams** (the shape `091726e52` explicitly enables):
  `[0]` is *guaranteed* to be a trust entry, `resolveClaims`
  (`pkg/authz/authorizers/cedar/core.go:539`) hits its `!tokenFound` branch and
  errors, and every Cedar-gated tool call hard-denies. A loud fail-closed outage,
  findable in the first integration test.
- **A login provider coexisting and sorting to `[0]`**: Cedar reads that provider's
  claims instead of the minted token's. Order-dependent.

Note `091726e52` ("allow jwks-trust-only config with no login upstreams") doesn't avoid
this — it makes the first case certain. The `partitionUpstreams` filter the authors did
write lives in `pkg/authserver` (runtime), a different path from the operator's authz
converter. One handled, one not.

Fix: exclude trust-only types from the `len()`/`[0]` auto-select, or give them their own
field. After either branch merges it's a CRD migration.

**This is independent of finding 1 and should go first.** The request path is inbound
validation → `cedarAdmission` (the single authorization checkpoint) → `resolveClaims`
→ on allow, dispatch → and only *then* a separate per-backend `GetStrategy(name)` lookup
against the statically-configured `BackendAuthStrategy.Type`. Cedar and the outgoing
strategy are two independent reads of the same `*Identity` with no shared resolved-claims
object, and `xaa.go` never touches `Claims` at all. So this gap is strictly an
authorization-gate problem — it cannot change which backend credential gets minted, and
it doesn't wait on the identifier decision.

## 3. `oidc-trust` and `jwks-trust` are two names for one concept, on two branches

Same idea — trust this issuer's JWKS, it doesn't log users in — with two names, two
CRD surfaces, and two different validators behind them. If both land it's a
config-concept collision. Pick one before either merges.

Related, and evidence the branches are coordinated by hand-off rather than by merge:
`token-delegation`'s `oidc-trust` can never use an explicit JWKS URI, because
`server_impl.go:72` passes a hardcoded `""` for the `jwksURL` argument and always falls
back to OIDC discovery. `xaa-spike-1` carries a literal work order about exactly this
(`rfc-0080-jwksuri-wiring-handover.md`).

## 4. `token-delegation`'s handler is a security regression against main's

Its handler was added April 2026 (`a1b985487`); main's hardened one landed July 2026
(`3040872c8`, #5822). The branch version is **missing** `checkDelegationConsent`,
`act`-chain nesting with `maxDelegationDepth`, and audience narrowing. Building on it
regresses those three protections.

**`xaa-spike-1` is clear** — verified to inherit main's handler with all three present.
So this is confined to `token-delegation`: port its config surface (`oidc-trust`,
`id_token`) onto main's handler and discard the branch handler. `xaa-spike-1` needs no
handler reconciliation.

## 5. Config that ships ahead of its enforcement

Two cases, both of which an operator would reasonably read as protective:

**`allowedClientIDs` enforces nothing.** It is wired — `config.go:392` →
`jwks_trust.go:83` → a public accessor `jwksTrustStorage.AllowedClientIDs(issuer)` at
`jwks_trust.go:287` — but the getter has **no call sites** in `pkg/authserver/`. The
phase plan lists it as out of scope for Phase 1, so the omission is deliberate; the
hazard is the CRD field shipping first, so a deployment believes it has a client
allow-list when it has none.

**No-client-auth is a single global flag.** `0ab59447a` sets
`GrantTypeJWTBearerCanSkipClientAuth: true` in `pkg/authserver/server/provider.go` —
four lines, no per-client policy. That makes the whole grant one-factor for everyone,
including callers that *can* present a credential. Worth making per-client, so a client
holding an SVID or a key isn't defaulted down to bearer-assertion-only.

## 6. No `resource` binding on the inbound ID-JAG

It's accepted on `aud` alone. Meanwhile XAA's *own outbound* `validateIDJAGClaims`
does check `resource` when one was requested — deliberately stricter than the draft. So
the same protocol is validated asymmetrically in the two directions within one
codebase.

## 7. `act` and `tsid` conflict across the two branches

`docs/arch/token-delegation-tsid.md` establishes that a delegated token carrying `act`
MUST NOT carry `tsid`, on least-privilege grounds: `tsid` dereferences to the user's
entire upstream credential store. Its stated consequence is that delegated tokens work
with `header_injection`, `xaa` and `unauthenticated`, and break `upstream_inject`,
`tokenexchange` and `aws_sts`.

`xaa-spike-1:pkg/authserver/jwt_bearer_handler.go:167-171` sets `act` **and** a fresh
`rand.Text()` tsid. Checked for exploitability rather than assumed: `loadUpstreamTokens`
(`pkg/auth/token.go:1179`) keys strictly on tsid and the only
`GetLatestUpstreamTokensForUser` caller is the login path (`callback.go:223`), so the
random tsid resolves to nothing — **not a credential leak**. But
`pkg/auth/identity.go:180` branches on tsid *presence*, so those tokens take the
has-upstream-session branch and find nothing. One branch has to change its mind before
either ships.

**Worth escalating past a branch conflict, though.** `upstream_inject` is the plain-3LO
path — the strategy for a backend that can only do ordinary OAuth, which is a large share
of real backends. So the invariant as written says a delegated token cannot serve the
ordinary case: it keeps `header_injection` (backend already trusts the front door) and
`xaa` (often unavailable), and loses the rest. Any consumer that wants delegation at the
inbound boundary hits this immediately.

The invariant's own rationale suggests the way out: it holds because tsid dereferences to
the user's *entire* upstream credential store. A per-backend or per-scope reference
wouldn't have that property, and would let a delegated token keep 3LO without granting
the whole store. Whether the storage layer can express that is your call — flagging it as
a direction rather than a proposal.

## 8. The one piece SPIFFE client auth needs lives only on a dead branch

`NewClientAuthStrategy` — the fosite `ClientAuthenticationStrategy` that accepts a
SPIFFE identity at the token endpoint — exists **only** on `spiffee-authserver`:
`pkg/authserver/spiffe/strategy.go`, one test, and a single wiring line in
`server_impl.go`. Zero hits on `main`, `token-delegation` or `xaa-spike-1`.

And that branch is a genuine dead end: its merge-base with all three current lineages is
the same commit `1ee7107a4`, so it split off before any of them diverged from each other,
its tip is an ancestor of none of them, and nothing built on any part of it.

So this is roughly two files, and the move is to port the pattern onto main's hardened
handler rather than rebase or revive the branch. Worth knowing because it makes the
SPIFFE-client-auth path the cheapest remaining piece of the whole design — the handler it
would plug into already ships.

It buys two flows for that price, not one. The branch registers the auto-created SPIFFE
client for `client_credentials` as well as `token-exchange`, so the same two files give
an attested workload both a delegated-token path (user present) and a plain
authenticate-as-myself path (no user). The second is what unattended callers need —
scheduled jobs, CI — and it's the honest alternative to giving them a stored human
credential.

## 9. Direct Backend Trust exists nowhere

Seven registered outgoing strategies, none minting a ToolHive-signed JWT for a backend.
It's the cheaper *build* of the two Approach-B halves — the AS already owns a signing key
and publishes its JWKS — and the cheaper *run*, since THV-0079 §3.2 says there's no cache
anywhere in `pkg/vmcp` and `xaa` therefore re-runs both steps on every proxied call. It's
also demoable against a static-key backend with none of the rest.

One caveat on "cheaper," because it cuts the other way per backend. Direct Backend Trust
needs each backend configured to trust vMCP as a *new* issuer, which is the "one-time
trust configuration" cost the XAA-flows doc names for Approach B. XAA rides a trust
relationship that usually already exists — the enterprise SSO one — which is THV-0079
§1.4's own framing. So for a backend whose AS already trusts the front-door IdP, XAA is
the larger build but the smaller deployment ask, and Direct Backend Trust is the reverse.
Neither is cheaper in general; worth stating which cost the recommendation is counting.

---

## Minor

- `token-delegation:cmd/thv-operator/api/v1beta1/mcpexternalauthconfig_types.go:570`
  has a U+201D smart quote where CEL needs `''`. The committed CRDs have the correct
  `!= ''`, so source and manifests are out of sync and the next `make manifests` emits
  an uncompilable rule.
- `xaa-spike-1`'s no-client-auth comment cites RFC 7523 **§2.2**; the permission it
  relies on is **§2.1** (§2.2 is assertion-as-client-auth). Misleads the next reader
  about which mechanism is load-bearing.
- `multi_issuer_validator.go` is on main but dead — 328 lines plus 397 lines of tests,
  no config surface, live `TODO(#5989)`. External-issuer subject tokens can't be
  enabled today. `token-delegation`'s `oidc-trust` is the missing surface.
- **"RFC-0080" collides** with the shipped `THV-0080-skills-lock-file.md` in
  `toolhive-rfcs`. The delegation RFC-0080 exists only as section references inside
  `xaa-spike-1`'s own docs; the document itself isn't in this checkout. Worth
  renumbering, and worth locating before Phase 2.
- `docs/arch/token-delegation-act-chain.md` is stale: it describes a flat-overwrite
  `act` as unfixed, but main shipped nesting plus a depth cap. Accurate about its own
  branch, never about main.

## Credit where due

`jti` replay is already implemented on `xaa-spike-1` (`jwks_trust.go:150-162`,
delegating to fosite's `ClientAssertionJWTValid`/`SetClientAssertionJWT`). One caveat:
the phase plan puts Redis-specific replay out of scope, so multi-replica correctness
depends on the wired backend — worth confirming before Shape 2 ships.
