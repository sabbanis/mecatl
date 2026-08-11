# Caller identity — deployment verification — acceptance plan

**Phase:** capability verification — caller identity, proven from the caller's and the operator's point of view
**Status:** draft, 2026-08-11. The verification half of agent-identity Track A: prove that the identity threaded by [`caller-identity.md`](caller-identity.md) does what a user and an operator would expect of it in a real Kubernetes deployment — and state plainly what it does not do.
**Issue:** [stacklok/mecatl#367](https://github.com/stacklok/mecatl/issues/367) (Track A; isolation #368 owns anything that refuses).
**ADR:** [ADR-0100](../adr/0100-caller-identity-threading.md).
**Accumulator branch:** `acc/caller-identity` for the mergeable half; `spike/authn-wiring` for the half that cannot compile until `toolhive-core/authn` is tagged.

## Why this plan is organised by story, not by layer

Its first draft had three scenarios — "the deployment surface", "the validator
construction", "the cluster" — which are **implementation layers**, not things
anyone can demonstrate. Organising that way produced two failures worth naming,
because they are the argument for the rewrite:

- Layer thinking let a **green suite hide an unusable product**. Every unit test
  passed while `OIDCConfig.NewValidator` was nil in both mains, so any real
  deployment with `--oidc-issuer` set exited at startup. No layer owned "the
  composed binary serves an authenticated caller", so nothing checked it.
- Layer thinking let the plan **verify things nobody asked for** while the
  headline claim went untested. Three scenarios of coverage existed before anyone
  had driven a single authenticated *run*, which is the first thing a user does.

Each story below is written as an outcome a caller or an operator can observe,
and every AC cites a fact **observed in a real cluster** (the probe transcript,
2026-08-11) rather than an assumption about how the code ought to behave. Where a
story cannot be honestly claimed, it says so instead of asserting a weaker proxy.

## The dependency wall (read before scheduling anything)

`toolhive-core/authn` is **merged to toolhive-core `main`** but is in **no tagged
release** (checked: `be59776` is an ancestor of `origin/main`; it is not in
`v0.0.38`). An earlier draft of this plan said it "lives on an unmerged branch" —
that was wrong, and it made this plan's own prerequisite un-runnable, since there
is no `authn` branch to clone.

The adapter that consumes it therefore compiles under a local `GOWORK` override
(`.scratch/go.work.authn`, untracked) and **must not merge** to
`acc/caller-identity` as-is: a committed import of an untagged package breaks the
build for CI and every other contributor.

Because it is on `main`, there is a **third option this plan had not considered**:
a pseudo-version (`go get github.com/stacklok/toolhive-core@main`) is a legitimate,
committable `go.mod` entry — no override needed. The cost is that toolhive-core is
a **private** module, so CI and every contributor would need `GOPRIVATE` plus
credentials to build mecatl at all. That is a project-wide decision, not this
plan's to make; recorded here so the choice is explicit rather than defaulted.
Waiting for a tag keeps mecatl publicly buildable.

| Half | Branch | Constraint |
|---|---|---|
| Stories 1 and 7 (manifests, docs) | `acc/caller-identity` | No Go dependency. Merges. |
| Stories 2–6 (anything needing a real token) | `spike/authn-wiring` | Override-only. Held. |

The override is **not hermetic**: it pulls toolhive-core's dependency versions
into the workspace (observed: `go-sdk 1.6.1 → 1.7.0`), which can surface lint
failures in files this work never touches. Gates on the spike are therefore
scoped to the packages it changes; the authoritative run is after the tag.

## Running this from scratch

Written because the first version of this plan was not reproducible: the
invocation existed only as a comment in a test file, and the workspace override
it named was an untracked file full of one laptop's absolute paths. An agent or
colleague handed this plan could not have reached a green run. What follows is
the whole path from an empty machine.

**Prerequisites.** Docker, `kind`, `ko`, `kubectl` (the first three are Taskfile
preconditions with install links). Plus, for anything past Story 1, a local
checkout of toolhive-core containing `authn/` — it is on `main`, so:

```sh
git clone https://github.com/stacklok/toolhive-core /tmp/thv-authn
# The run this plan was verified against pinned be59776. `main` also works and is
# what a tag will come from; pin only if you need to reproduce this exact run.
git -C /tmp/thv-authn checkout be59776
```

toolhive-core is a **private** module, so the clone needs credentials — and any
`go` command that fetches it needs `GOPRIVATE='github.com/stacklok/*'` or it will
try `sum.golang.org` and fail with a confusing 404. (`task docs` hits the same
wall for `matlatl`; the Taskfile comments say so.)

**The mergeable half** (Story 1 and Story 7 — manifests and docs; no Go
dependency, no cluster):

```sh
task deploy:check     # renders every deploy/ root, schema-checks it, asserts
                      # the three caller-identity boundaries
```

**The spike half** (Stories 2–6 — a real IdP, real tokens, a real cluster):

```sh
THV_AUTHN_DIR=/tmp/thv-authn task e2e:k8s:authn
```

That target generates `.scratch/go.work.authn` from `THV_AUTHN_DIR` and runs the
kind suite under it. The generated workspace is byte-identical to the one this
work was originally verified against. It is **not committed** — it pins absolute
paths, so it is per-machine by construction — and both the target and the file
delete when `authn` tags, at which point plain `task e2e:k8s` covers everything.

**What the suite does for you.** Nothing needs setting up by hand. `kind create
cluster` → `ko build` → `kind load image-archive` → Redis + two agent replicas →
Dex as a real in-cluster OIDC provider (an inline manifest in
[`e2e/k8s/oidc_helpers_test.go`](../../e2e/k8s/oidc_helpers_test.go), not a
committed YAML you have to find) → the stories → cluster teardown in the
after-hook, including on failure. Budget ~2 minutes of bring-up and a 30-minute
outer timeout.

**Two things you will hit that are not this work's fault.**

- `TestRunStreamingDefaultTimeoutWhenNoDeadline`
  ([`internal/adapter/osfs`](../../internal/adapter/osfs)) is flaky under load:
  it asserts a 5s process-group-kill unwind. It reproduces on `main` in
  isolation. Do not spend time attributing it to caller identity.
- On macOS, `-race` needs cgo, and an Xcode *app* upgrade does not reinstall the
  `XcodeSystemResources` package — a stale `CoreDevice.framework` then fails with
  `dlopen … Symbol not found: _XPCTypeBool`. Fix with
  `sudo installer -pkg /Applications/Xcode.app/Contents/Resources/Packages/XcodeSystemResources.pkg -target /`.
  The sanctioned `xcodebuild -runFirstLaunch` cannot help, because `xcodebuild`
  is broken by the same fault.

## What the cluster probe established

Facts observed on kind cluster `id-probe` against an image containing the real
validator. Two of them **correct earlier claims in this plan**, which is why they
are recorded rather than summarised:

1. **NetworkPolicy is enforced in kind** (kindnetd `v20251212-v0.29.0-alpha`). An
   earlier draft called the policies inert. Without an agent→IdP egress rule the
   pod CrashLoopBackOff'd on `failed to fetch JWKS … context deadline exceeded`,
   and a plain pod in the namespace was blocked identically while DNS resolved.
   The policies in `deploy/mecak8s/` are load-bearing; a new in-cluster
   dependency needs its own rule.
2. **The owner is visible over plain HTTP.** `GET /v1/sessions` returns
   `owner{issuer,subject,grant_type}`. An earlier draft claimed ownership was
   gRPC-only, from a truncated grep. Assertions belong on the API, not the store.
3. **Identity is enforced, not merely present**: a token signed by an unpublished
   key with a matching `kid` → 401; no `Authorization` header → 401.
4. **Owner and actor differ correctly.** Alice creates a session, Bob prompts it
   (200 — permitted, no isolation in this phase): the owner stays `alice`, and all
   six durable events record actor `bob`.
5. **The durable event record is an envelope with Go-cased keys** —
   `{"v":"redisstore-eventlog/1","ev":{"Type":…,"Actor":{"Subject":"bob"}}}`.
   `session.Event` carries no JSON tags. A consumer that assumes either a flat
   record or snake_case sees nothing and fails silently.
6. `grant_type` resolves to `user` for a token carrying no grant hints.

## Story 1 — "I turn identity on and my deployment still comes up"

*As an operator, I enable caller identity on an existing mecak8s deployment and it
starts; if I misconfigure it, it fails loudly rather than serving unauthenticated.*

Needs no Go dependency; merges on the accumulator.

- AC1.1: the opt-in overlay renders the three `--oidc-*` flags **appended** to the
  base args — every base flag survives — and the manifests are schema-valid.
  A container's `args` is an atomic list, so a strategic-merge patch would replace
  it and silently drop `--redis-url`; this AC is the guard against that regression.
  - verify: demonstration — `task deploy:check` (planted red three ways: a merge
    patch dropping six args, an SSRF flag in the overlay, `oidc` in the base).
- AC1.2: the **base** renders no `--oidc-*` at all — identity stays opt-in, and an
  existing deployment is byte-unchanged.
  - verify: demonstration — `task deploy:check`.
- AC1.3: a misconfigured verifier is **fatal at startup**, never a silent degrade
  to unauthenticated; and while no validator ships in the build, the documented
  flags exit non-zero with a message that says so.
  - verify: `TestCallerIdentity_Scenario1_MisconfiguredOIDCFailsToStart` (landed)
    + inspection of `deploy/README.md`.
- AC1.4: an in-cluster IdP needs an explicit NetworkPolicy egress rule, and the
  published overlay contains **no** SSRF relaxation — that flag is a test fixture.
  - verify: demonstration — `task deploy:check` for the absence; probe finding 1
    for the requirement.

## Story 2 — "I authenticate, and the work I do is mine"

*As a caller, I present a token from my IdP, create a session, run a prompt, and
the system records that the work was mine.*

This is the story no amount of layer coverage reached: three scenarios existed
before any authenticated **run** had been driven.

- AC2.1: a caller presenting a genuinely-signed token creates a session and drives
  a prompt to completion through the authenticated edge.
  - verify: demonstration — the ginkgo spec "attributes an authenticated run to the
    caller who made it" (`e2e/k8s/caller_identity_test.go`, `task e2e:k8s`). NOT a Go
    test name: the kind suite has ONE entry point (`TestK8sE2E`) and its specs are
    named strings, so a `Test…` name here could never resolve.
- AC2.2: the session records that caller's `(issuer, subject)` as its owner, with
  a `GrantType` that satisfies `Valid()` — an underived grant would 401 every
  valid token at the edge's admissibility guard.
  - verify: demonstration — same spec; it asserts the owner's subject is non-empty
    and the display name comes from the token's `name` claim.

## Story 3 — "I can see who owns what"

*As an operator, I can list sessions and see each one's owner, with the tools I
already have.*

- AC3.1: `GET /v1/sessions` carries `owner{issuer,subject,grant_type}` for an
  owned session and omits it for an unowned one — observable with `curl`, no gRPC
  client required (probe finding 2).
  - verify: demonstration — the ginkgo spec "shows the owner on the list row over
    plain HTTP" (`task e2e:k8s`).
- AC3.2: ownership drives **no** filtering — a request bearing Bob's token still
  lists Alice's session. This phase ships attribution, not isolation, and the
  absence is asserted so it cannot be mistaken for a bug.
  - verify: `TestCallerIdentity_Scenario3_ListRowOwnerIsDisplayOnly` (landed)

## Story 4 — "I can tell who did something, even when it wasn't the owner"

*As an auditor, when one caller acts on another's session, the record tells me who
acted — not merely whose session it was.*

The ship-blocker both reviews found. Owner answers *whose is this*; actor answers
*who did this*; in a shared deployment they routinely differ.

- AC4.1: when Bob drives a run on Alice's session, every durable event records
  actor **Bob**, while the session's owner stays **Alice** — acting on a session
  never re-owns it.
  - verify: demonstration — the ginkgo spec "records the acting caller as the actor,
    not the session's owner" (`task e2e:k8s`).
- AC4.2: the actor is log-only — absent from both client relays and ignored by the
  event-sourced fold.
  - verify: `TestCallerIdentity_Scenario4_EventActorLogOnly` (landed)
- AC4.3: a durable-log consumer must read the **envelope** (`ev`) and **Go-cased**
  keys; a reader that assumes otherwise must fail loudly, never silently skip.
  - verify: demonstration — the ginkgo spec "records the acting caller as the actor,
    not the session's owner" (`task e2e:k8s`). — its parse
    is assertive, and probe finding 5 is why. A fail-silent parse guarding a
    security property is how this AC's first draft could only ever time out.

## Story 5 — "A caller without a valid token gets nothing"

*As an operator, I need forged and absent credentials refused — the difference
between identity being present and identity being enforced.*

No spec asserted a rejection before this story existed: an edge that parsed a JWT
without verifying it would have passed every earlier AC.

- AC5.1: a token signed by a key the IdP does not publish is refused 401-class,
  and the handler never runs.
  - verify: demonstration — the ginkgo spec "refuses a forged signature and a missing
    credential" (`task e2e:k8s`).
- AC5.2: a request with no `Authorization` header is refused 401-class when
  identity is on.
  - verify: demonstration — the ginkgo spec "refuses a forged signature and a missing
    credential" (`task e2e:k8s`).
- AC5.3: a rejected credential is never rate-limit-keyed (token rotation is not a
  limit bypass, and a bad token must not create a bucket).
  - verify: `TestCallerIdentity_Scenario1_RateLimitKeyedOnPrincipal` (landed;
    mecated only — mecak8s registers no rate-limit flags at all, see *Do not
    claim*).

## Story 6 — "My session is still mine after the pod that took it dies"

*As an operator running two replicas, I need ownership to be durable state, not
in-process bookkeeping that happens to look right while one pod lives.*

This is the only story here that genuinely requires a cluster — every other
assertion could in principle be made against one in-process server. It also
records a process failure worth not repeating: this coverage existed and passed,
and was then **lost** when this plan was reorganised around user stories. Nothing
caught it; the plan simply stopped mentioning failover and the spec went with it.
It is restored, and placed last in the suite because it destroys a pod and
reshuffles the roster the earlier specs port-forward to.

- AC6.1: a session created and run through one replica reports the same owner
  (subject and name) when read from a replica that never served it, after the
  original pod has been gracefully deleted and replaced.
  - verify: demonstration — the ginkgo spec "keeps the owner after the pod that
    recorded it is replaced" (`task e2e:k8s:authn`).

## Story 7 — "I know what this does not give me"

*As an operator reading the documentation, I am not misled into believing I have
isolation, revocation, quotas, or a tenancy boundary.*

A capability doc that overstates is worse than none: it invites a deployment whose
operator believes callers are separated.

- AC7.1: the k8s documentation states, before any instructions, that this is
  **attribution and not a tenancy boundary** — any authenticated caller can act on
  any session, approve another caller's pending permission ask, and read the same
  pod filesystem.
  - verify: inspection — `user-docs/deployment/mecak8s.md`.
- AC7.2: the documentation names each unsupported property explicitly rather than
  omitting it: no isolation, no revocation before token expiry, no per-caller
  quotas or rate limiting on mecak8s, unauthenticated Redis, `Principal.Name` (an
  email) denormalised onto every durable event with no retention hook, and
  metrics reachable only on the loopback admin mux.
  - verify: inspection — the *Do not claim* list below, mirrored in the doc.
- AC7.3: the two IdP configuration traps that produce a confusing 401 are
  documented as troubleshooting step zero: Keycloak's default `aud` of `account`
  (needs an audience mapper, or every caller 401s), and `iss` byte-exactness (use
  the IdP's advertised external issuer, never the in-cluster Service URL).
  - verify: inspection — `user-docs/deployment/mecak8s.md`.

## Out of scope

| Item | Defer-to | Why |
|---|---|---|
| Any refusal on ownership grounds | #368 | This phase refuses nothing; a test implying otherwise would oversell it |
| The token-mechanics matrix (`alg=none`, HS-confusion, expiry) | `toolhive-core/authn`'s own suite | Its contract, 69 tests asserting exact reason codes |
| OIDC **discovery** (`.well-known`) | a follow-up | Never exercised anywhere: every configuration pins `--oidc-jwks-uri`. See *Known gaps* |
| A real IdP (Keycloak/Okta/Entra) | a manual, dated transcript | Realm state is fragile in CI; claim shapes belong in a fixture matrix |
| Per-caller quotas, workspace isolation | — | Do not exist; documenting them would be fiction |
| Bounding JWKS staleness | a decision, then a flag | See *Known gaps* — currently unbounded by omission |

## Do not claim (mirrored into the docs, AC7.2)

- **Not "multi-tenant"** — attribution without authorization.
- **Not "auditable"** until authn failures are logged: every 401 and 503 is
  currently silent, and the code discards its own outage-vs-bad-token distinction.
- **No revocation** — revoking at the IdP takes effect only at token expiry, and
  only while the JWKS cache is fresh.
- **No fair use** — mecak8s registers no rate-limit flags; one caller can exhaust
  the shared Redis, lease namespace and provider budget.
- **Not PII-ready** — `Principal.Name` is denormalised onto every durable event
  with no erasure path.
- **Metrics are loopback-only** — nothing is scrapeable as shipped.

## Known gaps and risks

- **JWKS staleness is unbounded by omission.** The library's cache keeps serving
  its last good key set after every failed refresh, so a revoked key stays trusted
  for as long as the IdP is unreachable — the trust window equals the outage
  length. `MaxJWKSStaleness` exists and mecatl does not set it. An earlier AC in
  this plan asserted an outage yields a 503; it does not, for a warm cache. The
  503 path is reachable only via an unknown `kid` or a cold cache. **Decision
  needed**, with a recommendation of 1h and a flag.
- **The documented configuration has never been started.** Every test pins the
  JWKS URI — the air-gap hook — and the published overlay ships that pin too. An
  external-IdP deployment with discovery is unexercised at every layer.
- **`grant_type` is IdP-dependent and effectively `user` for Keycloak.** Keycloak
  emits neither `gty` nor `grant_type`, and its `sub` (a UUID) never equals `azp`
  (the client id), so every Keycloak service account lands as `user`. The label is
  best-effort; document it as such or add an IdP-shaped signal.
- **`/drain` is unauthenticated on the client-facing port** the Service publishes
  — two requests drain a two-replica deployment. Pre-existing, found here.
- **NetworkPolicy is enforced in kind but only for the rules we wrote.** No spec
  asserts that a *missing* rule blocks; probe finding 1 is the only evidence.
- **The spike cannot merge, by construction.** Its value is retiring integration
  risk and having the adapter ready. If toolhive-core's `authn` branch is rebased
  or amended before tagging, the spike needs a re-run — the API is frozen, so the
  exposure is small but not zero.
- **The kind suite runs on a 30-minute outer timeout**, and this work adds an IdP
  workload plus five specs to it. If it becomes the bottleneck, make the JWKS
  workload cheaper rather than weakening assertions.
- **Tokens must keep coming from in-test signing, never a committed fixture.** A
  checked-in JWT rots and the suite starts failing on a calendar date. Dex minting
  live tokens per run is what keeps this honest; do not "speed it up" with a
  static token.

## Definition of done

1. `task lint` and `task test` green on the mergeable half; spike gates scoped.
2. `task docs` — `llms.txt` regenerated, matlatl strict gate green.
3. `task deploy:check` green, and its three guards each demonstrated red.
4. Stories 2–6 demonstrated in a kind cluster under the override, with the run
   recorded.
5. Story 1 and Story 7 merged on `acc/caller-identity`.
6. `go run ./cmd/mecademo` still prints a full offline session (identity off).
7. Every *Do not claim* bullet present in the k8s documentation.

## Exit criteria

When the mergeable half is on `acc/caller-identity`, the spike's stories are
demonstrated and held, and the documentation names its limits — this plan is
satisfied. Landing the spike is what the tag unblocks.
