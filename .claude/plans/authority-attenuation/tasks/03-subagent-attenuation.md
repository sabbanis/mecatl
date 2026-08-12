---
id: 03-subagent-attenuation
title: Subagent derivation, catalog filtering, and dispatch backstop
blocked_by: [01-authority-domain, 02-root-and-definitions]
status: in-progress
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation
---
# Task brief
Derive authority before child acquisition for all Subagent variants. Filter child catalogs and enforce a dispatch backstop; apply tool, delegate, depth, and immutable-profile intersections.

## Acceptance criteria
- AC2.1 — Child algebra. verify: `TestAuthorityAttenuation_ChildIsThreeWayIntersection`
- AC2.2 — Catalog is capability reduction, not permission grant. verify: `TestAuthorityAttenuation_ExcludedToolIsAbsentAndDispatchDenied`
- AC2.3 — Delegate identity and depth attenuate. verify: `TestAuthorityAttenuation_DelegateAndDepthCannotWiden`
- AC2.4 — Immutable execution constraints attenuate. verify: `TestAuthorityAttenuation_ProfileCannotEscalate`
- AC3.1 — Subagent variants. verify: `TestAuthorityAttenuation_AllSubagentVariantsDeriveBeforeAcquisition`
- AC3.4 — Pre-acquisition proof. verify: `TestAuthorityAttenuation_WideningFailsBeforeResourceAcquisition`
