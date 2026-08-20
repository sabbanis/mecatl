---
id: 05-project-lifecycle-acceptance
title: Integrated Project lifecycle acceptance and rollback proof
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

Assemble the preceding Project store, captured-binding, service, and contract work into the first complete Project release. Implement any integration gaps and pin all Scenario 1 and Scenario 2 acceptance behavior with the exact named tests in `docs/acceptance/project-working-mvp.md` AC1.1–AC2.6. This is the first task allowed to enable `projects=true` or expose Project CRUD/source discovery/CreateSessionFromProject publicly. Validate Build-time capability wiring, owner-first absence, CAS, local conformance, opaque source authority, atomic Project capture, persistence/rollback, and legacy CreateSession compatibility. Do not split a capability-positive Project API from captured Project Session binding. Do not claim completion unless every referenced test is present and green.

## Acceptance criteria

AC1.1–AC1.8 and AC2.1–AC2.6, quoted verbatim with their `verify:` lines in `docs/acceptance/project-working-mvp.md`; this task owns each of those criteria exactly once after tasks 01–04 establish their implementation seams.
