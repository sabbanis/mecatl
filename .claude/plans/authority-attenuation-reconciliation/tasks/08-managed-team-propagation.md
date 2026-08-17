---
id: 08-managed-team-propagation
title: Managed definition identity and Team ceiling propagation
blocked_by: [07-delegation-preflight]
status: pending
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Carry only trusted operator-managed local definition ceiling and safe tier/name identity through pure Subagent and Team profile resolution. Intersect parent, managed ceiling, and requested static posture before runtime construction, then persist the safe identity on the child/member binding. Driver/project definitions may retain transport data but never establish a managed ceiling. Do not pass paths, origin details, or secret-shaped fields into the binding.

## Acceptance criteria

- AC4.1: A child is the monotonic parent ∩ managed-definition ∩ call-posture intersection.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario4_ChildIsMonotonicIntersection`
- AC5.1: A managed local definition narrows a named child and persists safe identity.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario5_ManagedLocalDefinitionNarrowsChild`
- AC5.2: Missing, empty, malformed, and valid ceilings remain distinct and malformed managed input fails closed.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario5_DefinitionCeilingPresenceIsPreserved`
- AC5.3: Remote drivers cannot become managed.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario5_RemoteDriverCannotBecomeManaged`
