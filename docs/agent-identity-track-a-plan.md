---
matlatl: orphan-intentional
---

# Track A (scoped): accept an identity, thread it everywhere

*Status: plan, discussed and converged. Not yet an acceptance plan — feed to
`/to-acceptance-plan` once the four decisions (bottom) are settled. Companion:
[`agent-identity-toolhive-authn-handover.md`](agent-identity-toolhive-authn-handover.md)
(the `toolhive-core/authn` extraction contract). Reasoning:
[`agent-identity-model.md`](agent-identity-model.md) phase 1, "audit trail (unsigned)."*

**One sentence:** a real IdP authenticates a caller at the edge, one `Principal`
value is derived and threaded through every port, and sessions + schedules durably
record who owns them — no enforcement, no signing, no per-user keying changes yet.

**Issues:** the threading half of [#367](https://github.com/stacklok/mecatl/issues/367).
Defers [#368](https://github.com/stacklok/mecatl/issues/368) (isolation),
[#369](https://github.com/stacklok/mecatl/issues/369),
[#370](https://github.com/stacklok/mecatl/issues/370),
[#374](https://github.com/stacklok/mecatl/issues/374) (Redis transport + MAC),
[#385](https://github.com/stacklok/mecatl/issues/385).

---

## The line

**In — accept and thread:**

| Piece | What it means |
|---|---|
| `Principal` value object | `{ Issuer, Subject, GrantType, Name? }`. GrantType ∈ `user` / `client_credentials` / `system`. **Identity is the `(iss, sub)` pair**, not `sub` alone (two IdPs/realms collide on `sub`). No scopes, no authority, no credentials. Modeled on ToolHive's `PrincipalInfo`, not imported. |
| Edge accept | OIDC verifier at the `authn.go` seam, its **own** enabled-predicate (not `authEnabled()`), caller stashed on a context key. Off by default ⇒ byte-identical to today. |
| Context threading | Unexported empty-struct key + `WithPrincipal` / `PrincipalFromContext` (ToolHive `context.go` pattern). **Absent = nil, never fabricated.** Every port caller — edge handlers *and* internal goroutines — carries one. |
| Owner on Session | Write-once at `CreateSession`, from the verified token, never the request body. Snapshot round-trips via **direct assignment** like `Profile` (sessnap.go:178-182). Children inherit (reject-empty); fork inherits the *source's* owner; resume keeps the persisted owner. |
| Event annotation | One field on `session.Event`, stamped **only at `appendEvent`** (service.go:3190), read from the loaded session's owner. Log-only: `toProto` skips it, the fold ignores it, the loop never sets it. |
| List row | `SessionSummary` gains `owner` — **display only, no filtering.** |
| Owner on Schedule | `ScheduleSpec` gains owner, captured at create (origin session already loaded). A fire's session/events carry it with `grant=client_credentials`. |
| System principal | The six internal goroutines (childgc, both dream consolidators, scheduler tick/fire/reconcile) run under an explicit `system` principal — never absent. |
| Rate-limiter re-key | `clientKeyFromToken` (authn.go:159) keys off the validated `(iss, sub)` under OIDC, not the raw token string. |

**Out — and where it goes:**

- **All enforcement** → isolation track (#368). The data it needs will already be
  everywhere.
- **Redis auth/TLS/keyspace** → its own piece (#374 transport half). No dependency here.
- **Memory / Soul / user-tier Skills / AgentDefs / Commands / Rules ownership** →
  deferred. They're ambient, per-project/per-OS-user configuration, not
  caller-created objects through the authenticated edge; making them multi-tenant
  (per-user keying, incl. the shared-memory-driver case) is a separate design.
  Their consolidators get the system principal.
- **The kind Alice/Bob demo** → moves to the isolation track.
- **Pre-ship sessions** → owner is **write-once, never backfilled.** Legacy sessions
  stay ownerless, render as unowned.

---

## Ownership map (the scoping decision, made explicit)

| Verdict | Objects | This slice |
|---|---|---|
| **OWNED** — durable owner written now | **Session**, **Schedule** | ✅ owner field + round-trip |
| **OWNED** — deferred (needs per-user keying design) | Memory entries, Soul, user-tier Skills/AgentDefs/Commands/Rules, Team, SkillDraft output | ❌ consolidators get system principal only |
| **SHARED-INFRA** — no owner, system principal for callers | SessionLease, PrunableStore sweeps, dream consolidators, scheduler tick/fire/delivery/reconcile, FileSystem/Workspace | ✅ system principal |
| **PER-SESSION-DERIVED** — inherit session's owner | EventLog, ToolCallRecorder, DeliveryQueue, `subagent-`/`parallel-`/`team-`/`sched--` children | ✅ via session owner |
| **NOT-PERSISTENT** | LLMProvider, HookRunner, Diagnostics, Clock, EventSink | — |

**Why not leases or the event log:** a lease is a distributed-lock fencing token —
its `owner` is a *pod/replica* identity, not a user; it answers "which process holds
this session's write lock," not "who is accountable." The event log is a per-session
sidecar that inherits its session's owner; there's no cross-user event object to
attribute independently.

**Why memory/skills/soul are deferred even under mecak8s:** Redis holds only
sessions, events, tool-calls, schedules (`redisstore.go:50-52` — it does NOT
implement `MemoryStore`). Memory/soul/skills are wired in `app.Build` as filesystem
stores (`memory.New(dir)`, `soul.Store`, `skillfs`) or gRPC drivers
(`--memory-store-url` → `grpcdriver.NewMemoryStore`), never Redis. They're
per-project / per-OS-user by construction, not caller-created through the
authenticated edge, so there's no caller to stamp and no ownership to thread until
they become multi-tenant.

---

## The token-validation library (decision: option 2 + hardening)

A new **`toolhive-core/authn`** package in the shared module both repos already
depend on (mecatl has `toolhive-core` indirect + `toolhive` direct, so MVS cost is
paid). One `Validator` owning a jwx cache, exposing
`Validate(ctx, bearer) (*Principal, error)`. Deps: `golang-jwt/v5` +
`lestrrat-go/jwx/v3` + stdlib — clean of toolhive-only tendrils. Full contract in
[`agent-identity-toolhive-authn-handover.md`](agent-identity-toolhive-authn-handover.md).

**Lift from `pkg/auth`:** P1 alg allowlist (token.go:830), P2 JWKS-by-kid
(token.go:874 minus local-provider), P4 audience membership (token.go:943-960),
P7 thin discovery (token.go:441 — *not* heavyweight `pkg/auth/discovery`), P8
claims→principal (context.go:189).

**Harden while extracting (the four fixes, each pinned by a test):**

1. **P2 — refresh-on-unknown-`kid` + negative cache** (~30s). ToolHive has neither;
   key rotation races fail validation without it.
2. **P1 — allow RSA-PSS (PS256)** alongside RSA/ECDSA. ToolHive rejects it;
   legitimate OIDC IdPs use it.
3. **P3 — exact-match issuer, drop the `TrimSpace`** (token.go:939). Byte-for-byte
   per OIDC §3.1.3.2.
4. **P5 — author time claims with leeway** via jwt-v5
   `WithLeeway`/`WithNotBefore`/`WithIssuedAt` (~60s). ToolHive checks only `exp`,
   zero leeway.

**Also:** P8's `PrincipalInfo` has no `Issuer` field — surface `iss` so mecatl's
`(iss, sub)` principal works. JWT-only mandate (no introspection branch).

### API shape — formalized (`/tmp/toolhive-core-authn-api-shape.md`)

The other agent has formalized the contract. **All four hardening fixes are in**,
plus extras mecatl gets free:

- ✅ P2 refresh-on-unknown-`kid` (one serialized refresh) + ~30s negative cache.
- ✅ P1 RS256 / ES256 / **PS256** allowlist, alg gate before key lookup.
- ✅ P3 byte-exact `iss` vs discovery `issuer` (no normalization, fail-closed).
- ✅ P5 `Leeway` (default 60s, max 2m) applied to exp/nbf/iat + `MaxTokenLifetime`
  (default 24h).
- ✅ `Principal{ Issuer, Subject, Name, Claims }` — the `Issuer` field the handover
  flagged as missing is present; `Claims` lets mecatl derive `GrantType`.
- Free extras: `ParseBearer` (RFC 7235 case-insensitive scheme; distinguishes
  missing-header 400 from malformed 401), a typed `Error` with client-safe
  `Code`/`Reason` split from log-only `Error()`, fail-closed required
  Issuer+Audiences, and the 401-vs-503 distinction (bad token vs JWKS unreachable).

**Two deltas from the handover (both fine):**

1. `Validate(ctx, token)` takes a **bare JWT** — mecatl's interceptor calls
   `ParseBearer(header)` first. Cleaner; preserves the 400/401 split.
2. `Principal` is richer than guessed (adds `Claims`). mecatl maps
   `Issuer`/`Subject`/`Name` onto its own value object and derives `GrantType` from
   `Claims` (or defaults it).

**One wiring caveat to honor:** `NewValidator(ctx, …)`'s ctx is **app-lifetime** —
it governs the background JWKS refresh, not just construction. mecatl must pass the
server-root context, never a per-request context.

---

## Slices

**T0 — joint prep.** Add `Owner` + `Authority` to `engine/session` as two additive
fields, direct-assignment restored in sessnap like `Profile`. One `task api:update`
+ CHANGELOG note. Kills the three-way conflict on generated files. *(Confirm Track C
still wants this — Q4.)*

**T1 — `toolhive-core/authn` + edge accept.** The shared library (lifts + 4
hardening fixes + `Validate`). Then mecatl: the `Principal` value object, the
verifier wired at `authn.go` (own predicate), context-key plumbing, config knobs
`--oidc-issuer` / `--oidc-jwks-uri` (static, short-circuits discovery; the
offline-test + air-gap hook) / `--oidc-audience` (required when on), rate-limiter
re-key. Offline: static-JWKS fixture (httptest, tokens signed in-test).

**T2 — Thread + persist.** Owner at `CreateSession`; snapshot round-trip;
child/fork/resume inheritance; event annotation at `appendEvent`;
`SessionSummary.owner`; system principal into the six goroutines.

**T3 — Schedule owner + chores.** `ScheduleSpec.owner` at create; fire
sessions/events carry it (`client_credentials`). Then: ADR from template (principal
model, write-once owner, log-only annotation, the toolhive-core/authn extraction +
hardening), ADR-0027 List 1 (JWKS cache) + List 2 (owner → persist-in-snapshot)
rows, user-docs flags, `task generate`.

---

## Done when

- Alice creates a session; the store row, the snapshot, the event log, and the list
  row all name her — still true after reopen, interrupt, recover, a restart
  (second-Build), and a fork.
- A scheduled fire's session and events carry the schedule owner's principal with
  `grant=client_credentials`.
- A no-auth deployment stamps nothing, behaves byte-identically to today, logs
  *unauthenticated*.
- A pre-ship session stays ownerless; nothing backfills it.
- Every internal goroutine runs under a non-nil system principal.
- Token validation: a token from the wrong issuer, wrong audience, expired, bad
  signature, `alg=none`, or HS\*-confused is rejected; a valid RS256/ES256/PS256
  token yields the `(iss, sub)` principal.
- Explicitly **not** yet: any refusal of anything.

## Verification shape

Offline throughout: static-JWKS fixture (httptest, tokens signed in-test) + the
two-Build restart pattern. The toolhive-core/authn package gets its own unit tests
(the four hardening fixes each pinned). No Keycloak, no kind, no live IdP.

---

## The four decisions (with analysis)

### Q1 — Library: RESOLVED ✅

`toolhive-core/authn`, all four hardening fixes. (Was: go-oidc vs toolhive-core vs
hand-rolled.)

### Q2 — Event annotation: where is the principal stamped onto events?

Every event in the durable log records which principal was acting. The mechanism:

**Option A — `Event.Actor` field, stamped only at `appendEvent` (RECOMMENDED).**
`session.Event` gains `Actor *Principal`; the loop and every emit site leave it nil.
The single place it's populated is `Service.appendEvent` (service.go:3190), which
already holds the loaded session and reads `sess.Owner`. `toProto` omits it
(log-only, like `EvApproval`/`EvCompactionArchive`); `Fold` ignores it. One code
site, no proto change, no emit-site churn. Cost: a field that's nil almost
everywhere, and denormalization (the owner is duplicated per event — which is the
*point*: an event read in isolation names its actor).

**Option B — wrapper envelope in the eventlog encoding.** Don't touch
`session.Event`; the `eventlog-json/1` record wraps `{actor, event}`. Cost: a
format-version bump (`eventlog-json/2`), and `Read` + every store (jsonlstore,
redisstore, memstore, grpcdriver) + the `Fold` must handle both shapes. Purer, but
pays a format migration across four stores for a purity gain the audit trail
doesn't need.

**Recommendation: A.**

### Q3 — Schedule fire principal: who does a cron fire run as?

**Option A — schedule's owner + `client_credentials` grant (RECOMMENDED).** The
fire's principal is `{ Issuer: <schedule's iss>, Subject: <owner's sub>, GrantType:
client_credentials }` — "Alice's schedule did this, on Alice's behalf, via
client-credentials." Attribution collapses to the accountable person in one hop; the
grant type honestly signals automated-not-interactive. Matches the design doc ("a
cron fire's owner is `client_credentials`"). Cost: a slight fiction (Alice didn't
*do* it), carried honestly by the grant type.

**Option B — the schedule as its own principal.** `{ Issuer: "mecatl", Subject:
"schedule/<name>", GrantType: client_credentials }`. No fiction, but accountability
needs a join (schedule → owner) on every audit question, and it mints a new class of
principal. When enforcement lands, "may this fire touch Alice's session" needs the
schedule→owner resolution anyway.

**Recommendation: A.**

### Q4 — T0 joint prep: land `Owner` + `Authority` together, or Track C fends for itself?

`sessnap` and `engine/api/*.txt` are contended: this track adds `Owner`, Track C
adds `Authority`. Both touch the same files and trip `api-compat` + CHANGELOG.

**Option A — one prep commit lands both fields now (RECOMMENDED, conditional).**
Both additive, `omitempty`, direct-assignment-restored, one `task api:update`, one
CHANGELOG note. Track A uses `Owner`; Track C later uses `Authority`. Pays the
generated-file cost once, avoids the recurring three-way conflict the handover warns
about. Cost: `Authority` ships as a dead field until Track C lands, and couples the
two tracks' *schema* timing.

**Option B — each track adds its own field when needed.** No dead fields, full
independence, but two regenerations and the recurring conflict if both are in flight.

**Recommendation: A — IF Track C is real and soon and its `Authority` shape is
settled.** This is the one decision that turns on information outside this track
(Track C's readiness). If Track C's field shape is unsettled, B is safer (don't
freeze a field you'll change).

### Q5 — Chores: the documentation lifecycle load

This track changes user-facing behavior + makes an architectural decision, so ADR
0002/0003 require:

1. **A new ADR** from `docs/adr/template.md` — principal model, write-once owner,
   log-only annotation, toolhive-core/authn extraction + hardening. Mandatory: the
   design docs are explicitly *not* ADRs, so landing any of this needs a frozen
   decision record.
2. **ADR-0027 rows** — List 1 gets the JWKS cache (outlives a tool call); List 2 gets
   the owner (decision: persist-in-snapshot). The repo rule is explicit ("Added an
   outlives-a-call resource? Inventory it") with a "don't be the fourth" warning.
3. **`user-docs/`** — the new `--oidc-*` flags are operator-visible. Repo rule:
   "Changed user-facing behavior? Update user-docs/ in the SAME PR."
4. **`task generate`** — regenerates `llms.txt` + link gate. Mandatory on any
   Markdown change.

ADR + `task generate` are CI-gated (not negotiable). ADR-0027 rows are a documented
invariant. `user-docs/` is the negotiable one — but the repo calls it "the weak
link" precisely because nothing gates staleness.

**Recommendation: the full set, user-docs kept lean** (flags + a link to the full
reference, not a new page).

---

## Status of decisions

| # | Decision | Status |
|---|---|---|
| Q1 | Library: toolhive-core/authn + 4 hardening fixes | ✅ resolved |
| Q2 | Event annotation | ✅ resolved — A (`Event.Actor`, stamped only at `appendEvent`) |
| Q3 | Schedule fire principal | ✅ resolved — A (owner + `client_credentials` grant) |
| Q4 | T0 joint prep with Track C | ✅ resolved — A (land `Owner` + `Authority` together) |
| Q5 | Chores | ✅ resolved — full set (ADR + ADR-0027 rows + user-docs + `task generate`) |

All decisions settled. Ready for `/to-acceptance-plan`.
