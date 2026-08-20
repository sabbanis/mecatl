---
id: 02-project-session-creation
title: Combined Project lifecycle, capability, transport, and captured Session creation
blocked_by: [01-project-domain-store-sources]
status: in-progress
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Land the first complete Project release over task 01's foundation: server capability/source discovery, Project CRUD transport, and dedicated Project-backed Session creation with an inert durable captured binding. This is deliberately one task because ADR-0234 prohibits a capability-positive or CRUD-only Project release that lacks the Session factory/resolver and captured binding. Resolve the authorized Project exactly once, then revalidate/resolve one complete Environment; publish registrations only after persistence and roll back every resource on failure. Derive capability from actual wired seams, never backend-name allowlists. Keep Project state above `engine/agent` and `engine/port`; add only the narrow Session binding/projection surface. Correct ADR-0234 rollout so its status promotes only when the combined contract lands. Inventory resources in ADR-0027 and preserve Kubernetes fast-follow seams (Redis CAS/filtering, replica-stable authority identity, complete shared/remote Environment resolver).

## Acceptance criteria

- AC1.1: session-free `GetServerCapabilities` and `GET /v1/capabilities` advertise Projects only when the Project-store, authorized-working-source, and Project-Session factory/resolver seams are all wired. The first implementation satisfies that only for an ownerless `mecated --store-dir` deployment with the canonical source; capability means Build-time configuration, not transient health. Older/unimplemented, in-memory, Redis, driver, mecak8s, and ownership-enforced deployments remain Project-disabled while their ordinary APIs stay usable, without hard-coding those backend names into the capability decision.
  - verify: `TestProjectWorkingMVP_Scenario1_CapabilityBootstrapMatrix`
- AC1.2: bounded source discovery returns only server-minted opaque IDs, bounded labels, and working eligibility. Public responses and model-visible values contain no physical path, URI, endpoint, EnvironmentRef, environment value, or credential; operator diagnostics may name a scrubbed physical failure under ADR-0234 but never credentials.
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
- AC2.1: gRPC `CreateSessionFromProject` and `POST /v1/projects/{project_id}/sessions` accept only Project ID plus mode/limits/provider/model/reasoning choices; their wire shapes contain no workspace, profile, source, EnvironmentRef, path, reference, or carryover selector.
  - verify: `TestInvariant_project_session_creation_has_no_client_environment_selector`
- AC2.2: the successful authorized Project load is the linearization point: creation revalidates that captured revision's source, resolves one complete Environment, and captures one internally consistent binding. A later concurrent Replace/Delete does not invalidate that capture; creation never mixes fields or performs a second mutable-Project read.
  - verify: `TestProjectWorkingMVP_Scenario2_AtomicProjectCapture`
- AC2.3: before returning success, the Session snapshot contains matching owner, Project ID, name at creation, Project revision, working SourceRef, label at creation, exact EnvironmentRef, an explicitly empty internal References list, and the legacy workspace projection required by existing APIs; it registers no reference tools, and no path or backend locator appears in Project provenance.
  - verify: `TestProjectWorkingMVP_Scenario2_DurableCapturedBinding`
- AC2.4: unknown, forged, ineligible, or removed SourceRefs fail closed without redirect or launch-root fallback; Project authorization—not knowledge of a source ID—grants creation access.
  - verify: `TestInvariant_project_source_ref_is_not_authority`
- AC2.5: injected lookup, resolution, engine-build, Session-save, and registration failures leave no persisted Session, engine entry, environment override, runner, closer, or other per-session resource.
  - verify: `TestProjectWorkingMVP_Scenario2_FailureRollback`
- AC2.6: the existing workspace/profile `CreateSession` request and behavior remain compatible and cannot stamp Project provenance.
  - verify: `TestProjectWorkingMVP_Scenario2_LegacyCreateUnchanged`
