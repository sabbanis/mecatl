# ADR 0351 — Bounded one-shot model-only runs

- Status: Proposed
- Date: 2026-09-24
- Scope: model-only session lifecycle and resource admission
- Supersedes: ADR 0350 only where it deferred provider, event, state, queue,
  concurrency, and duration limits
- Superseded by: none

## Context

ADR 0350 proves capability absence and disables compaction, but a remote model
service also needs an explicit resource envelope. An empty tool catalog does not
bound a large request, an unbounded response stream, queued work, concurrent
provider calls, event buffering, retained conversation state, or wall-clock
duration. Provider retries, title generation, hooks, and other harness-owned
model calls could also violate a one-attempt contract even when the main catalog
is empty.

This work is the resource/lifecycle half of the split
[model-only one-shot profile acceptance plan](../acceptance/model-only-one-shot-profile.md).
Its Plan / Interface PR must merge before the existing local implementation can
be treated as an approved baseline.

## Decision

1. A `model-only` session is one-shot. It uses default permission mode, rejects
   carryover and scheduled execution, persists exact one-turn limits, and cannot
   be reopened or retried after a run is attempted. The provider retry layer
   must be configured with exactly one attempt.
2. The profile disables title generation, instruction discovery, operator
   profile injection, hooks, learning, delivery queues, steering, durable engine
   evidence, secondary event sinks, tool-call recording, child-ask review, and
   semantic routing. The engine also rejects run-scoped `ExtraTools` before any
   provider call. These controls prevent an auxiliary model call, host-added
   tool, or hidden context source around the one primary request.
3. Provider prompt caching must be disabled, compaction must be off, and a
   positive token ceiling must be configured before creation succeeds.
4. The daemon exposes positive model-only ceilings for request bytes, response
   bytes, event count, individual event bytes, buffered event bytes, retained
   session bytes, queued runs, concurrent runs, and run duration. All have
   bounded defaults and explicit operator flags.
5. Measurements are deterministic at neutral boundaries:
   - request bytes are the JSON encoding of the final `port.LLMRequest`;
   - response bytes are the cumulative JSON encodings of neutral stream chunks;
   - event and buffered bytes are measured from JSON-encoded `session.Event`
     values, with channel capacity derived from the individual and buffered caps;
   - session bytes are the JSON encoding of retained conversation messages.
6. Provider concurrency and queue admission are shared across every model-only
   engine built by one session factory. A full queue is rejected before another
   provider stream starts.
7. Every overrun is terminal and observable. Engine-owned event, session, and
   duration overruns end with `StopBudget`; provider-boundary and queue failures
   end with `StopError`. The violating item is not silently truncated, retried,
   or followed by another model call. One event slot is reserved for the result.
8. The service persists the one-shot attempt identifier before launching the
   engine. A process failure after admission therefore cannot reload the session
   as fresh and issue the provider request again.

## Consequences

The profile is safe by construction only when all creation gates pass. Ordinary
and `no-fs` sessions retain their existing behavior because the new engine
ceilings have disabled zero values and composition applies positive values only
to `model-only` engines.

The request and response byte definitions describe Mecatl's provider-neutral
semantic boundary, independent of HTTP, gRPC, or provider-specific wire
serialization. Existing transport body/message limits remain additional outer
ceilings.

The session service may persist lifecycle state through its configured
`SessionStore`; the model-only engine itself receives no persistence seam and no
memory or learning surface. Deployments requiring session-only state must still
run the daemon with its durable store and auxiliary memory sources disabled.

## See also

- [ADR 0350 — Construction-time model-only sessions and explicit compaction-off](./0350-model-only-profile-and-compaction-off.md)
- [ADR 0037 — Engine public-API stability contract](./0037-engine-stability-contract.md)
- [Model-only one-shot profile acceptance plan](../acceptance/model-only-one-shot-profile.md)
- [Deployment reference](https://mecatl.dev/docs/building/deployment/mecated)
