---
id: 01-authority-domain
title: Canonical authority bound and snapshot persistence
blocked_by: []
status: done
branch: "plan-authority-attenuation-reconciliation/01-authority-domain-20260812"
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Define the session-owned, versioned canonical authority maximum in the engine domain and persist it through sessnap. Keep it a local capability/profile descriptor only: no paths, credentials, headers, runners, catalog references, or raw identity claims. Preserve the existing distinction between a genuine legacy record (no authority version/bound) and claimed v1 malformed data (fail closed). Do not implement catalog filtering, child derivation, service wiring, event folding, or definition parsing here.

Extend the aggregate through methods rather than public-field mutation. Keep `EnvironmentRef` separate. Add offline, failing-first tests in the domain and sessnap packages. Treat this as a guarded exported core API change: update API snapshots and `engine/CHANGELOG.md` if required by the compatibility gate.

## Acceptance criteria

- AC1.1: newly created bound session persists one canonical authority value, version/provenance, and safe resolved-definition identity before its first runnable state.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_NewRootPersistsCanonicalMaximum`
- AC1.2: the maximum contains canonical capabilities and execution profile only; no sensitive/runtime selection data.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_CanonicalValueExcludesSensitiveRuntimeData`
- AC1.3: claimed-v1 missing/invalid bounds fail closed; genuine pre-feature records classify legacy.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_ClaimedV1MissingBoundFailsClosed`
- AC1.4: terminal recovery leaves the bound unchanged.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario1_TerminalRecoveryPreservesMaximum`
- AC7.1: snapshot round-trip preserves authority alongside owner, lineage, EnvironmentRef, and state without a second authority source.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario7_SnapshotRoundTripPreservesBound`
