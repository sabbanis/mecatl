---
id: 02-project-session-creation
title: Project-backed session creation and captured binding
blocked_by: [01-project-domain-store-sources]
status: pending
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Implement the dedicated Project-backed Session creation operation and durable, inert captured Project binding as one release. Resolve a complete environment from an authorized captured Project exactly once; publish registrations only after persistence and roll back every resource on failure. Do not add Project dependencies to the loop or `engine/port`. Extend snapshot/event-source compatibility safely and update the engine API baseline/changelog if exported surface changes.

## Acceptance criteria

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
