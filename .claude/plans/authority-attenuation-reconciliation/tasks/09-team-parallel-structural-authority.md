---
id: 09-team-parallel-structural-authority
title: Preflight Parallel and Team authority plus direct-Team profile
blocked_by: [07-delegation-preflight, 08-managed-team-propagation]
status: in-progress
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Apply the common pure preflight before Parallel routing/factory/fork/registry work and before every Team member route/factory/workspace acquisition. The Team lead, members, and synthesis inherit the attenuated parent bound. Direct server-created teams are process-bound and receive only one explicitly named structural coordination tool set, never workspace, shell, network, provider, MCP, Subagent, or Parallel capabilities. Prove order and negative capabilities through the real server/Team path.

## Acceptance criteria

- AC6.1: All Subagent variants retain their non-widening bound.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario6_SubagentVariantsCannotWiden`
- AC6.2: Parallel and Team lead/member/synthesis cannot widen and acquire no runtime resources when denied.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario6_ParallelAndTeamCannotWiden`
- AC6.3: Direct teams have only structural coordination authority and are non-resumable.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario6_DirectTeamsHaveOnlyStructuralCoordinationAuthorityAndAreNotResumable`
