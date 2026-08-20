---
id: 01-project-domain-store-sources
title: Project domain, source registry, durable store, and discovery APIs
blocked_by: []
status: blocked
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: "mis-decomposition: AC1.1 requires the task-02 Project Session factory/captured binding; ADR-0230 requires them in one release, and generated contract work overlaps task 05"
accumulator: acc/project-working-mvp
---

# Task brief

Implement the backend-neutral Project document, source-registry and Project-store seams, local canonical-root adapter, server capability/source discovery and Project CRUD transport. Keep Project state above the agent loop. Correct ADR-0230 rollout before implementation so captured bindings and Project-session creation are one release; update its status only when the combined contract lands. The shared seams must not mention files, locks, Redis, Kubernetes, mounts, or the local digest. Implement the ownerless local `mecated --store-dir` posture only; derive capability from actual seams, not backend names. Add shared conformance suites and durable local failure/reopen proofs. Inventory long-lived resources in ADR-0027 and document public behavior. Preserve Kubernetes fast-follow: public API, seams, binding, and capability decision must accept Redis/cross-replica adapters without redesign.

## Acceptance criteria

- AC1.1: session-free `GetServerCapabilities` and `GET /v1/capabilities` advertise Projects only when the Project-store, authorized-working-source, and Project-Session factory/resolver seams are all wired. The first implementation satisfies that only for an ownerless `mecated --store-dir` deployment with the canonical source; capability means Build-time configuration, not transient health. Older/unimplemented, in-memory, Redis, driver, mecak8s, and ownership-enforced deployments remain Project-disabled while their ordinary APIs stay usable, without hard-coding those backend names into the capability decision.
  - verify: `TestProjectWorkingMVP_Scenario1_CapabilityBootstrapMatrix`
- AC1.2: bounded source discovery returns only server-minted opaque IDs, bounded labels, and working eligibility. Public responses and model-visible values contain no physical path, URI, endpoint, EnvironmentRef, environment value, or credential; operator diagnostics may name a scrubbed physical failure under ADR-0230 but never credentials.
  - verify: `TestInvariant_project_source_discovery_is_locator_free`
- AC1.3: Create derives Owner from context and the working label from the registry, rejects invalid names and unknown/non-working source IDs, starts at revision 1, and permits multiple ownerless Projects to use the same canonical source; the endpoint is unavailable rather than sharing that writable source when ownership enforcement is active.
  - verify: `TestProjectWorkingMVP_Scenario1_CreateValidatedServerOwnedFields`
- AC1.4: Get, List, Replace, and Delete apply ownership before lookup, cursor formation, and counts; a foreign ID is absence-shaped and no-auth deployments retain one ownerless trusted domain.
  - verify: `TestInvariant_project_access_is_caller_separated`
- AC1.5: Replace is a whole-document CAS; two concurrent replacements at one revision yield exactly one success, one `ABORTED`/`409`, one revision increment, and no field from the losing write.
  - verify: `TestProjectWorkingMVP_Scenario1_ReplaceCAS`
- AC1.6: Delete requires the current revision, stale Delete changes nothing, and successful Delete removes only the Project document—not its registered source or Sessions.
  - verify: `TestProjectWorkingMVP_Scenario1_DeleteCASNonCascading`
- AC1.7: owner-filtered Project pages are bounded and deterministically keyset-ordered, return an opaque cursor, and compute count from the filtered set before page formation. Concurrent mutation is explicitly weakly consistent: each response is correct at query time, while a moved row may repeat or be skipped across requests.
  - verify: `TestProjectWorkingMVP_Scenario1_BoundedProjectPagination`
- AC1.8: the in-memory and durable local adapters pass one shared Project-store conformance suite for create-only, load, store-level CAS replace/delete, ownership queries, pagination, and cancellation. Durable-adapter-only proofs additionally cover cross-process contention, interrupted atomic writes, corrupt/truncated records, and reopen durability.
  - verify: `TestProjectWorkingMVP_Scenario1_ProjectStoreConformance`
