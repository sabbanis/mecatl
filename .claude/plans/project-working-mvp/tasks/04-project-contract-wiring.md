---
id: 04-project-contract-wiring
title: Project protobuf, gRPC, HTTP, and client-contract wiring
blocked_by: [03-project-service-composition]
status: done
branch: "plan-project-working-mvp/04-project-contract-wiring"
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Add the generated Project API contract and transport mapping over the completed service methods: standalone capabilities, locator-free source discovery, CRUD, and dedicated Session-from-Project creation. Regenerate contracts and preserve legacy CreateSession wire compatibility. Map typed service errors consistently to gRPC and HTTP, repair producer-derived strings at protobuf boundaries, and classify every server facade under ownership enforcement. Keep the API deployment-neutral; the local `--store-dir` composition merely supplies its first eligible adapter set.

## Acceptance criteria

None independently. Task 05 proves the assembled AC1/AC2 public behavior through the named acceptance tests.
