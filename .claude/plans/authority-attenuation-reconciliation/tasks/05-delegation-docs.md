---
id: 05-delegation-docs
title: Delegation propagation and living documentation
blocked_by: [02-root-event-fork, 03-catalog-environment, 04-managed-definitions]
status: done
branch: plan-authority-attenuation-reconciliation/05-delegation-docs-20260812
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Complete authority propagation across every remaining delegation surface: fresh/background/resumed/named/model-overridden/direct-write/fork-history Subagents; Parallel branches; Team-tool lead, member, and synthesis runs; and direct server-created teams. Derive before child construction, preserve monotonicity, and make direct server-created teams process-bound with zero ordinary capability. Update the living architecture and implementation notes only to describe completed behavior, then regenerate documentation once the assembled branch is complete.

The current accumulator worktree contains partial docs that accurately describe only root/run filtering. Reconcile that prose with the completed implementation; do not claim the unimplemented behavior early.

## Acceptance criteria

- AC6.1: Fresh, background, resumed, named, model-overridden, direct-write, and fork-history Subagent paths derive the same non-widening bound before child construction.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario6_SubagentVariantsCannotWiden`
- AC6.2: Parallel branches and Team-tool lead/member/synthesis runs derive from their parent maximum and cannot disclose or execute excluded tools.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario6_ParallelAndTeamCannotWiden`
- AC6.3: Direct server-created teams are explicitly process-bound and start with a zero-capability maximum: their live lead/member/synthesis catalogs neither disclose nor execute ordinary tools. A restart does not re-snapshot authority or resume them with the current catalog.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario6_DirectTeamsHaveZeroCapabilitiesAndAreNotResumable`
