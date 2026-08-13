---
id: 05-demonstrations-and-docs
title: Offline and deployed authority attenuation journeys
blocked_by: [04-delegation-and-resume]
status: in-progress
branch: "plan-authority-attenuation/05-demonstrations-and-docs"
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation
---
# Task brief
Add deterministic offline mecademo proof, Dex/OIDC/Redis kind journey through `task e2e:k8s`, and required architecture/usage/user documentation. Do not use a live LLM or claim external delegated credentials.

## Acceptance criteria
- AC6.1 — Offline journey. verify: `TestMecademoAuthorityAttenuationJourney`
- AC6.2 — Honest projection. verify: `TestAuthorityAttenuation_DemoProjectionIsSafeAndHonest`
- AC7.1 — Deployed caller boundary. verify: `task e2e:k8s` caller-separation stories.
- AC7.2 — Deployed durable owner boundary. verify: `task e2e:k8s` owner-survives-replacement story.
- AC7.3 — Boundary honesty. verify: `TestAuthorityAttenuation_DemoProjectionIsSafeAndHonest`.
