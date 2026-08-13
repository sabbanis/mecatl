---
id: 05-demonstrations-and-docs
title: Offline and deployed authority attenuation journeys
blocked_by: [04-delegation-and-resume]
status: blocked
branch: "plan-authority-attenuation/05-demonstrations-and-docs"
worktree: ""
issue: "371"
retries: 0
last_error: "AC7 requires the caller-separation Dex/OIDC/Redis fixture on acc/caller-separation, which is not an ancestor; no second harness may be created."
accumulator: acc/authority-attenuation
---
# Task brief
Add deterministic offline mecademo proof, Dex/OIDC/Redis kind journey through `task e2e:k8s`, and required architecture/usage/user documentation. Do not use a live LLM or claim external delegated credentials.

## Acceptance criteria
- AC6.1 — Offline journey. verify: `TestMecademoAuthorityAttenuationJourney`
- AC6.2 — Honest projection. verify: `TestAuthorityAttenuation_DemoProjectionIsSafeAndHonest`
- AC7.1 — Deployed collision and spawn. verify: `TestAuthorityAttenuation_DeploymentCollisionAndSpawnJourney` under `task e2e:k8s`
- AC7.2 — Deployed restart/resume. verify: `TestAuthorityAttenuation_DeploymentRestartResumeJourney` under `task e2e:k8s`
- AC7.3 — Boundary honesty. verify: `TestAuthorityAttenuation_DeploymentClaimsAreBounded`
