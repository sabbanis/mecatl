# Caller identity — acceptance plan

**Phase:** capability — caller identity, threaded end to end
**Status:** landed, 2026-08-07. Track A of the agent-identity model: accept a verified principal at the edge, thread it everywhere, and durably record who owns each session and schedule — no enforcement, no signing.
**Issue:** [stacklok/mecatl#367](https://github.com/stacklok/mecatl/issues/367) (the threading half; isolation #368, labels #369, sharing #370, Redis transport #374 deferred).
**ADR:** [ADR-0100](../adr/0100-caller-identity-threading.md) — the principal model, write-once owner, log-only event annotation, system principal, and the `toolhive-core/authn` validator.
**Accumulator branch:** `acc/caller-identity` (off `main`).

The smallest set of work that lets the harness say, durably and observably, *who*
is acting: a real IdP authenticates the caller at the edge, one `Principal` value
is derived and threaded through every port caller, and sessions and schedules
record their owner so the attribution survives reopen, interrupt, recover, restart,
and fork. This is the "audit trail (unsigned)" phase of
[`docs/agent-identity-model.md`](../agent-identity-model.md) — it builds the data
layer every later track (isolation, labels, sharing, integrity) reads, and stops
deliberately short of refusing anything.

The doc is organized scenario-first because acceptance is about what the running
harness can demonstrate, not which packages exist on disk.

## Why these scope cuts

- [ADR-0100](../adr/0100-caller-identity-threading.md) — accept-and-thread only;
  enforcement (#368), per-user keying of memory/soul/skills, and the kind Alice/Bob
  demo all sit behind the data layer this plan lands.
- [`AGENTS.md` — the layering rule](../../AGENTS.md) — the loop stays
  storage-agnostic; the principal rides a context key and domain value objects, no
  adapter/proto/server type crosses into `engine/agent`.
- Token *validation* is delegated to `toolhive-core/authn` (the shared module both
  repos already depend on) rather than hand-rolled here — see the handover
  [`docs/agent-identity-toolhive-authn-handover.md`](../agent-identity-toolhive-authn-handover.md).
- Redis auth/TLS/keyspace scoping is the transport half of #374 and is **not** this
  plan — no dependency between them.

## The ownership map (which objects get an owner in this plan)

| Verdict | Objects | This plan |
|---|---|---|
| **OWNED** — durable owner written now | **Session**, **Schedule** | ✅ owner field + round-trip |
| **OWNED** — deferred (needs per-user keying design) | Memory entries, Soul, user-tier Skills/AgentDefs/Commands/Rules, Team, SkillDraft output | ❌ consolidators get the system principal only |
| **SHARED-INFRA** — no owner; system principal for internal callers | SessionLease, PrunableStore sweeps, dream consolidators, scheduler tick/fire/delivery/reconcile, FileSystem/Workspace | ✅ system principal |
| **PER-SESSION-DERIVED** — inherit the session's owner | EventLog, ToolCallRecorder, DeliveryQueue, `subagent-`/`parallel-`/`team-`/`sched--` children | ✅ via the session owner |
| **NOT-PERSISTENT** | LLMProvider, HookRunner, Diagnostics, Clock, EventSink | — |

Memory/soul/skills are ambient per-project / per-OS-user configuration wired in
`app.Build` as filesystem stores or gRPC drivers — never Redis, never created
through the authenticated edge — so there is no caller to stamp until they become
multi-tenant. Their consolidators run under the system principal.

## In scope — 5 scenarios, in implementation order

Scenarios are listed in implementation order. Each is independently demoable; later
scenarios assume earlier ones but don't change their acceptance criteria. Within
each scenario, ACs progress trivial happy path → richer happy path → edges →
cross-cutting.

### Scenario 0 — joint field prep with Track C

`sessnap` and `engine/api/*.txt` are contended: this plan adds `Owner`, Track C adds
`Authority`. Both are landed together as ONE small additive preparatory commit so the
generated-file regeneration and CHANGELOG note are paid once, killing the recurring
three-way conflict the handover warns about. The fields are restored by **direct
assignment** the way `Profile`/`ProviderID` are
([`engine/adapter/sessnap/sessnap.go`](../../engine/adapter/sessnap/sessnap.go) —
the `RestoreState` trailing-parameter widening is a *Changed*/breaking entry under
[`engine/COMPATIBILITY.md`](../../engine/COMPATIBILITY.md); a direct-assignment
field is *Added*/minor). `Authority` ships inert until Track C lands. The new value
objects live in `engine/session` and stay adapter-free
([`AGENTS.md` — the layering rule](../../AGENTS.md)).

**Work:**
- engine domain (`engine/session`): the `Principal` value object
  (`{ Issuer, Subject, GrantType, Name? }`; `GrantType ∈ user | client_credentials |
  system`); additive `Owner *Principal` and `Authority <Track C shape>` labels on the
  `Session` aggregate, restored through a write-once aggregate method (a
  `RestoreLabels`/`SetOwnerLabels` sibling of the existing label-restore seam) —
  `Session` is an aggregate, so sessnap must not poke exported fields.
- adapters (`engine/adapter/sessnap`): snapshot round-trip for both fields,
  `omitempty`, via that aggregate method (no `RestoreState` signature change).
- composition: one `task api:update` + `engine/CHANGELOG.md` note classifying both as
  Added/minor.

**Acceptance:**
- AC0.1: `Session.Owner` and `Session.Authority` round-trip through snapshot +
  restore byte-identically, via the aggregate restore method, with no `RestoreState`
  signature change.
  - verify: `TestCallerIdentity_Scenario0_OwnerSnapshotRoundTrip`
- AC0.2: A snapshot written before this plan (no `owner`/`authority` keys) restores
  to a session with a nil owner and a zero authority — additive `omitempty`, never a
  parse failure.
  - verify: `TestCallerIdentity_Scenario0_PreShipSnapshotRestores`
- AC0.3: A consumer compiled against the new `engine/session` reads `Owner` and
  `Authority` with no `RestoreState` call-site change (the additive-field,
  not-widened-signature contract).
  - verify: `TestCallerIdentity_Scenario0_APICompatAdditive`

---

### Scenario 1 — accept a principal at the edge

A real IdP authenticates the caller. The OIDC verifier lands at the existing
`authn.go` seam (extending, not building — it already has the gRPC unary+stream
interceptors, HTTP middleware, and per-client rate limiting), behind its **own**
enabled-predicate derived from whether the verifier is wired — NOT `authEnabled()`,
which means "a static shared token is configured" and is a latent fail-open in both
directions. The verified caller is stashed on a context key
(`WithPrincipal`/`PrincipalFromContext`, the ToolHive `context.go` pattern). **Absent
= nil, never fabricated** — the ToolHive anonymous-middleware anti-pattern (minting a
`sub: "anonymous"` with forged exp/iat) is explicitly rejected. Validation is
delegated to `toolhive-core/authn`
([`docs/agent-identity-toolhive-authn-handover.md`](../agent-identity-toolhive-authn-handover.md));
off by default ⇒ byte-identical to today, including the TUI's no-token path. The
verifier is an adapter wired at composition — the loop and domain never see it
([`AGENTS.md` — the layering rule](../../AGENTS.md)).

**Work:**
- adapters (`internal/adapter/server/authn.go`): the OIDC verifier wired beside the
  static-token path; a new predicate (`identityConfigured`, distinct from
  `authEnabled`); `ParseBearer` then `authn.Validate`; the verified principal onto
  the context.
- composition (`cmd/mecated` + `cmd/mecak8s`): `--oidc-issuer`, `--oidc-jwks-uri`
  (static — short-circuits discovery; the offline-test + air-gap hook),
  `--oidc-audience` (required when on). `NewValidator` is passed the **server-root**
  context (it governs background JWKS refresh), never a per-request ctx.
- the rate limiter is re-keyed off the validated `(iss, sub)` under OIDC
  (`clientKeyFromToken`,
  [`internal/adapter/server/authn.go`](../../internal/adapter/server/authn.go)),
  not the raw token string.

**Acceptance:**
- AC1.1: With OIDC configured, a request bearing a valid RS256/ES256/PS256 token from
  the configured issuer+audience yields the `(iss, sub)` principal on the handler's
  context.
  - verify: `TestCallerIdentity_Scenario1_ValidTokenYieldsPrincipal`
- AC1.2: **The edge honours a rejection absolutely.** Whatever the validator
  rejects — wrong issuer, wrong audience, expired, not-yet-valid (`nbf` beyond
  leeway), bad signature, `alg=none`, HS\*-confused, a non-JWT — becomes a clean
  401-class error on BOTH surfaces and the handler NEVER runs: there is no fallback
  branch, no swallowed error, and a rejected token is never rate-limit-keyed. A
  validator that returns a nil principal with a nil error is also a rejection, and
  one that returns an unusable principal (empty `Issuer`/`Subject`, an invalid
  `GrantType`, or the internal `mecatl:internal` namespace) is refused at the seam.
  **Scope limit, stated plainly:** the token MECHANICS above are the validator's
  contract, not mecatl's, and `toolhive-core/authn` does not exist yet — so this AC
  is pinned with a FAKE validator over opaque bearer strings. It verifies mecatl's
  half (no fail-open, no fallthrough); it does NOT verify that a real `alg=none` or
  HS-confused JWT is detected. That verification is deferred to the library and must
  be re-established when it lands (see *Deferred decisions and known risks*).
  - verify: `TestCallerIdentity_Scenario1_BadTokensRejected` +
    `TestCallerIdentityEdgeRejectsMalformedPrincipal`
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

---

### Scenario 2 — thread the principal through every port caller

One principal, present or absent, on every port call. The threading is a context key,
never a widened port signature and never a fabricated value. Internal goroutines that
have no caller — `childgc`, both memory/dream consolidators, the scheduler
tick/fire/delivery/reconcile — run under an explicit **system** principal, never an
absent one, so the day a check lands they don't break silently
([`AGENTS.md` — the layering rule](../../AGENTS.md): these are composition/server
concerns, not loop concerns).

**Work:**
- engine domain (`engine/session` / a context helper): the unexported empty-struct
  context key + `WithPrincipal`/`PrincipalFromContext`.
- adapters + composition: the six internal goroutines run under
  `Principal{GrantType: system}`; the edge handlers thread the verified principal.

**Acceptance:**
- AC2.1: `WithPrincipal`/`PrincipalFromContext` round-trips a principal, and a
  context with none returns nil (absent), never a fabricated value — the
  no-fabricated-principal invariant.
  - verify: `TestInvariant_no_fabricated_principal`
- AC2.2: Every composition/server goroutine that crosses a port boundary — `childgc`,
  both dream consolidators, the scheduler tick/fire/delivery/reconcile loops, the
  fire goroutine, and the validator's JWKS background refresh — observes a non-nil
  principal with `GrantType == system`, asserted at the point that context actually
  crosses a port (the tick's `Due` poll, the fire, the delivery, the reconcile claim,
  each driven through the real `Scheduler.Start` rather than a test shortcut). The
  registry (`syscaller.Roots`) is enumerated ONCE and the test fails on
  registry↔table drift in either direction, so a REGISTERED root whose wrap is
  removed goes red. **Residual, stated plainly:** the registry is manual opt-in, so a
  brand-new goroutine that never registers a `Root` is not caught by this test — the
  gate is against silently DROPPING a wrap, not against never adding one.
  - verify: `TestCallerIdentity_Scenario2_InternalGoroutinesRunAsSystem`
- AC2.3: No port interface signature gains a principal parameter — the principal
  rides the context.
  - verify: none — guarded by the existing depguard + `engine/arch` layering DAG gate (the principal never appears in a port signature; the DAG test fails on a mis-layered import)

---

### Scenario 3 — the session records its owner, durably

The owner is written **once** at `CreateSession`, from the verified token, never from
the request body (`CreateSessionRequest` gains no owner field). It survives every
persistence and rehydration path. Children (`subagent-`/`parallel-`/`team-`/`sched--`)
inherit the parent's owner (an ownerless parent yields an ownerless child — never a
fabricated one, and never a rejection that would break the byte-identical no-auth
path); a fork inherits the **source's** owner
(stamping the forking caller's own owner would make fork an ownership-laundering
path); resume keeps the persisted owner. Write-once, **never backfilled** — a session
persisted before this plan stays ownerless and renders as unowned rather than being
adopted by whoever touches it first. `Session` stays an aggregate — the owner is read
and written through its methods, never by poking the struct
([`AGENTS.md` — Session is an aggregate](../../AGENTS.md)).

**Work:**
- adapters (`internal/adapter/server/service.go`): `CreateSession` stamps the owner
  from the context principal.
- engine domain + adapters: the child/fork/resume owner-propagation rules.
- The list row surfaces the owner: proto `SessionSummary` gains an `owner` field
  (this **is** a proto change — the blanket "no proto change" claim applies to the
  *event* path in Scenario 4, not the summary), the server `SessionSummary` struct
  mirrors it, and `port.SessionMeta` gains `Owner` so the `MetaLister` fast path
  (which skips `Load`) populates the row identically to the Load-per-row slow path.
  Display only, **no filtering** (the isolation track owns scoping).

**Acceptance:**
- AC3.1: A session created under a verified principal records that principal as its
  owner; the store row, the snapshot, and the `ListSessions` row all name her — and
  the row is populated identically on **both** the `MetaLister` fast path and the
  Load-per-row slow path (no empty-on-fast-path divergence).
  - verify: `TestCallerIdentity_Scenario3_OwnerRecordedAndListed`
- AC3.2: The owner survives reopen, interrupt, recover, a process restart (the
  two-Build pattern), AND a `Service.rehydrateSession` per-session engine rebuild —
  the same session re-loaded names the same owner. (The event-sourced `Fold`
  reconstruction is covered at AC4.2.)
  - verify: `TestCallerIdentity_Scenario3_OwnerSurvivesReopenRestart`
- AC3.3: A child session and a fork carry the **source's** owner, not the calling
  goroutine's — a fork cannot launder ownership to its caller.
  - verify: `TestCallerIdentity_Scenario3_ForkInheritsSourceOwner`
- AC3.4: A pre-ship (ownerless) session stays ownerless after this plan — nothing
  backfills it, and it renders as unowned, not adopted.
  - verify: `TestCallerIdentity_Scenario3_PreShipSessionNeverBackfilled`
- AC3.5: `SessionSummary.owner` is populated for the list row but drives **no**
  filtering — a request bearing Bob's principal still lists Alice's session (the
  accept-and-thread cut is pinned: no isolation is silently introduced). Scoping is
  the isolation track's, not this plan's.
  - verify: `TestCallerIdentity_Scenario3_ListRowOwnerIsDisplayOnly`

---

### Scenario 4 — events and schedules carry the attribution

Every event in the durable log names its actor, and a schedule records its owner.
The event principal is stamped **only at `appendEvent`**
([`internal/adapter/server/service.go`](../../internal/adapter/server/service.go)),
read from the **context principal — the caller who drove the request, not the
session's owner**. Those are different questions: this phase ships no
authorization, so any authenticated caller may act on any session, and deriving the
actor from the owner would stamp Alice onto every event of a run Bob drove (worst on
`EvApproval`, which records a human granting a tool permission). The owner answers
"whose is this?" and remains the identity of record; the actor answers "who did
this?". The loop and every emit site leave it nil, it
is log-only (`toProto` skips it, the event-sourced `Fold` ignores it), and no proto
change is needed **for the event path** (the `SessionSummary.owner` wire change is
Scenario 3's, called out there). A schedule's owner is captured at **create** time —
never derived at fire time, because `childgc` may sweep the origin session on
retention while the schedule lives on. The capture rule depends on the create
surface: the Schedule-tool path reads the *executing session's* owner via the origin
binder; an out-of-band REST/CLI create (no origin session) reads the *context
principal*; ownerless/none stays empty (never fabricated). A fire's **session**
carries the schedule's owner with `GrantType: client_credentials` — the fire mints
its `sched--` session under the scheduler's system-principal context, so an explicit
owner-injection seam (a `WithOwner` CreateSessionOption sibling of `WithSessionID`)
overrides the stamp; accountability collapses to the person, and the grant type
honestly signals automated-not-interactive. Its **events** name the acting principal
by the same rule as every other event — the scheduler's system principal — so the
owner stays on the session and the events do not claim she personally acted. Every
durable append path stamps through the one chokepoint, the schedule lifecycle
(`fired`/`failed`) events included.

**Work:**
- engine domain (`engine/session/event.go`): the `Event.Actor` field (nil at emit).
- adapters (`internal/adapter/server/service.go`): `appendEvent` stamps `Actor` from
  the loaded session's owner; `toProto` omits it (the log-only sibling of
  `EvApproval`/`EvCompactionArchive`).
- engine domain + proto: `ScheduleSpec` gains `owner`, captured at create per the
  three-surface rule above; the fire path injects it via an explicit
  CreateSessionOption so the fire session's owner is the schedule owner (not the
  scheduler's system principal), with `client_credentials`.

**Acceptance:**
- AC4.1: An event appended during a run driven by Bob is recorded with
  `Actor == Bob's principal` — the caller who **acted**, read from the context
  principal, NOT the session's owner. The two differ whenever one caller acts on
  another's session, which this phase permits (no authorization), so a session owned
  by Alice and driven by Bob records Bob. The loop-side emit leaves it nil and only
  `appendEvent` stamps it — and EVERY durable append path goes through that one
  chokepoint, including the schedule lifecycle (`fired`/`failed`) events.
  - verify: `TestCallerIdentity_Scenario4_EventActorStampedAtAppendOnly`
- AC4.2: The event annotation is log-only — it does not appear on the client wire
  (`toProto` omits it) and does not perturb event-sourced rehydration: a session
  rebuilt by `eventsource.Fold` keeps the owner it restored from the snapshot, and
  the fold neither requires nor re-derives `Event.Actor`.
  - verify: `TestCallerIdentity_Scenario4_EventActorLogOnly`
- AC4.3: A schedule created from Alice's session records Alice as its owner at create
  time, and that owner persists even after the origin session is swept by `childgc`.
  - verify: `TestCallerIdentity_Scenario4_ScheduleOwnerCapturedAtCreate`
- AC4.4: A scheduled fire's `sched--` session records `Owner.Subject ==` the schedule
  owner's subject with `GrantType == client_credentials` (injected via the explicit
  CreateSessionOption, not the scheduler's system principal). Its **events** carry
  the acting principal — the scheduler's **system** principal — so the record
  separates the accountable owner (on the session) from the mechanism that acted (on
  the events). Alice is still named; the events no longer claim she personally acted
  at 3am.
  - verify: `TestCallerIdentity_Scenario4_FireRunsAsOwnerClientCredentials`
- AC4.5: An event appended with **no verified caller** on the context — the
  unauthenticated path, and a pre-ship ownerless session — records a nil/absent
  actor, never a fabricated one.
  - verify: `TestCallerIdentity_Scenario4_OwnerlessEventActorAbsent`
- AC4.6: A schedule created out-of-band (REST/CLI, no origin session) under a
  verified principal records the context principal as its owner — not an
  origin-session lookup.
  - verify: `TestCallerIdentity_Scenario4_OutOfBandScheduleOwnerFromContext`

## Out of scope

| Item | Defer-to | ADR / decision |
|---|---|---|
| All enforcement (refusals, ownership checks at run-entry, model-facing-tool id checks) | isolation track #368 | [ADR-0100](../adr/0100-caller-identity-threading.md) |
| Per-user keying of memory / soul / user-tier skills / agent defs / commands / rules | a multi-tenancy design | ownership map above |
| Redis auth, TLS, keyspace scoping | #374 transport half | [ADR-0100](../adr/0100-caller-identity-threading.md) |
| Snapshot MAC + event-log integrity | #374 second half / #385 | [ADR-0100](../adr/0100-caller-identity-threading.md) |
| Sensitivity labels #369, deliberate sharing #370 | later phases | [`docs/agent-identity-model.md`](../agent-identity-model.md) |
| The kind Alice/Bob demo | isolation track #368 (it demonstrates refusals, which don't exist yet) | [ADR-0100](../adr/0100-caller-identity-threading.md) |
| The `agent` field on `CreateSessionRequest` | a separate gap the design doc names | [`docs/agent-identity-model.md`](../agent-identity-model.md) |

## Cross-cutting deliverables

- `docs/adr/0100-caller-identity-threading.md` (this plan's ADR — added alongside).
- `docs/adr/0027-cloud-native.md`: a List 1 row for the `toolhive-core/authn` JWKS
  cache (outlives a tool call; owned by the validator's app-lifetime ctx); a List 2
  rehydrate-fidelity row for the owner (decision: **persist-in-snapshot**); and a
  List 2 row for the `Event.Actor` annotation (decision: **derive-at-append**, never
  persisted as identity-of-record — the session owner is the record).
- `user-docs/`: the new `--oidc-issuer` / `--oidc-jwks-uri` / `--oidc-audience`
  flags, kept lean (a short section + a link to the full reference).
- `docs/architecture.md`: a caller-identity note in the relevant section.
- `engine/api/*.txt` + `engine/CHANGELOG.md` (Scenario 0 touches the engine's
  exported surface; `task api:update`).
- `llms.txt` regen + the matlatl strict link gate (`task docs`).

## Sequencing recommendation

Scenario 0 (the field prep) lands first and is independent of the library — it
unblocks both tracks' schema. Scenario 1 (edge accept) is the only slice that depends
on `toolhive-core/authn`; it can be built behind a fake verifier and flipped to real
when the module lands. Scenarios 2–4 (thread, persist, annotate) are mecatl-internal
and proceed in parallel with the library work. The critical ordering is 0 → 3 (the
owner field must exist before it is stamped) and 1 → 2 (a principal must be accepted
before it can be threaded to the goroutines' edge counterparts).

## Named tests landing in this plan

- `TestCallerIdentity_Scenario0_OwnerSnapshotRoundTrip`
- `TestCallerIdentity_Scenario0_PreShipSnapshotRestores`
- `TestCallerIdentity_Scenario0_APICompatAdditive`
- `TestCallerIdentity_Scenario1_ValidTokenYieldsPrincipal`
- `TestCallerIdentity_Scenario1_BadTokensRejected`
- `TestCallerIdentity_Scenario1_NoAuthByteIdentical`
- `TestCallerIdentity_Scenario1_IdentityPredicateIndependent`
- `TestCallerIdentity_Scenario1_JWKSDownIsTransientNotUnauthorized`
- `TestCallerIdentity_Scenario1_MisconfiguredOIDCFailsToStart`
- `TestCallerIdentity_Scenario1_RateLimitKeyedOnPrincipal`
- `TestInvariant_no_fabricated_principal`
- `TestCallerIdentity_Scenario2_InternalGoroutinesRunAsSystem`
- `TestCallerIdentity_Scenario3_OwnerRecordedAndListed`
- `TestCallerIdentity_Scenario3_OwnerSurvivesReopenRestart`
- `TestCallerIdentity_Scenario3_ForkInheritsSourceOwner`
- `TestCallerIdentity_Scenario3_PreShipSessionNeverBackfilled`
- `TestCallerIdentity_Scenario3_ListRowOwnerIsDisplayOnly`
- `TestCallerIdentity_Scenario4_EventActorStampedAtAppendOnly`
- `TestCallerIdentity_Scenario4_EventActorLogOnly`
- `TestCallerIdentity_Scenario4_ScheduleOwnerCapturedAtCreate`
- `TestCallerIdentity_Scenario4_FireRunsAsOwnerClientCredentials`
- `TestCallerIdentity_Scenario4_OwnerlessEventActorAbsent`
- `TestCallerIdentity_Scenario4_OutOfBandScheduleOwnerFromContext`

## Definition of done

1. `task lint` and `task test` pass (both modules, `-race`).
2. `task docs` — `llms.txt` regenerated and the matlatl strict link gate green.
3. `task api:check` passes (or `task api:update` was run and the
   `engine/CHANGELOG.md` note is present) — Scenario 0 touches the engine's exported
   surface.
4. `task ac-trace-strict` — every AC's `verify:` proof resolves (this plan is
   `landed`).
5. The named tests (`TestCallerIdentity_*`) are green and grep-locatable by their
   identifiers.
6. `go run ./cmd/mecademo` still prints a full offline session (no OIDC configured ⇒
   byte-identical, nil principal).

## Deferred decisions and known risks

- **`toolhive-core/authn` is built by a sibling agent.** The API shape is formalized
  (`/tmp/toolhive-core-authn-api-shape.md`) and covers all four hardening fixes; the
  risk is divergence between the doc and the merged module. Mitigated by building
  Scenario 1 behind a fake verifier and flipping to real on merge.
- **No OIDC deployment is possible from this plan alone, and token mechanics are
  UNVERIFIED here.** `OIDCConfig.NewValidator` is nil in both server mains, so
  `--oidc-issuer` is a fatal startup error today (deliberately fail-closed, never a
  silent degrade). Everything behind `PrincipalValidator.Validate` is therefore
  untested in this tree: algorithm pinning and `alg: none` rejection (CWE-347),
  HMAC/RSA key confusion, `kid` handling and JWKS rotation, negative caching of
  unknown kids, byte-exact issuer canonicalization, `aud` enforcement,
  `exp`/`nbf`/`iat` and clock leeway, TLS verification and timeouts on the JWKS
  fetch, and JWKS response size bounds. **Treat RFC 7519 §7.2, RFC 8725 (JWT BCP)
  and RFC 9700 conformance as entirely deferred**, and gate the first real
  `--oidc-issuer` deployment on a review of `toolhive-core/authn` itself plus a
  re-run of AC1.2 against genuine JWTs. What this plan DOES verify is mecatl's half:
  no fail-open, no fallthrough, and a rejection honoured absolutely.
- **`Principal.Name` is PII on the durable record.** It is a display label from the
  token (in practice a full name or email), denormalized onto every event in
  `.events.jsonl`, the session snapshot, and the schedule file (all `0600`, dirs
  `0700`). No redaction, no retention policy tied to it. `session.Principal` carries
  no JSON tags, so it serializes with Go-cased keys. Worth a conscious
  GDPR/retention decision before an OIDC deployment; not a defect.
- **`Authority` ships inert until Track C.** Accepted per the joint-prep decision: a
  dead additive field is cheaper than a recurring three-way conflict on generated
  files. If Track C's field shape is unsettled, this is the one assumption to
  revisit.
- **Enforcement is explicitly not yet.** This plan threads the data; nothing is
  refused. The value is that the isolation track's decision function reads a complete,
  durable, agreed-upon data layer instead of five separately-unit-tested pieces.
- **`GrantType` derivation from `Claims`.** `authn.Principal` carries `Claims
  map[string]any`; mecatl derives `GrantType` (user vs client_credentials) from grant
  indicators or defaults it. The exact claim(s) consulted are an implementation
  detail pinned in ADR-0100.

## Exit criteria

When every point under *Definition of done* holds on the accumulator, this plan is
satisfied.
