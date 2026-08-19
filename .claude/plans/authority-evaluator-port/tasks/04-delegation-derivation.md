---
id: 04-delegation-derivation
title: Derive authority at all child and resume seams
blocked_by: [03-execution-evaluator]
status: blocked
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: "mis-decomposition: direct server-created teams have no carried parent authority; root minting must precede child derivation, and managed definition tier is not represented"
accumulator: acc/authority-evaluator-port
---

# Task brief

Derive children from the carried parent set before any child runtime resource is
acquired for all Subagent variants, Parallel, Team, and server-created members.
Use only the managed agent-definition tier for a ceiling, derived from tools
minus disallowed tools plus resolved MCP names. Implement request tightening and
resume containment without spending a second hop. Stamp owner and authority
independently at the derivation seam. Do not implement root minting or operator
adapter selection.

## Acceptance criteria

- AC4.1: A parent spawning a child that asks for more than the parent holds yields the intersection, on every seam and every Subagent variant including background, fork, structured-output, and per-call model override.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario4_ChildGetsIntersectionOnEverySeam`
- AC4.2: Derivation completes before any runtime resource is acquired; a refused delegation creates no worktree, engine, environment, runner, or child session.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario4_RefusalAcquiresNoRuntimeResource`
- AC4.3: The definition ceiling is the resolved `Tools` allowlist minus `DisallowedTools`, plus the expanded tool names of the definition's resolved `mcpServers:`, from an operator-managed definition tier only; a project-, user-, or driver-tier definition cannot establish a ceiling, and a lower-tier definition cannot occupy a higher-tier name.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario4_OnlyManagedTierSuppliesACeiling`
- AC4.4: A per-call request may only tighten; a call asking for a capability, delegate, or execution posture outside the derived set is refused with a reason naming which check refused it.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario4_CallTighteningCannotWiden`
- AC4.5: The child's owner and its capability set are stamped at the same seam and neither is inferred from the other.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario4_OwnerAndSetAreIndependentlyStamped`
- AC5.1: A resumed child whose persisted set is not contained by the caller's current set is refused; a child persisted before this feature is refused rather than upgraded.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario5_ResumedChildCannotExceedCurrentParent`
- AC5.2: A resume consumes no additional delegation hop and does not re-derive against the definition ceiling.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario5_ResumeSpendsNoAdditionalHop`
- AC5.3: The property holds across a process restart, on both the snapshot path and the event-fold path.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario5_NoWideningAcrossRestart`
