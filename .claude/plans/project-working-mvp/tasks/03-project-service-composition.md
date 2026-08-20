---
id: 03-project-service-composition
title: Project service, ownership, source resolution, and capability composition
blocked_by: [02-project-session-creation]
status: done
branch: "plan-project-working-mvp/03-project-service-composition"
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Implement the server/composition control plane over the existing Project store, source registry, and captured-binding foundation: ownership-first Project lifecycle service methods, source authorization/resolution, seam-derived capability decision, create rollback ownership, and the ownerless local `mecated --store-dir` wiring. Do not add public protobuf or HTTP endpoints yet; keep the capability false until the complete factory/resolver and transport task is assembled. Inventory long-lived resources in ADR-0027. Preserve the Kubernetes fast-follow seams without adding a mecak8s deployment.

## Acceptance criteria

None independently. The public AC1/AC2 behaviors are completed and pinned only by task 05 after contract wiring.
