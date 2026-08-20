---
id: 06-project-binding-restart-fork
title: Captured Project binding restart, revocation, and fork semantics
blocked_by: [05-project-lifecycle-acceptance]
status: pending
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Implement run-entry validation and reattachment from the Session's captured binding, never a mutable Project lookup. Preserve legacy snapshots and ordinary forks. Ensure registry identity remains opaque and stable for the same authority, while unavailable/different authority fails closed before model execution. Keep Kubernetes fast-follow valid: a future shared/remote resolver must return a complete environment with a stable replica-independent source identity.

## Acceptance criteria

- AC3.1: Project rename or replacement changes only future Session captures. The existing Session's internal aggregate retains the full creation-time binding, while public compact inventory retains only Project ID, Project name at creation, and working label at creation; no public detail surface exposes SourceRef or EnvironmentRef.
  - verify: `TestProjectWorkingMVP_Scenario3_ProjectEditsAreProspective`
- AC3.2: deleting a Project prevents new Project Sessions but does not delete, hide, rebind, rename, or make unusable an existing captured Session.
  - verify: `TestProjectWorkingMVP_Scenario3_ProjectDeletePreservesSessions`
- AC3.3: every Project Session run entry first validates the captured working SourceRef against the rebuilt Project source registry, then reattaches the persisted EnvironmentRef through the ordinary resolver. After a real service rebuild at the same canonical root, the exact compatible EnvironmentRef is restored without deriving a replacement, consulting the mutable/deleted Project document, or silently falling back.
  - verify: `TestInvariant_project_session_restart_uses_captured_binding`
- AC3.4: rebuilding with a different/absent canonical registration changes/removes the deterministic SourceRef, so the captured Session fails with failed precondition before model/tool execution; rebuilding again with the exact original canonical binding restores use without rewriting the snapshot. Same-process source removal is outside the immutable-registry MVP.
  - verify: `TestProjectWorkingMVP_Scenario3_SourceRevocationFailsClosed`
- AC3.5: `ForkSession` inherits the source Session's exact captured Project binding and EnvironmentRef without rereading the current Project, while ordinary non-Project forks remain unchanged.
  - verify: `TestProjectWorkingMVP_Scenario3_ForkInheritsCapturedBinding`
- AC3.6: pre-Project snapshots and event-source metadata decode with empty Project provenance and continue through their existing workspace/environment path.
  - verify: `TestProjectWorkingMVP_Scenario3_LegacySnapshotCompatibility`
