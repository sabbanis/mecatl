# Caller identity — deployment verification — acceptance plan

**Phase:** capability verification — caller identity, proven in a real deployment
**Status:** draft, 2026-08-10. The verification half of agent-identity Track A: prove that the caller identity threaded by [`caller-identity.md`](caller-identity.md) survives a real IdP, a real cluster, and a real restart — and that turning it on is genuinely optional.
**Issue:** [stacklok/mecatl#367](https://github.com/stacklok/mecatl/issues/367) (Track A; isolation #368 owns anything that refuses).
**ADR:** [ADR-0100](../adr/0100-caller-identity-threading.md) — the principal model, write-once owner, log-only event annotation, the `toolhive-core/authn` validator seam.
**Accumulator branch:** `acc/caller-identity` for the mergeable half; `spike/authn-wiring` for the half that cannot compile until `toolhive-core/authn` is tagged (see *The dependency wall*).

[`caller-identity.md`](caller-identity.md) landed the data layer and verified it
against a **fake** validator, because the real one did not exist. This plan
verifies the parts a fake cannot reach: that mecatl *constructs* the validator
correctly, that attribution survives a cluster restart, and that an IdP outage
reads as an outage rather than an authentication failure.

The doc is organized scenario-first because acceptance is about what a running
deployment can demonstrate.

## The dependency wall (read this before scheduling anything)

`toolhive-core/authn` exists but is **in no tagged release** — it is ~13 commits
past `v0.0.38` on an unmerged branch, and mecatl requires `toolhive-core v0.0.26`
indirectly. Its API is frozen; only correctness verification is outstanding.

Consequently `OIDCConfig.NewValidator` is nil in both server mains
([`internal/cliconfig/oidc.go`](../../internal/cliconfig/oidc.go)), so
`--oidc-issuer` is a **fatal startup error today** — deliberately fail-closed,
never a silent degrade. **No caller-identity deployment can be brought up at
all until the dependency lands.**

This splits the work by *mergeability*, not by test layer:

| Half | Branch | Constraint |
|---|---|---|
| Scenario 1 (deployment surface) | `acc/caller-identity` | No Go dependency. Merges normally. |
| Scenarios 2–3 (wiring + cluster) | `spike/authn-wiring` | Compiles only under a local `GOWORK` override. **Must not merge** until the tag. |

A committed `replace`, or a `use` line added to the committed `go.work`, would
make the branch unbuildable for CI and every other contributor. The override
lives in an untracked `.scratch/go.work.authn` (verified: `.scratch/` is
gitignored, and `git status` stays clean with it in place). When toolhive-core
tags, the spike's only change is override → version bump.

## Why these scope cuts

- **Nothing is refused, so nothing about isolation can be asserted.**
  [ADR-0100](../adr/0100-caller-identity-threading.md) ships attribution only;
  [`caller-identity.md`](caller-identity.md) deferred the Alice/Bob demo to #368
  precisely because it demonstrates refusals that do not exist. A test here that
  *looked* like it proved tenancy would be worse than no test.
- **The token-mechanics matrix is not re-tested.** `alg=none`, HS\*-confusion,
  expired, wrong-issuer, bad-signature and friends are the validator's contract
  and are covered by its own suite (69 test functions asserting the exact reason
  codes). Duplicating that here would re-test someone else's contract, drag JWT
  machinery into mecatl for no gain, and drift. AC1.2 in
  [`caller-identity.md`](caller-identity.md) already states this boundary.
- **No local end-to-end layer.** A live-`mecated` layer between the in-process
  tests and the cluster would assert only what Scenario 2 already covers
  deterministically, while being the one layer needing the e2e harness's
  single-shared-credential assumption (`MECATL_E2E_AUTH_TOKEN`,
  [`e2e/harness/remote.go`](../../e2e/harness/remote.go)) rewritten for
  per-caller tokens. Scenario 3 needs that change anyway, where multi-caller is
  the point.
- **Keycloak is not in the automated suite.** A static JWKS is deterministic and
  needs no realm configuration; `--oidc-jwks-uri` exists as the offline-test and
  air-gap hook. Keycloak stays a documented manual path.

## Identity is optional everywhere — including k8s

`OIDCConfig.Enabled()` is `Issuer != ""`;
`SecurityConfig.identityConfigured()` is `Validator != nil`
([`internal/adapter/server/authn.go`](../../internal/adapter/server/authn.go)).
`cmd/mecak8s` registers the identical flags through the same `cliconfig` helper
and defaults them off, verbatim as `cmd/mecated` does — nothing makes identity
k8s-specific or k8s-mandatory.

The axis that matters is **single-caller vs multi-caller**, not local vs
cluster: one human on one machine gets an owner that is always themselves, while
several callers sharing one harness are the case attribution exists for. A
cluster is merely where multi-caller deployments usually live.

What *is* not optional is the strictness once enabled: misconfiguration is fatal
at startup, so "optional" describes the decision to switch it on, not a soft
mode that can be half-configured.

## In scope — 3 scenarios, in implementation order

### Scenario 1 — the deployment surface, without turning it on

The published deployment must keep deploying what operators already expect,
while an opt-in overlay exists for those who want identity. This scenario needs
no Go dependency and is the only one that merges before the tag.

`deploy/mecak8s/` is the storage-free k8s deployment ([ADR
0048](../adr/0048-mecak8s.md)); its agent Deployment carries no auth arguments
today. Adding `--oidc-*` to the **base** would change what every user of that
example deploys, so identity lands as a kustomize overlay plus a minimal static
JWKS workload for it to point at.

**Work:**
- `deploy/mecak8s/overlays/oidc/`: a patch adding `--oidc-issuer`,
  `--oidc-jwks-uri`, `--oidc-audience` to the agent Deployment, plus a static
  JWKS Deployment + Service.
- `deploy/README.md`: the overlay, and a by-hand local bring-up (a `mecated`
  invocation against a static JWKS) for debugging — explicitly noting it fails
  closed until the validator ships.

**Acceptance:**
- AC1.1: the OIDC overlay renders an agent Deployment carrying all three
  `--oidc-*` flags, and the rendered manifests are accepted by a client-side
  dry-run.
  - verify: demonstration — `kustomize build deploy/mecak8s/overlays/oidc` piped
    through `kubectl apply --dry-run=client -f -`, exit 0.
- AC1.2: the **base** `deploy/mecak8s/` renders no `--oidc-*` argument at all —
  the default deployment is byte-unchanged, and identity is opt-in in the
  cluster exactly as it is locally.
  - verify: demonstration — `kustomize build deploy/mecak8s` greps clean for
    `oidc`.
- AC1.3: the documented by-hand bring-up states plainly that `--oidc-issuer`
  currently exits non-zero because no validator ships in this build, so a reader
  cannot mistake the fail-closed refusal for a bug.
  - verify: inspection — `deploy/README.md`, cross-checked against
    `internal/cliconfig/oidc.go`'s `ErrOIDCMisconfigured` path.

---

### Scenario 2 — mecatl constructs the validator correctly

The failure this scenario exists to catch: mecatl builds an `authn.Config` that
is *wrong in a way the library cannot detect*. An empty `Audiences` with
`AllowAnyAudience` true makes the library accept tokens minted for a different
service, behaving perfectly correctly while mecatl is insecure. Neither the
fake-validator tests in [`caller-identity.md`](caller-identity.md) nor the
library's own suite can see that; only a real token through mecatl's own
construction path can.

Tokens are signed **in-test** against an `httptest` static-JWKS server — no new
module dependency (`golang-jwt/jwt/v5` is already in mecatl's graph, promoted
from indirect to direct).

Scope discipline: this scenario asserts **wiring**, not token mechanics. Three
assertions, not a rejection matrix.

**Work:**
- the adapter satisfying `server.PrincipalValidator` over `authn.Validator`:
  field mapping, `GrantType` via the already-landed `server.GrantTypeFromClaims`,
  error translation per the table recorded at the `NewValidator` injection point,
  and `Close() error` delegating to `(*authn.Validator).Close()` (the optional
  `io.Closer` `Authenticator.Close` already type-asserts).
- an `httptest` static-JWKS fixture + in-test signing helper.

**Acceptance:**
- AC2.1: a correctly-signed RS256 token from the configured issuer and audience
  yields a principal on the handler context whose `(Issuer, Subject)` match the
  token's `iss`/`sub` and whose `GrantType` satisfies `Valid()` — proving both
  the `Config` construction and the `authn.Principal` → `session.Principal`
  mapping, including that the grant is derived (an underived grant would fail
  `admissiblePrincipal` and 401 every valid token).
  - verify: `TestCallerIdentityE2E_Scenario2_RealTokenYieldsPrincipal`
- AC2.2: the same signing key and issuer with a **wrong audience** is rejected
  401 — proving `Audiences` is actually populated and `AllowAnyAudience` is
  false. This is the insecure-but-green configuration the scenario exists for.
  - verify: `TestCallerIdentityE2E_Scenario2_WrongAudienceRejected`
- AC2.3: with `--oidc-jwks-uri` set, OIDC discovery is never attempted — the
  static-JWKS short-circuit that makes air-gapped and offline operation possible.
  - verify: `TestCallerIdentityE2E_Scenario2_StaticJWKSSkipsDiscovery`

---

### Scenario 3 — attribution survives a real cluster

Two assertions only, both things a single process cannot prove. They reuse the
existing kind harness ([`e2e/k8s/`](../../e2e/k8s), build tag `kind_e2e`, ko
resolve + ginkgo, a Redis StatefulSet and two storage-free agent replicas), so
this scenario adds specs rather than infrastructure.

**Work:**
- OIDC-enabled variants of the existing suite's fixtures (the Scenario 1
  overlay + the static JWKS workload), per-caller tokens in the harness.

**Acceptance:**
- AC3.1: a session created with Alice's token retains Alice as its owner across a
  replica failover — the lease holder is killed, the surviving replica serves the
  same session, and the owner it reports is unchanged. Redis-backed and
  cross-process, so it proves persistence the two-Build in-process pattern
  cannot.
  - verify: `TestCallerIdentityE2E_Scenario3_OwnerSurvivesFailover`
- AC3.2: with the JWKS workload scaled to zero, a request bearing a
  previously-valid token fails with the transient 503-class signal, NOT 401 — an
  IdP outage against a genuinely unreachable IdP, which the fake validator can
  only simulate.
  - verify: `TestCallerIdentityE2E_Scenario3_JWKSOutageIsTransient`

## Out of scope

| Item | Defer-to | Why |
|---|---|---|
| Any refusal, ownership check, or tenancy assertion | isolation track #368 | Nothing is refused in Track A; a test implying otherwise would oversell it |
| The token-mechanics rejection matrix (`alg=none`, HS-confusion, expiry, …) | `toolhive-core/authn`'s own suite | Its contract, already covered by 69 test functions asserting exact reason codes |
| A live-`mecated` local e2e layer | — | Its assertions are covered deterministically by Scenario 2 or better by Scenario 3 |
| Keycloak in the automated suite | a manual demo path | Realm state and the dev-file DB caveat make it flaky; a static JWKS is deterministic |
| Multi-audience / repeatable `--oidc-audience` | a later, backward-compatible change | Recorded at the injection point; no consumer yet |
| Discharging AC1.2 of [`caller-identity.md`](caller-identity.md) | the follow-up that takes the tag | Scenario 2 narrows the residual to the library's own contract, but the AC's wording stands until the dep is real |

## Cross-cutting deliverables

- `deploy/README.md` — the overlay and the by-hand bring-up (Scenario 1).
- [ADR-0027](../adr/0027-cloud-native.md) row 39 — drop the "nil in both mains
  today" caveat **only** when the dependency actually lands, not when the spike
  proves it.
- `docs/acceptance/README.md` — index this plan (the matlatl gate fails on an
  unreachable doc).
- `llms.txt` regeneration + the matlatl strict link gate (`task docs`).

## Sequencing recommendation

Scenario 1 first and alone: it is mergeable, needs no dependency, and unblocks
nothing else, so it carries no risk of being stranded. Scenario 2 next under the
override. Scenario 3 last — it depends on Scenario 2's adapter (the image needs a
non-nil validator) and Scenario 1's overlay.

**Verify before writing any Scenario 3 spec:** that `ko` propagates `GOWORK` to
its `go build`. Scenario 3 needs an image built from a tree whose `authn` import
resolves through the override; if `ko` does not honour it, Scenario 3 is blocked
until the tag no matter how the specs are written. Establishing that is cheap and
reshapes the scenario if it fails.

## Definition of done

1. `task lint` and `task test` pass (both modules, `-race`) on the mergeable half.
2. `task docs` — `llms.txt` regenerated, matlatl strict link gate green.
3. `task ac-trace` reports this plan structured with every `verify:` annotated
   (it is a draft, so the strict gate reports rather than fails).
4. Scenario 1's two demonstrations run green and are recorded.
5. Scenarios 2–3 demonstrated under the `GOWORK` override on
   `spike/authn-wiring`, with their commits **not** merged to
   `acc/caller-identity`.
6. `go run ./cmd/mecademo` still prints a full offline session — identity off,
   nil principal, unchanged.

## Deferred decisions and known risks

- **`ko` + `GOWORK` is unverified.** The single technical unknown gating Scenario
  3. Verify first.
- **The spike cannot merge, by construction.** Its value is retiring integration
  risk and having the adapter ready; if toolhive-core's `authn` branch is
  rebased or amended before tagging, the spike needs a re-run. The API is frozen,
  so the exposure is small but not zero.
- **The e2e harness assumes one shared credential.** `MECATL_E2E_AUTH_TOKEN`
  ([`e2e/harness/remote.go`](../../e2e/harness/remote.go)) is a single token;
  caller identity is inherently multi-caller. Scenario 3 needs per-caller
  clients, which is the most invasive change in this plan.
- **The kind suite already runs on a 30-minute timeout.** Two specs plus an IdP
  workload grow it; if it becomes the bottleneck, the JWKS workload is the part
  to make cheaper, not the assertions.
- **Token expiry must come from in-test signing, never a fixture file.** A
  committed token rots and the suite starts failing on a calendar date.

## Exit criteria

When every point under *Definition of done* holds — the mergeable half on
`acc/caller-identity`, the spike demonstrated and held — this plan is satisfied.
Landing the spike is the follow-up the tag unblocks, not part of this plan.
