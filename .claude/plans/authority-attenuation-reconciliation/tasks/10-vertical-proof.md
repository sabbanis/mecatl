---
id: 10-vertical-proof
title: Authority vertical proof and completion gates
blocked_by: [06-root-authority-snapshot, 07-delegation-preflight, 08-managed-team-propagation, 09-team-parallel-structural-authority]
status: in-progress
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Drive offline user-like vertical scenarios through real server/session/delegation construction: create a root, rebuild catalog, invoke named and resumed children, Parallel, Team, and direct server teams. Verify capability disclosure and forged dispatch both remain bounded. Reconcile architecture/implementation notes and generated documentation only after the behavior is proven. Triage full-suite failures against origin/main; do not mix the separate learning-settings branch into this authority PR merely to hide a baseline failure.

## Acceptance criteria

- AC7.1: Snapshot round-trip preserves the one enforced bound and provenance.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario7_SnapshotRoundTripPreservesBound`
- AC7.2–AC7.4: Event fold/fork/ownership paths preserve provenance and order ownership before authority parsing.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario7_EventFoldRespectsExplicitProvenance`
- Definition of done: aggregate checks and user-like offline proof pass.
  - verify: `task ac-trace-strict`
