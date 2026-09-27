# ADR 0353 — Opaque provider usage-reference event

- Status: Proposed
- Date: 2026-09-27
- Scope: successful-response correlation metadata from the OpenAI Responses adapter to external clients
- Supersedes: none
- Superseded by: none

## Context

The OpenAI Responses adapter observes `Response.ID` on typed lifecycle events. It
retains that identity for structured failure metadata, but on a successful
`response.completed` path it currently emits route, reasoning replay, token
usage, and completion while discarding the response identity.

I2I's `remote-read-only-v1` cost-accounting boundary needs a purpose-minimized
way to correlate one accepted model run with independently obtained provider
usage evidence. Token counts and a downstream route label are insufficient:
they can describe a run but cannot select the provider's exact usage record.
Conversely, returning a price from Mecatl would put billing lookup, credentials,
price policy, and evidence authentication into the model runtime.

The event boundary already carries additive open-string metadata. ADR 0210 uses
that boundary for an observed downstream route without adding the value to model
conversation state. A response reference should follow the same structural
discipline while making stronger non-claims: it is an opaque correlation
candidate, not billing proof.

## Decision

1. Add provider-neutral output chunk `port.ChunkProviderUsageReference` and
   session event `session.EvProviderUsageReference`, whose exact wire type is
   `provider.usage_reference`. The exact reference rides `Chunk.Text` and
   `Event.Text`; no provider-specific request field or protobuf field is added.
2. The OpenAI Responses adapter observes non-empty response identities across
   the typed lifecycle. Every observed value must match exact ASCII grammar
   `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, and all non-empty values in one stream
   must be byte-identical. A malformed or conflicting value terminates the
   stream without a successful result.
3. On `response.completed`, the adapter emits exactly one usage-reference chunk
   when the lifecycle supplied a valid identity. It emits the observed value
   byte-for-byte, with no trimming, normalization, hashing, derivation, or
   substitution. It never emits the event for failed, incomplete, cancelled, or
   identity-free responses.
4. Terminal ordering is deterministic: a provider-route chunk when available,
   then the usage-reference chunk when available, then assembled reasoning
   replay, usage, and done. The reference is non-committing metadata in the
   resilience layer and does not affect text, reasoning, usage, or stop state.
5. The agent loop relays the chunk to one client-visible event for the enclosing
   run and turn. The reference is not model conversation, assistant content, a
   session snapshot field, or a diagnostics line. When the existing event
   recorder is configured it durably retains the event, and ordinary
   resource/event ceilings count it.
6. Supporting servers advertise exact open-string compatibility feature
   `provider_usage_reference_v1`. The TypeScript SDK adds the feature to its
   known registry and recognizes `provider.usage_reference` as a known event
   whose value remains in the common `text` field. Existing unknown-event
   preservation remains unchanged.
7. Feature presence means the build implements this behavior. It does not
   promise that every configured OpenAI-compatible endpoint supplies an
   identity. A client requiring correlation must preflight the feature and then
   require a valid event in the actual run.
8. The value remains untrusted provider metadata. Mecatl does not use it as a
   URL, secret, route, command, grant, or lookup key; does not call a provider
   billing API; and does not attach price, account, prompt, response body,
   credential, or customer content. Possession grants no execution or billing
   authority and proves neither usage nor cost.

## Consequences

An external client can bind a successful Mecatl run to the provider's opaque
response identity without granting Mecatl billing credentials or importing the
client's accounting schema. I2I can carry that value in its own versioned host
receipt and later compare it with independently authenticated provider evidence.

The feature and event are additive, but the public Go constants and TypeScript
known-event union are durable API surface. The engine changelog and compatibility
snapshots therefore treat the implementation as a minor addition. Clients that
do not understand the event retain their current open-string/unknown-event
behavior; clients that depend on it must gate explicitly.

Failing on malformed or conflicting non-empty identities prevents control
characters, ambiguous normalization, and cross-response substitution. Omitting
the event when no identity exists preserves truthful compatibility with
OpenAI-compatible endpoints that do not implement the Responses identity. That
tradeoff moves strictness to route qualification: a missing reference cannot
be silently upgraded to attributed usage.

Event-log retention now includes a provider correlation identifier when the
normal recorder is enabled. It remains purpose-minimized and does not get a
second diagnostics or persistence path, but deployment retention/deletion
policy must treat it as run metadata.

## Rejected alternatives

**Return provider cost or billing details from Mecatl.** Rejected because it
would require billing credentials, mutable price policy, provider-specific APIs,
and evidence-authentication responsibilities unrelated to model execution.

**Use token counts, model, route, timestamps, or the Mecatl run ID as the
correlation key.** Rejected because those values are not the provider's exact
response identity and can collide or select the wrong usage record.

**Reuse the error correlation payload or expose the entire provider response.**
Rejected because successful clients need one stable event, while a raw response
would leak unnecessary provider data and couple the engine to an adapter schema.

**Require an identity from every compatible endpoint.** Rejected because
OpenAI-compatible services can omit it. Absence remains explicit; a strict
consumer withholds qualification instead of breaking unrelated Mecatl uses.

**Accept arbitrary Unicode or silently sanitize the identifier.** Rejected
because downstream receipt schemas need a deterministic bounded identity and
sanitization can change what record is selected. Invalid non-empty metadata is
a protocol failure.

**Put the value in a diagnostics line or only a server log.** Rejected because
the invoking client owns the correlation workflow, diagnostics are not the
client event contract, and log scraping would lose exact run/turn ordering.

**Make `provider.route` mandatory before emitting the event.** Rejected because
direct OpenAI Responses endpoints can supply a valid response identity without
OpenRouter routing metadata. A downstream accounting profile may impose the
stronger route-plus-reference rule.

## See also

- [Provider usage-reference acceptance plan](../acceptance/provider-usage-reference.md)
- [ADR 0210 — OpenRouter downstream-provider steering and routing echo](./0210-openrouter-downstream-provider-steering.md)
- [ADR 0352 — Controlled fork qualification releases](./0352-controlled-fork-qualification-release.md)
- [Provider architecture](../architecture/providers.md)
- [Production readiness](../design/PRODUCTION-READINESS.md)
