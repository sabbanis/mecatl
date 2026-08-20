---
id: 01-project-domain-store-sources
title: Project domain, source registry, and durable-store foundation
blocked_by: []
status: pending
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Implement only the dependency-safe foundation for the combined Project release: backend-neutral Project document, name/revision/value validation, Project-store and immutable source-registry seams, in-memory reference adapter, durable local `--store-dir` adapter, local canonical-root source adapter, and shared conformance tests. The Project-store and registry contracts must remain above the loop and must not mention files, locks, Redis, Kubernetes, mounts, or the local digest. Do not advertise capability, expose Project CRUD/source discovery transport, or create Project Sessions in this task: those require the combined lifecycle task below. Preserve future Redis/cross-replica adapters, a replica-stable source identity, and a complete shared/remote Environment resolver without redesign. Add narrowly scoped foundation tests; do not claim any numbered acceptance criterion is complete until the integrated lifecycle task.

## Acceptance criteria

None independently. This foundation is required by the combined AC1/AC2 lifecycle task so ADR-0230's no-partial-release rule remains enforceable.
