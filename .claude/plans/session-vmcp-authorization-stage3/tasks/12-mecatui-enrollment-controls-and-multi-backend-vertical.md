---
id: 12-mecatui-enrollment-controls-and-multi-backend-vertical
title: Mecatui workspace enrollment and multi-backend vertical
blocked_by: [11-authenticated-discovery-and-frozen-session-catalogue]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

Expose one client-visible **Connect workspace services** flow, safe bundled progress, and bundle-wide retry/cancel states; do not expose independent per-backend controls. Prompt input remains unavailable until the frozen catalogue is admitted. Prove two protected fixture backends complete the ordered bundled consent and execute only after discovery. Update Task 09 Mode B to depend on this task; its future live GitHub run is a one-provider Scenario 11 qualification, while the already-recorded run predates Scenario 11 and is not evidence that bundled enrollment passed.

- AC11.7: Mecatui renders bundled workspace enrollment separately from permission approval, offers no Allow/Always/Deny controls, and exposes no OAuth secrets, browser URLs, callback data, codes, states, verifiers, tokens, or private user data.
  - verify: `TestInvariant_mecatui_workspace_enrollment_is_not_permission_approval`
- AC11.8: On one process/replica, a deterministic two-protected-backend vertical completes consent in configured order, discovers and freezes both catalogues, and executes one safe tool from each only after enrollment.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical`
- AC11.9: Prompt input stays disabled while enrollment is incomplete; duplicate, stale, foreign-owner, and independently targeted backend controls fail closed without admitting a partial catalogue.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ClientControlsFailClosed`
