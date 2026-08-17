---
id: 10-vertical-proof
title: Authority completion gates
blocked_by: [06-root-authority-snapshot, 07-delegation-preflight, 08-managed-team-propagation, 09-team-parallel-structural-authority]
status: done
branch: plan-authority-attenuation-reconciliation/10-vertical-proof
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

This is a **completion gate**, not a second implementation or end-to-end recreation of every delegation path. The authoritative focused proofs already live with their owning seams:

- snapshot and event provenance: `engine/adapter/sessnap` and `engine/adapter/eventsource`;
- ownership-before-parsing: `internal/adapter/server/authority_bound_test.go`;
- Subagent, Parallel, Team, managed-definition, and resume attenuation: `engine/agent/authority_delegation_test.go` and their composition tests.

Run the named AC proof suite plus the plan gates against the accumulator. Fix only a concrete failure that demonstrates a missing acceptance requirement. Do not add a new bespoke server-driven test that duplicates those seams, and do not reopen catalog/delegation design work absent a failing proof. Update living documentation only when such a fix changes documented behavior.

## Acceptance criteria

- AC7.1–AC7.4: The existing named provenance and ownership tests pass from their owning packages.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario7_SnapshotRoundTripPreservesBound`
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario7_EventFoldRespectsExplicitProvenance`
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario7_EventFoldClaimedV1FailsClosed`
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario7_OwnershipPrecedesAuthorityParsing`
- Definition of done: aggregate checks pass without regressing the established offline proofs.
  - verify: `task ac-trace-strict`
