---
id: 03-catalog-environment
title: Authority-constrained catalogs and child environments
blocked_by: [01-authority-domain, 04-managed-definitions]
status: done
branch: plan-authority-attenuation-reconciliation/03-catalog-environment-20260812
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Use the persisted session authority maximum and pure governance authority algebra to constrain root and child catalog disclosure and execution. Derive a child bound from its parent and static call/profile request before acquiring a provider, environment, runner, MCP manager, background slot, or child registry entry. Apply live revocations at every disclosure and dispatch boundary. Keep managed-definition parsing/driver transport and broad delegation variants out of scope.

The current accumulator worktree contains partial root catalog/lookup filtering in `engine/agent/loop.go` and a narrow ExtraTools proof. Reconcile and complete that work rather than discarding it.

## Acceptance criteria

- AC2.1: A rebuilt or rehydrated bound session exposes only `current composed catalog ∩ persisted maximum ∩ live revocations`; a newly published or learned tool is absent unless it was in the original maximum.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario2_RebuildCannotGrantNewTool`
- AC2.2: A live operator revocation is rechecked before capability disclosure, ToolSearch hydration, and dispatch. It denies a queued/unstarted delegated call and removes the capability from a rebuilt catalog, but does not claim to cancel a tool already executing; it never replaces the persisted maximum with the transient narrowed value.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario2_LiveRevocationRecheckedBeforeDispatch`
- AC3.1: A child request may use pure configuration resolution to identify a definition, provider/model selector, and static profile, but no provider, environment, command runner, MCP manager, background slot, or child registry entry is acquired until the final authority is derived.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_DerivesBeforeRuntimeAcquisition`
- AC3.2: A no-fs or shell-less selected environment cannot acquire filesystem or Bash capability through a child argument, model override, resume, or catalog rebuild.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_EnvironmentPostureCannotWiden`
- AC3.3: A read-only call persists direct-write disabled, so a later resume cannot turn that child into a direct-write child; `fork:true` copies conversation history and is not treated as execution isolation.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_ReadOnlyChildCannotResumeWritable`
- AC3.4: A persisted `EnvironmentRef` mismatch or incompatible authority profile is rejected before `EnvironmentResolver` or an environment forker acquires the resource.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario3_RejectsEnvironmentMismatchBeforeResolve`
- AC4.1: A child maximum equals parent maximum ∩ managed definition ceiling ∩ call execution tightening; a definition, model, profile, or requested tool cannot add a capability absent from the parent.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_ChildIsMonotonicIntersection`
- AC4.2: An excluded or unrecognized capability is absent from advertised specs, lookup, dispatch, and progressive ToolSearch hydration; a stale or forged excluded call receives an authority denial before ordinary permission policy could allow it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_ExcludedOrUnknownToolCannotBeDisclosedOrDispatched`
- AC4.3: A child cannot select a definition outside its admitted identities or exceed the remaining delegation depth.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_DefinitionAndDepthCannotWiden`
- AC4.4: Run-scoped protocol tools are available only when their exact name is authorized; an arbitrary `ExtraTools` entry cannot bypass the maximum.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario4_ExtraToolsRequireExactAuthorization`
