---
id: 02-project-session-creation
title: Captured Project binding and Session persistence foundation
blocked_by: [01-project-domain-store-sources]
status: done
branch: "plan-project-working-mvp/02-project-binding-foundation"
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Add the narrow importable-engine foundation for a captured Project binding: inert Session aggregate data, snapshot/event-source round trip, compact safe provenance projection, and ordinary fork inheritance. Keep Project stores, source registries, lifecycle authorization, and transport out of this task. Preserve legacy snapshots and ordinary Sessions unchanged. This task establishes durable data and extension seams only; it must not advertise Projects or expose a partial Project creation API.

## Acceptance criteria

None independently. AC1–AC3 are asserted only after the service, contract, and lifecycle integration tasks assemble the complete release.
