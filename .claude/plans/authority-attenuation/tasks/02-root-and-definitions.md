---
id: 02-root-and-definitions
title: Compatibility root and operator definition resolution
blocked_by: [01-authority-domain]
status: done
branch: "plan-authority-attenuation/02-root-and-definitions"
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation
---
# Task brief
Compose compatibility-root authority from existing root capability surface, enforce it in root catalog/dispatch, persist safe projections, and add operator-first definition resolution in composition.

## Acceptance criteria
- AC1.1 — Compatibility root snapshot. verify: `TestAuthorityAttenuation_RootSnapshotsExistingCapabilitySurface`
- AC1.4 — Root enforcement and safe durability. verify: `TestAuthorityAttenuation_RootCatalogAndDispatchEnforceCeiling`; `TestAuthorityAttenuation_RootAuthorityRoundTripsWithoutSensitiveMaterial`
- AC5.1 — Operator-first resolution. verify: `TestAuthorityAttenuation_OperatorDefinitionCannotBeShadowed`
- AC5.2 — Collision is visible but safe. verify: `TestAuthorityAttenuation_DefinitionCollisionProducesSafeDiagnostic`
- AC5.3 — One resolved definition feeds both decisions. verify: `TestAuthorityAttenuation_DefinitionResolutionIsSingleSource`
