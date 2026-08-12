---
id: 04-delegation-and-resume
title: Parallel, Team, and persisted child resume attenuation
blocked_by: [03-subagent-attenuation]
status: pending
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation
---
# Task brief
Apply the same bound to Parallel and Team, including direct RunTeam compatibility roots. Resume persisted v1 children from their stored bounds and apply only live narrowing/revocation.

## Acceptance criteria
- AC3.2 — Parallel. verify: `TestAuthorityAttenuation_ParallelBranchesCannotWiden`
- AC3.3 — Team. verify: `TestAuthorityAttenuation_TeamLeadAndMembersCannotWiden`; `TestAuthorityAttenuation_RunTeamDerivesCompatibilityRoot`
- AC4.1 — Restart cannot widen. verify: `TestAuthorityAttenuation_ResumeUsesPersistedChildBound`
- AC4.2 — Live operator tightening wins. verify: `TestAuthorityAttenuation_ResumeAppliesOperatorRevocationOnlyAsNarrowing`
- AC4.3 — Resume arguments cannot upgrade. verify: `TestAuthorityAttenuation_ResumeRequestCannotUpgradeAuthority`
- AC4.4 — Ownership remains separate. verify: `TestAuthorityAttenuation_ForeignResumeRemainsAbsent`
- AC4.5 — Persisted maximum cannot broaden. verify: `TestAuthorityAttenuation_ChildBoundPersistenceIsParentBoundAndMonotonic`; `TestAuthorityAttenuation_LiveRevocationIsNotPersistedAsGrant`
