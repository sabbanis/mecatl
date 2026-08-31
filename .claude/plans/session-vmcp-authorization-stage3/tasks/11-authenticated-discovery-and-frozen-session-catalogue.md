---
id: 11-authenticated-discovery-and-frozen-session-catalogue
title: Authenticated discovery and frozen session catalogue
blocked_by: [10-bundled-workspace-enrollment-domain-and-toolhive-chain]
status: in-progress
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

After successful bundled enrollment, perform authenticated `initialize`/`tools/list` for every protected backend, validate safe definitions, reject malformed results and collisions, and build one frozen session-local catalogue before the first prompt. Never expose partial tools or refresh/write a running catalogue. Static protected `tools:` remains an optional curated compatibility fallback; a bootstrap-discovery CLI is deferred.

- AC11.4: After every protected backend connects, authenticated `initialize` and `tools/list` use each backend's matching transport; validated definitions form one frozen session-local catalogue before prompting, with no within-session refresh or mutation.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AuthenticatedDiscovery`
- AC11.5: A collision, duplicate tool, malformed discovery result, or one backend failure rejects the complete protected catalogue and admits no visible or executable subset.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_DiscoveryFailsClosed`
- AC11.6: Restart requires fresh bundled enrollment and never replays a prior grant, catalogue, or executable protected route.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_RestartRequiresEnrollment`
