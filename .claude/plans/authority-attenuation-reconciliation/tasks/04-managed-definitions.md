---
id: 04-managed-definitions
title: Managed local definition ceilings and driver transport
blocked_by: [01-authority-domain]
status: done
branch: plan-authority-attenuation-reconciliation/04-managed-definitions-20260812
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Preserve and validate an optional `authority:` ceiling through local agent-definition discovery and the agent-definition driver transport. Only an operator-managed local definition may establish a ceiling; remote driver definitions remain `driver` provenance and cannot be promoted by project trust. Preserve the semantic difference between absent, present-empty, malformed, and valid data. Persist only a safe resolved definition tier/name identity, never a path or secret-shaped field. Do not implement the child runtime intersection itself in this task.

The current accumulator worktree contains partial discovery, proto, generated-code, and grpc-driver changes. Reconcile and complete them rather than discarding them.

## Acceptance criteria

- AC5.1: A local operator-managed definition can narrow a named child, and the resolved definition identity is persisted as safe tier/name data rather than a path or secret-shaped field.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_ManagedLocalDefinitionNarrowsChild`
- AC5.2: Missing, present-empty, malformed, and valid `authority:` frontmatter remain distinct through discovery and source transport; malformed managed input does not silently become unrestricted.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_DefinitionCeilingPresenceIsPreserved`
- AC5.3: An ordinary remote driver definition retains `driver` provenance and its authority field cannot establish a managed ceiling; no project-trust setting promotes it.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_RemoteDriverCannotBecomeManaged`
- AC5.4: The optional agent-definition driver protocol field round-trips only the declared ceiling data.
  - verify: `TestADR_0224_AuthorityAttenuation_Scenario5_DriverCeilingRoundTrips`
