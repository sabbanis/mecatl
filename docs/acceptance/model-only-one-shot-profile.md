# Model-only one-shot profile — acceptance plan

**Contract:** human-reviewed/v2
**Work classification:** Architectural — this adds a durable session-profile value, compatibility feature, public engine resource controls, daemon flags, lifecycle restrictions, and a security attenuation boundary.
**Decision record:** [ADR 0350](../adr/0350-model-only-profile-and-compaction-off.md)
**Phase:** bounded model-only runtime for external qualification
**Status:** proposed, 2026-09-24. The contract is ready for Plan / Interface review; the existing local implementation is an unapproved candidate and cannot be admitted or released before this plan merges.
**Delivery:** Split. The public profile, engine API, CLI/configuration, persistence, compatibility, and security contracts require a separate human Plan / Interface review.
**Expected tasks:** deferred to orchestration
**Issue:** None — this fork capability is tracked by the downstream I2I qualification record.
**Plan PR:** [sabbanis/mecatl#1](https://github.com/sabbanis/mecatl/pull/1)
**Approved baseline:** absent until the Plan / Interface PR merges.

Provide a narrowly qualified Mecatl session that performs one bounded primary
model request without advertising tools, filesystem access, hidden instruction
sources, compaction, retries, scheduling, or auxiliary model paths. The profile
is an additive attenuation of the existing server and does not turn Mecatl into
an execution-authority, deployment-provisioning, or tenant-isolation service.

The initial consumer is I2I's `remote-read-only-v1` ExecutionHost boundary, but
the Mecatl contract remains independently versioned and discoverable. An
external client must bind its own exact server, protocol, configuration,
deployment, route, grant, transport, event, usage, cleanup, and result checks.

## Human decisions

- [x] Add one explicit session profile rather than weakening `no-fs`. — Decision: the exact wire value is `model-only`; it binds no-FS placement but constructs an empty model-visible catalog and remains fixed for the session lifetime.
- [x] Make capability absence a construction property. — Decision: return before all core, web, MCP, memory, schedule, skill, delegation, shell, filesystem, host-attached, and run-scoped tool registration; permission denial alone is insufficient.
- [x] Disable both automatic and manual compaction. — Decision: add daemon strategy `--compaction=off`, remove the context-window trigger, and return `agent.ErrCompactionDisabled` from manual compaction without history mutation or a model call.
- [x] Make the profile one-shot. — Decision: require default mode and exactly one turn, persist an attempt fence before provider launch, reject carryover, retry, reopen, scheduling, steering, title generation, prompt-cache use, provider retry, and auxiliary model routes.
- [x] Require a complete positive resource envelope. — Decision: bound final neutral request bytes, cumulative neutral response bytes, event count, individual and buffered event bytes, retained conversation bytes, queued runs, concurrent provider streams, cumulative run tokens, and total duration; reject invalid or disabled values before session creation.
- [x] Keep qualification discoverable but independently pinned. — Decision: advertise exact feature identifier `model_only_v1` in both server and TypeScript registries; clients fail closed before session creation when it is absent, while exact build/protocol/configuration/deployment qualification remains separately required.
- [x] Preserve existing profiles and ownership boundaries. — Decision: default and `no-fs` behavior remain unchanged, placement stays server-owned, authentication remains listener-owned, and this profile grants no provisioning, operator, billing, tenant-isolation, or remote-execution authority.
- [x] Keep the downstream client out of the Mecatl source boundary. — Decision: the I2I client remains a separately packaged consumer artifact bound by versioned wire contracts and exact qualification digests.

## Interface contract

- **gRPC / protobuf:** No schema or field-number change. The existing open-string `CreateSessionRequest.profile` additionally accepts exact value `model-only`; every other unknown value remains `InvalidArgument`. `GetCompatibilityInfo.features` additionally advertises exact open-string identifier `model_only_v1`. HTTP `POST /v1/sessions` and `GET /v1/compatibility` mirror those values. A successful create returns the existing no-FS placement projection and existing session identifier shape.
- **Exported Go APIs / interfaces:** `engine/agent.Deps` adds optional `MaxEvents`, `MaxEventBytes`, `MaxBufferedEventBytes`, `MaxSessionBytes`, `MaxRunDuration`, and `DisableRunScopedTools` fields; their zero values preserve existing behavior. `engine/agent` adds stable sentinels `ErrCompactionDisabled`, `ErrRunEventCountLimit`, `ErrRunEventBytesLimit`, `ErrSessionBytesLimit`, `ErrRunDurationLimit`, and `ErrRunScopedToolsDisabled`. No existing interface method changes. Root-internal composition adds `app.ModelOnlyResourceLimits` and `DefaultModelOnlyResourceLimits` without exposing that type through the importable engine module.
- **Tool schemas:** None — the profile exposes no model-visible tool and adds no tool name, argument, result, permission, MCP, or delegation schema. Any client MCP or run-scoped tool request is rejected before outbound work.
- **CLI / config:** `--compaction` accepts additive value `off`. Mecated adds `--model-only-max-request-bytes` (1048576), `--model-only-max-response-bytes` (4194304), `--model-only-max-events` (4096), `--model-only-max-event-bytes` (5242880), `--model-only-max-buffered-event-bytes` (10485760), `--model-only-max-session-bytes` (8388608), `--model-only-max-queued-runs` (32), `--model-only-max-concurrent-runs` (8), and `--model-only-max-duration` (5m). Model-only creation additionally requires `--compaction=off`, `--llm-max-attempts=1`, `--no-prompt-cache`, and a positive `--max-run-tokens`. Invalid, zero, inconsistent, or missing required controls fail creation rather than selecting broader defaults.
- **Events / persistence:** No event kind or protobuf event shape changes. Event sequence/run identity retains the existing contract. Event-count and byte overruns reserve and emit one terminal `result` with `StopBudget`; session-byte and engine-owned duration overruns also terminate as `StopBudget`; provider-boundary, queue, and forbidden-overlay failures terminate as `StopError`. The session persists exact profile, default mode, one-turn limits, no-FS environment, and an attempt identifier before provider launch. A model-only session cannot be reopened, retried, carried over, or scheduled.
- **Security / authority:** The catalog is empty by construction and remains empty under fully loaded server configuration. The session receives no filesystem, shell, web, MCP, memory, skill, schedule, delegation, hook, learning, instruction-discovery, secondary-sink, tool-recorder, semantic-router, or host-attached capability. The posture text truthfully states no filesystem and no tools. Existing listener authentication/TLS and caller ownership still apply; `model-only` does not authenticate a deployment, authorize an I2I grant, isolate tenants, or prove a remote endpoint.
- **Compatibility / migration:** The profile and feature identifier are additive open-string values. Existing default and `no-fs` sessions, configurations, snapshots, and clients remain unchanged. Older servers omit `model_only_v1` and must be rejected by a client requiring this profile; older clients may preserve the unknown feature and must not infer support from version strings. Persisted `model-only` state is rejected by binaries that do not understand the profile rather than broadened to default. Any future widening or semantic change requires a new feature identifier and qualification.

## In scope — 5 scenarios, in implementation order

### Scenario 1 — A client discovers and creates the exact attenuated profile

The wire remains open-string and additive under
[ADR 0248](../adr/0248-sdk-compatibility-and-error-contract.md), while the
attenuation contract comes from [ADR 0350](../adr/0350-model-only-profile-and-compaction-off.md).
A client can therefore determine support without creating a probe session.

**Acceptance:**
- AC1.1: Compatibility advertises exact `model_only_v1`; the TypeScript known-feature registry carries the same value and the cross-language registry guard fails on drift.
  - verify: `TestModelOnlyOneShotProfile_Scenario1_CompatibilityAndCreation`; `TestModelOnlyProfileIsAdvertisedForCompatibilityPreflight`; `TestSDKServerDiscovery_Scenario4_ConstantRegistryParity`
- AC1.2: `model-only` parses over the existing profile field, round-trips through gRPC and HTTP, binds the existing no-FS placement, and every unknown profile still fails loudly.
  - verify: `TestParseSessionProfile`; `TestGRPCCreateSessionModelOnlyProfileRoundTrip`; `TestHTTPCreateSessionProfileRoundTrip`; `TestGRPCCreateSessionProfileValidation`
- AC1.3: Creation rejects a non-default mode, carryover, a wider turn limit, or client MCP before provider work and never silently falls back to a broader profile.
  - verify: `TestModelOnlyCreateRejectsModeCarryoverAndWiderTurnLimit`; `TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction`

### Scenario 2 — The model receives no tools or hidden context-management path

Capability absence is established at catalog construction and engine
composition, not by a policy response after a capability is advertised, as
required by [ADR 0350](../adr/0350-model-only-profile-and-compaction-off.md)
and the inward-only composition boundary in [architecture](../architecture.md).

**Acceptance:**
- AC2.1: A fully loaded daemon configuration still constructs an empty catalog and mounts no client tools for a model-only session.
  - verify: `TestADR_0350_ModelOnlyProfileAndCompactionOff`; `TestModelOnlyOneShotProfile_Scenario2_EmptyCatalogAndCompactionOff`; `TestModelOnlyCatalogIsEmptyUnderFullyLoadedConfig`
- AC2.2: A valid session sends exactly one primary provider request with an empty tool list and the truthful model-only posture; client MCP and run-scoped tool overlays fail before another provider call.
  - verify: `TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction`
- AC2.3: `--compaction=off` is explicitly validated, automatic compaction has no trigger, and manual compaction fails with `ErrCompactionDisabled` without mutation or a model call.
  - verify: `TestValidateEffectiveConfigCompaction`; `TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction`
- AC2.4: Title generation, instruction/profile discovery, hooks, learning, delivery, steering, semantic routers, prompt caching, secondary sinks, and auxiliary provider paths are absent from the model-only engine composition.
  - verify: inspection — `internal/app/build.go` uses the dedicated model-only branch and the aggregate build/layering gates guard its dependency boundary.

### Scenario 3 — One attempted run cannot be replayed or scheduled

The service records admission before launching the model so a crash cannot
reload the session as unused and repeat an uncertain request. This is the
one-shot lifecycle selected by
[ADR 0351](../adr/0351-bounded-one-shot-model-only-runs.md).

**Acceptance:**
- AC3.1: Created sessions persist default mode, exact one-turn limits, disabled title generation, the model-only profile, no-FS placement, and an attempt identifier before provider launch.
  - verify: `TestModelOnlyOneShotProfile_Scenario3_OneShotPersistence`; `TestGRPCCreateSessionModelOnlyProfileRoundTrip`
- AC3.2: A second run, reopen, retry, carryover, or wider turn request is rejected without another provider call.
  - verify: `TestGRPCCreateSessionModelOnlyProfileRoundTrip`; `TestModelOnlyCreateRejectsModeCarryoverAndWiderTurnLimit`
- AC3.3: Both schedule creation and scheduler firing reject model-only state rather than executing it.
  - verify: `TestModelOnlyProfileCannotBeScheduled`; `TestSchedulerFireRejectsPersistedModelOnlyProfile`

### Scenario 4 — Every resource dimension has a positive fail-closed ceiling

Limits are measured at the deterministic provider-neutral and domain-event
boundaries defined by
[ADR 0351](../adr/0351-bounded-one-shot-model-only-runs.md), and never silently
truncate, retry, or continue after overrun.

**Acceptance:**
- AC4.1: Request and cumulative response byte ceilings stop work at the final provider-neutral boundary.
  - verify: `TestADR_0351_BoundedOneShotModelOnlyRuns`; `TestModelOnlyOneShotProfile_Scenario4_ResourceEnvelope`; `TestBoundedModelOnlyProviderRequestAndResponseBytes`
- AC4.2: Event-count admission reserves one terminal result; oversized events are not published and terminate with the stable event-limit cause.
  - verify: `TestRunEventCountLimitReservesTerminalResult`; `TestRunEventByteLimitFailsClosed`
- AC4.3: Buffered-event bytes determine a bounded channel capacity, and the engine-owned duration ceiling releases an undrained full buffer and reaches a declared terminal outcome.
  - verify: `TestBufferedEventBytesDetermineChannelCapacity`; `TestRunDurationLimitIsDeclaredTerminal`; `TestRunDurationLimitUnwedgesUndrainedEventBuffer`
- AC4.4: A retained-conversation overrun is rejected before the provider call.
  - verify: `TestSessionByteLimitRejectsBeforeProviderCall`
- AC4.5: One shared gate bounds concurrent provider streams and queued runs across every model-only engine from the factory; queue overflow fails without starting another stream.
  - verify: `TestModelOnlyRunGateBoundsConcurrencyAndQueue`
- AC4.6: All nine model-only limit flags have positive bounded defaults, map exactly into composition, and inconsistent envelopes fail session creation.
  - verify: `TestModelOnlyResourceLimitFlagsAndAppConfig`; `TestModelOnlyFactoryFailsClosedAndRunsWithoutToolsOrCompaction`

### Scenario 5 — Existing behavior and qualification boundaries remain honest

The capability is independently useful but cannot be promoted from source or
loopback evidence alone. Mecatl's authoritative shipped/deferred state remains
the [production-readiness record](../design/PRODUCTION-READINESS.md), while
[ADR 0350](../adr/0350-model-only-profile-and-compaction-off.md) and
[ADR 0351](../adr/0351-bounded-one-shot-model-only-runs.md) define only the
proposed runtime contract.

**Acceptance:**
- AC5.1: Existing default and `no-fs` profile parsing, creation, rehydration, catalog behavior, and API compatibility remain green.
  - verify: `TestModelOnlyOneShotProfile_Scenario5_CompatibilityAndQualificationBoundaries`; `TestGRPCCreateSessionProfileRoundTrip`; `TestNoFSSessionUsesWorkspaceOverride`; `TestNoFSSessionRehydratesAfterRestart`; `TestNoFSRehydrationWithoutFactoryFailsLoudly`; `TestLoadSessionWithMCPDerivesNoFSProfile`
- AC5.2: User and operator references document the profile, prerequisites, limits, feature preflight, one-shot lifecycle, and explicit non-claims; generated API and link checks remain strict.
  - verify: inspection — `user-docs/reference/http-sse-api.md`, `user-docs/building/deployment/mecated.md`, architecture, implementation notes, production readiness, and both ADRs carry the contract; `task docs` checks generation and links.
- AC5.3: Source tests or authenticated loopback conformance do not claim an immutable artifact, approved deployment configuration, production grant issuer, protected remote handoff, tenant isolation, or hosted availability.
  - verify: inspection — the [production-readiness record](../design/PRODUCTION-READINESS.md) and downstream I2I qualification record retain those gates as pending.

## Out of scope

| Item | Defer-to | Decision |
|---|---|---|
| I2I request planning, grants, receipt verification, client credential resolution, and task verification | I2I `ExecutionHost` contract | Mecatl accepts one model-only request; it does not become the compiler or verifier. |
| TLS identity, caller authentication policy, tenant/workspace isolation, endpoint provisioning, deployment attestation, metering, billing, and support | Each qualified operator deployment | Existing server controls remain prerequisites; this profile does not prove them. |
| Immutable fork artifact publication, SBOM/provenance/signature evidence, approved configuration, and requalification | Fork release/qualification workflow | Local source and loopback builds remain inadmissible until the exact artifact set passes. |
| Tools, filesystem mutation, MCP, web access, memory, skills, delegation, schedules, hooks, learning, steering, retries, compaction, cache, or persistent multi-turn sessions | Separate future profile and acceptance plan | `model-only` cannot be widened in place. |
| Dynamic infrastructure or Factory Compiler provisioning | Later I2I/Factory composition | The first endpoint is separately provisioned and prequalified. |
| Importing downstream I2I source or packaging its client in Mecatl | Not planned | Composition uses versioned external contracts and independent artifacts. |

## Definition of done

1. The Plan / Interface PR containing this plan and ADRs 0350/0351 is human-reviewed and merged; its full commit is recorded before implementation resumes.
2. Every acceptance criterion above resolves to the named proof or retained inspection evidence; `task ac-trace-strict` passes when the plan becomes authoritatively `landed`.
3. `task test`, `task build`, `task lint`, `task api:check`, `task docs`, and applicable TypeScript SDK lint/typecheck/test/build/API gates pass.
4. `go run ./cmd/mecademo` remains green and no live public model or customer content is required by automated verification.
5. An exact candidate server binary, protocol/HTTP mapping, approved configuration, client artifact, and deployment record are digest-bound and independently requalified before route admission.
6. One authenticated protected remote success run and adverse transport/lifecycle suite pass before remote-handoff claims; loopback evidence remains local conformance only.
7. The Implementation PR links the merged Plan / Interface PR and full approved commit, reports conformance to every interface clause, and receives final human review before merge.

## Deferred decisions and known risks

- The public `agent.Deps` fields are general opt-in engine controls whose zero values preserve existing behavior; future engine consumers may compose them differently and must qualify that composition independently.
- Event byte accounting uses JSON encoding of domain events and request/response accounting uses provider-neutral JSON values, not provider-specific wire bytes. Transport ceilings remain additional outer limits.
- `--compaction=off` is daemon-wide, so deployments needing ordinary compaction and model-only sessions must use separate processes.
- A durable store may retain the bounded session record even though the engine receives no memory, learning, or evidence seam; deployment retention is a separate qualification control.
- The local implementation predates this proposed contract. It is evidence for review, not an approved baseline, and must be reconciled against the merged plan rather than grandfathered.
