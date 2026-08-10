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
example deploys, so identity lands as a kustomize overlay.

**The overlay points at a REAL external IdP over HTTPS, and carries no test
scaffolding.** That is not a simplification, it is the security-correct shape:
the library rejects `http://` and private/in-cluster addresses by default
(`InsecureAllowHTTP` and `AllowPrivateIP` both false — the latter is what blocks
a `jwks_uri` resolving to `169.254.169.254`), so a public HTTPS issuer is the
only configuration that works with those defaults intact. It also needs **no
NetworkPolicy change**: the base egress already allows DNS and TCP 443 to any
destination IP, which is exactly what an external IdP needs.

The in-cluster static JWKS and the flag that permits reaching it are **test
fixtures**, and live with the e2e suite in Scenario 3 — never in `deploy/`. A
published example that disables SSRF protection is the wrong artifact to ship.

**Work:**
- `deploy/mecak8s-oidc/`: a patch adding `--oidc-issuer`,
  `--oidc-jwks-uri`, `--oidc-audience` to the agent Deployment. Nothing else.
- `deploy/README.md`: the overlay, and a by-hand local bring-up for debugging —
  explicitly noting it fails closed until the validator ships.

**Acceptance:**
- AC1.1: the OIDC overlay renders an agent Deployment carrying all three
  `--oidc-*` flags **appended to** the base args — every base flag
  (`--redis-url`, `--session-lease-k8s-namespace`, …) survives — and the
  rendered manifests are schema-valid.
  - verify: demonstration — `kustomize build deploy/mecak8s-oidc` shows the 7
    base args plus the 3 new ones, and pipes through
    `kubeconform -strict -summary -` with `Valid: 12, Invalid: 0, Errors: 0`.
    The args half is not incidental: a container's `args` is an ATOMIC list, so a
    strategic-merge patch mentioning `args` would REPLACE the base list and
    silently drop the storage and lease flags. The overlay uses a JSON6902
    append for that reason, and this AC is what would catch a regression to a
    merge patch. Schema validation is `kubeconform` rather than
    `kubectl apply --dry-run=client`: the latter needs a reachable API server
    even with `--validate=false` (it maps kinds against the server), so it
    cannot run in CI or on a laptop with no cluster.
- AC1.2: the **base** `deploy/mecak8s/` renders no `--oidc-*` argument at all —
  the default deployment is byte-unchanged, and identity is opt-in in the
  cluster exactly as it is locally.
  - verify: demonstration — `kustomize build deploy/mecak8s` greps clean for
    `oidc` (0 matches) and stays schema-valid.
- AC1.3: the documented by-hand bring-up states plainly that `--oidc-issuer`
  currently exits non-zero because no validator ships in this build, so a reader
  cannot mistake the fail-closed refusal for a bug.
  - verify: inspection — `deploy/README.md`, cross-checked against
    `internal/cliconfig/oidc.go`'s `ErrOIDCMisconfigured` path.
- AC1.4: the overlay carries no flag that relaxes issuer-URL or private-address
  policy, and no in-cluster IdP workload — a published example must not ship SSRF
  relaxation. Those are Scenario 3's test fixtures.
  - verify: demonstration — `kustomize build deploy/mecak8s-oidc` greps clean
    (0 matches) for `insecure`, `allow-private` and any JWKS workload. Note
    `--oidc-jwks-uri` is a URL to an external endpoint, not a relaxation, and is
    expected to be present.

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

**Reaching that server needs no production flag, but it takes TWO measures, not
one.** The two defaults that block a loopback fixture are enforced at *different
layers*, and an earlier draft of this plan got that wrong by assuming one hatch
covered both:

- `AllowPrivateIP: false` rejects the loopback ADDRESS. It governs only the
  library's *default* HTTP client, so a caller-supplied `HTTPClient` — which
  brings its own dial policy — is enough. The library still enforces its 1 MiB
  body cap, redirect refusal and timeout on a supplied client, so the protections
  that matter are not traded away.
- `InsecureAllowHTTP: false` rejects an `http://` issuer URL. This is a
  **Config-level scheme check and fires regardless of which client is supplied**
  (observed: `authn: issuer must use https scheme … http://127.0.0.1:50928`). An
  injected client does nothing for it.

So the fixture serves over **TLS** (`httptest.NewTLSServer`), which keeps BOTH
pinned production defaults intact: the scheme check passes, and `srv.Client()`
carries the test CA so the supplied client trusts it. The alternative — relaxing
`InsecureAllowHTTP` for the test — would have meant a test seam on a default
pinned precisely because a plaintext JWKS fetch lets anyone on the path
substitute the signing keys. Serving TLS is strictly better and costs one
constructor.

This is still the reason Scenario 2 needs no new operator surface and Scenario 3
does: a supplied client and a TLS fixture are both available in-process, while
the agent binary reaching an in-cluster Service has neither.

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

**Unlike Scenario 2, this one needs a real operator-visible flag.** The agent is
a separate process reaching an in-cluster JWKS Service — a private address — so
there is no test-only injection point: `AllowPrivateIP` must be set on the
validator the binary itself constructs. That is a new flag which relaxes an SSRF
defence, so it carries safety obligations of its own (AC3.3–AC3.5) and is the
reason this scenario is scoped to two assertions rather than a suite: the flag
must be justified by what it buys, not the reverse.

Two further consequences of the private-address path, both easy to miss until
the deployment silently fails closed:
- the base NetworkPolicy's egress allows only DNS, TCP 443 to any IP, and
  Redis 6379 — an in-cluster JWKS on another port needs an explicit egress rule
  in the **fixture** overlay;
- the flag must permit `http://` as well as the private address, or the JWKS
  endpoint needs a private CA and `CACertPath` plumbing that is out of scope.

**Work:**
- a `--oidc-insecure-allow-private-issuer` flag (name deliberately loud) setting
  `AllowPrivateIP` + `InsecureAllowHTTP` together, defaulting off.
- e2e fixtures: a static JWKS Deployment + Service, an egress rule for it, the
  Scenario 1 overlay, and per-caller tokens in the harness.

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
- AC3.3: `--oidc-insecure-allow-private-issuer` defaults to **off**, and with it
  off a private or `http://` issuer is refused — so the SSRF defence the library
  provides is intact in every deployment that does not explicitly opt out.
  - verify: `TestCallerIdentityE2E_Scenario3_PrivateIssuerRefusedByDefault`
- AC3.4: enabling the flag emits a startup WARN naming it as test-only, so an
  operator who copy-pastes it into a real deployment is told, in the logs, what
  they have turned off. Silence here is how a test flag becomes a production
  vulnerability.
  - verify: `TestCallerIdentityE2E_Scenario3_InsecureIssuerFlagWarns`
- AC3.5: the flag is absent from `deploy/mecak8s/` and its published overlay —
  it exists for the e2e fixture only, and nothing an operator copies contains it.
  - verify: demonstration — grep over `deploy/`, exit non-zero on a match (the
    same check as AC1.4, asserted from the flag's side).

## Out of scope

| Item | Defer-to | Why |
|---|---|---|
| Any refusal, ownership check, or tenancy assertion | isolation track #368 | Nothing is refused in Track A; a test implying otherwise would oversell it |
| The token-mechanics rejection matrix (`alg=none`, HS-confusion, expiry, …) | `toolhive-core/authn`'s own suite | Its contract, already covered by 69 test functions asserting exact reason codes |
| A live-`mecated` local e2e layer | — | Its assertions are covered deterministically by Scenario 2 or better by Scenario 3 |
| Keycloak in the automated suite | a manual demo path | Realm state and the dev-file DB caveat make it flaky; a static JWKS is deterministic |
| Multi-audience / repeatable `--oidc-audience` | a later, backward-compatible change | Recorded at the injection point; no consumer yet |
| A private-CA JWKS endpoint (`CACertPath` / an `--oidc-ca-cert` flag) | an operator need, when one appears | The insecure-issuer flag covers the test case; cert plumbing is real scope with no consumer today |
| A posture gate on the insecure-issuer flag | revisit if it is ever seen outside a test | Posture governs agent tool permissions, not server networking, so gating there would be a category error; the loud name + startup WARN + absence from `deploy/` are the guards |
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
- **Scenario 2 was verified WITHOUT `-race`, and that debt is owed.** `-race`
  needs cgo, cgo needs a working `clang`, and the toolchain was broken on the
  machine the spike was written on (an Xcode/CLT failure unrelated to this work,
  which also stops `task test` entirely). Everything was run under
  `CGO_ENABLED=0`. These three ACs are wiring assertions rather than concurrency
  tests, so the loss is small — but "passes without the race detector" is a
  weaker claim than the repo's gate makes, and re-running them under `-race` is a
  precondition for landing the spike, not an optional extra.

## Exit criteria

When every point under *Definition of done* holds — the mergeable half on
`acc/caller-identity`, the spike demonstrated and held — this plan is satisfied.
Landing the spike is the follow-up the tag unblocks, not part of this plan.
