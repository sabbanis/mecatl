---
id: 05b-project-session-transaction
title: Project Session factory transaction and rollback
blocked_by: [05a-project-store-ownership]
status: in-progress
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Add a composition-owned Project Session builder/factory transaction. It consumes one authorized captured Project and one resolved complete Environment, builds the per-session engine against that environment, constructs the fully labelled Session, saves it, and only then registers engine/environment resources. On factory, construction, save, or registration failure, close/discard every newly created resource and leave no persisted Session or registry entry. Capability remains false unless this factory, Project store, and authorized source registry are wired. Preserve legacy CreateSession and do not widen the public request shape. This task enables AC1.1 and AC2.5, which task 05 proves end to end.

## Acceptance criteria

Foundation only. It enables AC1.1 and AC2.5's complete capability and rollback behavior, proved by task 05.
