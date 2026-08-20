---
id: 05a-project-store-ownership
title: Owner-aware atomic Project-store operations
blocked_by: [04-project-contract-wiring]
status: in-progress
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Replace ID-only Project-store reads and mutations with an ownership-scoped backend-neutral contract. Load, Replace, and Delete must apply the caller owner under the same backend lock/CAS boundary and return the same typed absence for missing and foreign records. Preserve the ownerless compatibility posture. Update the memory and durable local adapters plus conformance suite; the service must stop loading a document before checking ownership. Do not change public transport shapes. This task is a prerequisite for AC1.4 and is not allowed to paper over the leak in the service layer.

## Acceptance criteria

Foundation only. It enables AC1.4's owner-before-lookup behavior, proved by task 05.
