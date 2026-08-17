---
id: 07-delegation-preflight
title: Pre-acquisition authority and resume posture validation
blocked_by: [06-root-authority-snapshot]
status: done
branch: "plan-authority-attenuation-reconciliation/07-delegation-preflight"
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Create one pure delegation preflight for fresh and resumed Subagents. It derives the final bound and validates the saved child's profile before any router, engine factory, provider, environment resolver/forker, runner, MCP manager, child slot, or registry entry. Ownership and lineage remain checked before authority parsing. A child saved with direct write disabled must reject a writable resume before the writable engine or parent workspace are selected. Validate filesystem/isolation/environment compatibility before acquisition; use counting fakes to prove ordering.

## Acceptance criteria

- AC3.1: Final authority derives before child runtime acquisition.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario3_DerivesBeforeRuntimeAcquisition`
- AC3.2: A child cannot widen no-fs or shell-less posture.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario3_EnvironmentPostureCannotWiden`
- AC3.3: A read-only child cannot resume in read-write mode.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario3_ReadOnlyChildCannotResumeWritable`
- AC3.4: An incompatible environment is rejected before resolver/forker acquisition.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario3_RejectsEnvironmentMismatchBeforeResolve`
