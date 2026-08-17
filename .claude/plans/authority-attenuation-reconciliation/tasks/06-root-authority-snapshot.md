---
id: 06-root-authority-snapshot
title: Creation-time root authority snapshot
blocked_by: []
status: pending
branch: ""
worktree: ""
issue: "371"
retries: 0
last_error: ""
accumulator: acc/authority-attenuation-reconciliation
---

# Task brief

Replace the server's unrestricted v1 root binding with a restricted canonical authority derived in composition from the exact assembled catalog and static environment posture used for that newly created session. Bind it before first persistence or runnable registration. The server must consume the prepared value, never inspect catalog/runtime resources. Preserve explicit legacy behavior only for pre-feature records; a v1 root must not be unrestricted.

Do not rename the existing inert caller-identity `Session.Authority` label merely because it shares terminology. Instead make the capability bound the sole enforcement/persistence source and ensure restoration is write-once in both bound and legacy branches.

## Acceptance criteria

- AC1.1: A newly created bound session persists one canonical authority value before its first runnable state.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario1_NewRootPersistsCanonicalMaximum`
- AC1.2: The root maximum contains canonical capability names and a static execution profile only.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario1_CanonicalValueExcludesSensitiveRuntimeData`
- AC2.1: A later rebuilt catalog cannot add a capability absent from the creation-time maximum.
  - verify: `TestADR_0226_AuthorityAttenuation_Scenario2_RebuildCannotGrantNewTool`
