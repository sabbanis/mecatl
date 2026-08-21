---
id: 07-project-session-navigation
title: Project-filtered Session metadata paging and compact provenance
blocked_by: [06-project-binding-restart-fork]
status: in-progress
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Add exact Project filtering to bounded Session metadata paging after binding persistence exists. Apply owner and Project filters before any storage page, sort, cursor, limit, or count. Extend the metadata-pager, memstore, jsonlstore, Redis, and gRPC-driver compatibility paths where needed; unsupported backends must fail honestly rather than load full snapshots or filter global pages. Maintain the narrow public compact provenance projection only. Preserve the mecak8s fast-follow requirement for Redis metadata filtering across replicas.

## Acceptance criteria

- AC4.1: bounded Session metadata requests accept one optional exact Project ID. A foreign, missing, or deleted live Project filter returns the same NotFound shape before querying Sessions; an authorized live Project applies ownership and Project filtering in the storage query before sort, cursor, limit, and total-count computation.
  - verify: `TestInvariant_project_session_filter_precedes_paging`
- AC4.2: a metadata backend that cannot perform Project-filtered paging reports unsupported; it never loads full Session snapshots or filters an already-formed global page. Scanning bounded compact metadata before forming the filtered page is allowed in v1.
  - verify: `TestProjectWorkingMVP_Scenario4_UnsupportedPagerFailsHonestly`
- AC4.3: compact Session inventory exposes only Project ID, Project name at creation, and working label at creation; the full binding, SourceRef, EnvironmentRef, owner internals, and physical locator remain absent.
  - verify: `TestProjectWorkingMVP_Scenario4_CompactProvenanceProjection`
- AC4.4: Project-filtered conformance places matching rows beyond an unfiltered first page and proves every returned row matches owner/Project, filtered total/count and cursor are correct, no matching row is skipped, and a cursor is bound to its original Project filter. Unassigned legacy Sessions appear only in ordinary inventory.
  - verify: `TestProjectWorkingMVP_Scenario4_FilteredSessionPagerConformance`
- AC4.5: after Project deletion, the Project is absent from Project pages while its captured Sessions remain visible in ordinary Session history with creation-time compact provenance.
  - verify: `TestProjectWorkingMVP_Scenario4_DeletedProjectHistory`
