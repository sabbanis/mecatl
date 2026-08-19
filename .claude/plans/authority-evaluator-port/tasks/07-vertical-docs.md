---
id: 07-vertical-docs
title: Prove the vertical slices and document the authority design
blocked_by: [05-composition-root, 06-cedar-adapter]
status: pending
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-evaluator-port
---

# Task brief

Add offline vertical-slice tests through the real app.Build path for the local
and Cedar evaluator paths, including independently injected evaluator failure.
Write accepted ADR-0228 and update the living architecture, implementation
notes, and user-facing documentation for the explicit evaluator selector and
operator policy file. Follow the documentation citation rules; do not cite
salvage-branch-only paths. Update generated docs through Taskfile commands.

## Acceptance criteria

- AC3.5: The three adapters — noop, local, and Cedar — satisfy one shared conformance suite, including identical fail-closed behaviour on a malformed request.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario3_AdaptersSatisfyConformanceSuite`
- AC6.1: A session created through the ordinary composition path can spawn a default read-only subagent, a named managed specialist, a Parallel branch, and a Team, and each child receives a non-empty derived set.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario6_ComposedRootCanDelegateOnEverySeam`
- AC7.2: An operator rule can deny a capability the carried set permits — including confining a definition to a path subtree — and cannot grant one the carried set omits.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario7_OperatorRuleTightensButCannotGrant`
- AC7.5: The adapter is off by default and selected by an explicit flag; a policy set that fails to load is a startup failure, not a silent fallback to permit.
  - verify: `TestADR_0228_AuthorityEvaluator_Scenario7_PolicyLoadFailureIsFatal`
- The final vertical proof exercises the local adapter from ordinary composition through managed-specialist child derivation, denied and allowed dispatch, stale disclosure, meta-tool target authorization, restart/resume narrowing, and evaluator failure.
  - verify: `TestADR_0228_AuthorityEvaluator_VerticalSlice`
- The Cedar vertical proof reruns the shared stack with the shipped policy and an operator path rule.
  - verify: `TestADR_0228_AuthorityEvaluator_VerticalSlice_Cedar`
