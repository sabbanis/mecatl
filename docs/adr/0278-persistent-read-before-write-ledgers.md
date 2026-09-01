# ADR 0278 — Persistent read-before-write ledgers are independent storage

- Status: Accepted
- Date: 2026-08-26
- Scope: Workspace read-before-write evidence, adapter composition, and durable ledger storage
- Supersedes: ADR 0208 decision 6 only (live-Workspace/in-memory ledger lifetime)
- Superseded by: none

## Context

ADR 0208 made file mutation version-aware: agent-facing Read records the exact opaque version returned by `ReadVersion`; Edit and existing-file Write require that evidence, compare it with a current read, and finish with conditional `ReplaceFile`. It deliberately stored the evidence in a live Workspace's in-memory map and reset it whenever the Workspace was rebuilt.

That lifetime is safe but prevents a disposable or replicated deployment from retaining read evidence independently of the backend that stores file contents. A future principal-scoped Redis filesystem needs file contents shared by a principal while read evidence remains scoped to each session. Coupling both concerns to one Workspace-owned map either loses evidence at process replacement or forces file-content and ledger storage to have the same lifetime and backend.

The existing `RecordRead` and `RecordedVersion` signatures also cannot distinguish a normal missing entry from unavailable or corrupt storage. Treating those failures as absence is safe for mutation but hides the storage fault; treating them as success would be fail-open. A durable capability therefore needs context and explicit errors.

## Decision

Define an error-bearing, session-bound read-ledger capability in `engine/tool`. A Workspace composes its file-content operations with one selected ledger and continues to present the combined capability to file tools; the ledger implementation and file-content implementation may be selected independently.

Ledger operations accept context and distinguish three outcomes:

1. a valid recorded `FileVersion`;
2. no entry for the normalized path; and
3. a storage, decode, or corruption error.

The ledger stores the exact opaque token supplied by the corresponding `ReadVersion`. Workspace adapters continue to own path interpretation and apply the existing I/O-free `LedgerKey` normalization before storage. Ledger implementations never inspect file contents or resolve physical aliases.

The default constructors retain a fresh in-memory ledger, preserving the existing behavior for deployments that select no durable storage. A reusable engine conformance suite defines exact-token round-trip, session isolation, absence, concurrent access, and error behavior. A Redis implementation in the root adapter layer is the first non-memory proof: it is bound to one session scope, uses a versioned validated representation, and borrows the existing Redis client's lifecycle. Its physical addressing is injective across `(session, normalized path)` pairs — path bytes are not ambiguously concatenated with the session identifier; a per-session Redis hash with normalized paths as fields is the preferred existing-store pattern. It does not read or write file contents and is not wired as a production default by this decision.

A durable ledger exposes lifecycle cleanup to its composition owner. Removing a session's Redis ledger scope removes all of that session's evidence, so reopening or reusing the same session ID cannot inherit a deleted session's prior-read authorization. This is correctness cleanup, not an age-based retention policy; TTL and time-based pruning remain deferred.

File tools fail closed:

- a failed Read evidence write is reported and establishes no prior read;
- an unavailable or corrupt lookup refuses Edit and existing-file Write before mutation;
- an absent entry preserves the ordinary read-before-mutate refusal;
- stale evidence preserves the changed-since-read refusal; and
- `ReplaceFile` remains the final concurrency guard.

New-file Write remains create-only and does not require prior-read evidence. After a successful create or replace, the tool records the returned new version. If that post-mutation ledger write fails, the content mutation is not rolled back or described as untouched: the tool reports that mutation succeeded but evidence persistence failed, and a later existing-file mutation requires another successful Read. No distributed transaction is introduced between independently selected stores.

This decision does not change filesystem content scoping, Environment identity, Bash, sandboxing, or fork/merge semantics.

## Consequences

**Benefits:**

- Ledger durability can be selected independently from file-content storage.
- Two sessions sharing one filesystem can retain isolated read evidence.
- A durable implementation can reopen across runs, process replacements, and replicas.
- Absence is distinguishable from outage or corruption, so file tools fail closed without hiding the cause.
- ADR 0208's opaque-version, lexical-key, create-only, stale-read, and final-CAS guarantees remain intact.

**Costs and limits:**

- The exported Workspace ledger methods change to carry context and errors; engine API baselines and the changelog must record the intentional compatibility impact.
- Every Workspace implementation and fake must migrate to the error-bearing seam, even when it uses the in-memory default.
- Independently stored content and evidence cannot be updated atomically without a distributed transaction. A post-mutation ledger failure therefore leaves truthful changed content but no reusable evidence.
- A durable key schema needs explicit versioning, corruption handling, lifecycle ownership, and later retention decisions. Session deletion clears authorization evidence, but without an age-based policy abandoned non-deleted session scopes can still grow Redis usage until production lifecycle work chooses a retention policy.
- Redis is a contract proof in this decision, not production mecak8s filesystem wiring; that remains stacklok/mecatl#889.

## See also

- [ADR 0208 — Execution environments and version-aware file mutation](./0208-execution-environment.md)
- [ADR 0211 — Execution-environment runtime seam](./0211-execution-environment-runtime-seam.md)
- [ADR 0214 — Persist EnvironmentRef and reattach remote environments](./0214-environment-persistence.md)
- [ADR 0036 — Engine module boundary](./0036-engine-module.md)
- [ADR 0048 — mecak8s](./0048-mecak8s.md)
- [ADR 0233 — Secure external Redis](./0233-secure-external-redis.md)
- [Architecture — ports and adapter boundaries](../architecture.md)
- [Implementation notes](../design/IMPLEMENTATION-NOTES.md)
- [Acceptance plan](../acceptance/persistent-read-before-write-ledgers.md)
