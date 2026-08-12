---
id: 01-authority-domain
title: Authority value and durable session bound
blocked_by: []
status: in-progress
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation
---
# Task brief
Implement `governance.Authority`, canonical serialization/validation/intersection, and the session/snapshot bound. Preserve compatibility roots and explicitly label legacy snapshots. Update the intentional engine API surface/changelog.

## Acceptance criteria
- AC1.2 — Fail-closed value algebra. verify: `TestGovernanceAuthorityCanonicalizationAndIntersection`
- AC1.3 — Compatibility and legacy semantics. verify: `TestAuthorityAttenuation_LegacySnapshotIsExplicitlyCompatibilityOnly`; `TestAuthorityAttenuation_NewChildPersistsBoundBeforeExecution`
- AC1.5 — Terminal recovery. verify: `TestAuthorityAttenuation_RootAuthoritySurvivesTerminalRecovery`
