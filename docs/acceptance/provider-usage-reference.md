# Provider usage-reference event — acceptance plan

**Contract:** human-reviewed/v2
**Work classification:** Architectural — this adds durable engine chunk and session-event vocabulary, a public client event, a compatibility feature, and a trust boundary for provider-issued correlation metadata.
**Decision record:** [ADR 0353](../adr/0353-provider-usage-reference-event.md)
**Phase:** I2I `remote-read-only-v1` provider-usage correlation
**Status:** in-progress, 2026-09-27. The implementation candidate resolves all 11 plan criteria, but the repository-wide strict trace gate remains blocked by the baseline's unrelated missing `TestInvariant_custom_provider_live_metadata_conservative` proof. No waiver, fork release, or downstream qualification is claimed.
**Delivery:** Split. The exported Go constants, client-visible event semantics, compatibility signal, persistence treatment, and billing non-claims require human review before implementation.
**Expected tasks:** 3
**Issue:** None — this fork capability is tracked by the downstream I2I qualification and cost-accounting records.
**Plan PR:** [sabbanis/mecatl#6](https://github.com/sabbanis/mecatl/pull/6), merged.
**Approved baseline:** `e6312061d3744e29a77cf54fccc79af561a853b8`.

Expose the successful OpenAI Responses identity that the adapter already observes
as one bounded, opaque, client-visible correlation reference. An independently
qualified client can bind the model run to later provider usage evidence without
Mecatl looking up billing data, calculating a charge, or treating the identifier
as proof that a bill is authentic.

The initial consumer is I2I's `remote-read-only-v1` ExecutionHost. The event is a
general Mecatl metadata contract, however: it remains useful to any client that
needs a provider-issued correlation candidate, and it does not import I2I source
or accounting policy into Mecatl.

## Human decisions

- [x] Use one provider-neutral event rather than an OpenAI-specific payload. — Decision: add `provider.usage_reference`; its `text` is an opaque identifier and conveys neither provider type nor billing semantics.
- [x] Emit only an observed successful-response identity. — Decision: the OpenAI Responses adapter emits exactly one reference only after `response.completed`; it may use the matching identity observed earlier in the same typed response lifecycle, but never fabricates or derives one.
- [x] Bound the public value to the downstream client's accepted grammar. — Decision: the exact grammar is `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, with no trimming, normalization, hashing, or case folding.
- [x] Fail closed on contradictory provider metadata without breaking providers that omit it. — Decision: distinct non-empty response identities in one stream or any non-empty identity outside the grammar terminate the stream; a stream with no identity emits no reference, leaving strict consumers to reject or withhold qualification.
- [x] Make capability support discoverable. — Decision: advertise exact feature `provider_usage_reference_v1`; support means the build implements the contract, not that every configured endpoint will supply an identity.
- [x] Keep accounting and authority downstream. — Decision: the event grants no execution, provider-query, billing, refund, support, or release authority and is insufficient by itself to prove usage or cost.

## Interface contract

- **gRPC / protobuf:** No message, method, field number, enum, or status mapping changes. The existing open-string `Event.type` carries exact value `provider.usage_reference`, existing `Event.text` carries the reference, and `GetCompatibilityInfoResponse.features` carries exact open-string feature `provider_usage_reference_v1`. HTTP/JSON/SSE preserves the same type and text through the existing mapping.
- **Exported Go APIs / interfaces:** Append exported `port.ChunkProviderUsageReference` to `engine/port.ChunkKind` and exported `session.EvProviderUsageReference EventType = "provider.usage_reference"`. The chunk carries the reference in `Chunk.Text`; no interface method, request field, struct field, or provider-neutral input changes. API compatibility snapshots and the engine changelog record the additive minor surface.
- **Tool schemas:** None — the reference is harness metadata and adds no model-visible tool, tool result, permission, MCP, delegation, or training schema.
- **CLI / config:** None — there is no flag, setting, credential, provider selector, or default change. A supporting build advertises `provider_usage_reference_v1` on its existing compatibility endpoint; endpoint-specific availability is proven by an actual successful run rather than configured optimistically.
- **Events / persistence:** At most one `provider.usage_reference` is emitted per successful provider call. Its `Turn` and `RunID` use the enclosing run, and `Text` is the exact validated identifier. On terminal completion the deterministic chunk order is `provider.route` when present, then `provider.usage_reference` when present, then any assembled reasoning replay item, usage, and done. The loop relays the chunk verbatim, counts it against ordinary event ceilings, and never records it in model conversation or session snapshot state. When the existing event recorder is configured, it durably retains the event as client-visible run metadata. Failed, incomplete, cancelled, or identity-free responses emit no reference.
- **Security / authority:** The identifier is untrusted provider metadata. It is accepted only from typed Responses lifecycle events, must match the exact 1–128-byte ASCII grammar, and must remain consistent across the stream. It is never used as a URL, credential, command, log message, routing input, authorization grant, or automatic provider API lookup. Mecatl does not separately log it or attach prompts, response bodies, headers, secrets, customer content, prices, or account identity. Possession of the value grants no authority and proves no bill.
- **Compatibility / migration:** This is an additive engine/API minor change and additive open-string wire event. Existing server profiles, adapters, events, clients, and session records remain valid. Updated TypeScript SDKs type the event with the common `text` field and add `ServerFeature.ProviderUsageReferenceV1`; older clients retain their existing unknown-event behavior. Clients that require correlation preflight the feature and still require exactly one valid event in the run. The first fork artifact carrying it uses the existing reviewed `v0.0.39-i2i.N` namespace and must be independently requalified; it does not alter or claim an upstream release.

## In scope — 3 scenarios, in implementation order

### Scenario 1 — The Responses adapter exposes one trustworthy correlation candidate

The OpenAI adapter already observes the Responses identity for structured error
metadata but discards it on success. It now preserves only the minimal successful
correlation value, following the provider-neutral output boundary in
[the provider architecture](../architecture/providers.md) and the existing
terminal metadata precedent in
[ADR 0210](../adr/0210-openrouter-downstream-provider-steering.md).

**Acceptance:**
- AC1.1: A completed typed Responses lifecycle with one valid, consistent identity emits exactly one `ChunkProviderUsageReference` carrying the byte-exact identity.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario1_CompletedResponseEmitsExactReference`
- AC1.2: The reference follows a routed-provider chunk when both exist and precedes reasoning replay, usage, and done chunks; direct compatible endpoints may emit the reference without a route.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario1_TerminalChunkOrder`
- AC1.3: A non-empty malformed identity or two distinct non-empty identities in one lifecycle fails the stream without emitting a usage-reference chunk or successful terminal result.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario1_InvalidOrConflictingIdentityFailsClosed`
- AC1.4: An identity-free, failed, incomplete, or cancelled lifecycle emits no usage-reference chunk, and the adapter never fabricates one from a request ID, route, model, run, or response content.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario1_AbsentOrUnsuccessfulResponseEmitsNone`

### Scenario 2 — The engine and client wires preserve the exact metadata event

The engine treats the value as provider-neutral metadata, not model content. The
existing open-string event wire carries it without a protobuf migration, while
the compatibility endpoint lets strict clients distinguish an older binary from
a supporting build. [ADR 0353](../adr/0353-provider-usage-reference-event.md)
owns the exact relay, persistence, and discovery contract.

**Acceptance:**
- AC2.1: The loop relays one `ChunkProviderUsageReference` to one `EvProviderUsageReference` with the exact `Turn` and `Text`; the server binds the enclosing `RunID`, while the value remains excluded from assistant text, reasoning, token usage, stop selection, and conversation history.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario2_LoopRelaysMetadataOnlyEvent`
- AC2.2: HTTP/SSE and gRPC expose exact event type `provider.usage_reference` and exact text through existing fields, and normal event recording retains the same value without an additional diagnostics or log projection.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario2_WireAndRecorderPreserveExactReference`
- AC2.3: The server and TypeScript registries advertise exact feature `provider_usage_reference_v1`; the TypeScript SDK recognizes the event as a known text-bearing event while continuing to preserve unknown future events.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario2_FeatureAndTypeScriptRegistryParity`
- AC2.4: The new chunk is non-committing in resilience classification and consumes the same resource/event budget as any other client-visible event.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario2_NonCommittingAndResourceCounted`

### Scenario 3 — Existing behavior and qualification claims remain bounded

The correlation reference closes only the successful-response identity gap. It
does not authenticate a provider statement, resolve a billing record, or qualify
a deployment. Those claims remain downstream gates, consistent with
[ADR 0352](../adr/0352-controlled-fork-qualification-release.md) and Mecatl's
[production-readiness record](../design/PRODUCTION-READINESS.md).

**Acceptance:**
- AC3.1: Existing OpenAI/OpenRouter output, provider-route, error-correlation, usage, retry, default-profile, `no-fs`, and model-only tests remain green when no successful reference is available.
  - verify: `TestADR_0353_ProviderUsageReference_Scenario3_ExistingAdapterAndProfileCompatibility`
- AC3.2: User/API documentation defines the exact feature, event, grammar, lifecycle, persistence treatment, and billing/authority non-claims without presenting the value as authenticated cost evidence.
  - verify: inspection — HTTP/SSE reference, provider architecture, implementation notes, engine changelog, and production readiness carry the reviewed contract; `task docs` validates links and generated surfaces.
- AC3.3: A fork release and I2I requalification pin the exact merged source, artifact digests, configuration, provider route, usage-reference event, and client artifact before the route can claim provider-usage correlation.
  - verify: inspection — the qualification release procedure and downstream I2I qualification record retain release, deployment, source-authentication, cost-reconciliation, and admission as separate gates.

## Out of scope

| Item | Defer-to | Decision |
|---|---|---|
| Provider billing lookup, pricing, charge calculation, refunds, invoice reconciliation, or API credentials | I2I provider-meter source adapter | Mecatl exports a correlation candidate only; it does not contact a billing API or attest a charge. |
| AWS resource identity, CUR line items, GPU/host allocation, scheduling, or infrastructure cost | I2I infrastructure meter and later Factory Compiler contracts | A model-provider response identity cannot identify or price infrastructure. |
| Signed meter sources, reconciliation evidence, encrypted accounting retention, and final cost receipt | I2I cost-accounting v2 qualification | Those require independent source identity and lifecycle policy beyond this event. |
| A mandatory identity for every OpenAI-compatible endpoint | Provider-specific qualification | Support is discoverable, but absence remains truthful because compatible endpoints may omit Responses IDs. |
| Usage references from Anthropic Messages, Chat Completions, or other adapters | A later provider-adapter plan | The first implementation uses the typed OpenAI Responses lifecycle already present in the launch fork. |
| Upstream contribution, general Mecatl release, or stable support commitment | Post-launch contribution planning | The change remains fork-only through product launch. |
| I2I source, receipt schemas, or billing policy in the Mecatl repository | Not planned | Repositories compose through the versioned event and compatibility contracts. |

## Definition of done

1. This Plan / Interface PR and ADR 0353 are human-reviewed and merged into `i2i/model-only-one-shot-v0.0.39-baseline`; the full merge commit is recorded before implementation starts.
2. Every acceptance criterion resolves to the named proof or retained inspection evidence, and `task ac-trace-strict` passes when the plan becomes authoritatively `landed`.
3. `task lint`, `task test`, `task build`, `task api:check`, `task docs`, applicable TypeScript SDK lint/typecheck/test/build/API gates, and `go run ./cmd/mecademo` pass on the implementation candidate.
4. The implementation PR links the approved plan commit, reports interface conformance, receives final human review, and is merged before a new qualification tag is created.
5. A human-authorized next `v0.0.39-i2i.N` tag publishes the merged source through the existing fork-only workflow, and a clean consumer verifies the artifact, manifest, checksums, signatures, SBOMs, and provenance.
6. I2I pins the new server and client artifacts, observes one route-bound reference on an approved non-mock provider run, and reruns its adverse protocol and cost-attribution qualification before admitting the route.

## Deferred decisions and known risks

- OpenAI-compatible endpoints can omit or vary response identities. The feature advertises implementation support, so downstream qualification must still prove one exact approved route produces the event.
- A syntactically valid identifier is not authenticated evidence. Provider-meter source authentication and matching remain downstream blockers.
- Client-visible event retention can make a response identifier long-lived. Deployment retention and deletion policy must cover the event log; Mecatl adds no second copy or new retention store.
- The additional event consumes one model-only event-budget unit. Requalification must verify configured ceilings rather than silently exempting the metadata.
- The reference grammar intentionally matches the pinned I2I client's current accepted identifier shape. A provider that needs a wider identity requires a new reviewed contract and coordinated client migration.
