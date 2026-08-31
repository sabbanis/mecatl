---
id: 12-mecatui-enrollment-controls-and-multi-backend-vertical
title: Mecatui workspace enrollment and multi-backend vertical
blocked_by: [11-bundled-enrollment-authenticated-discovery]
status: done
branch: "plan-session-vmcp-authorization/12-mecatui-enrollment-controls-and-multi-backend-vertical"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

Expose one client-visible **Connect workspace services** flow, safe bundled progress, and bundle-wide retry/cancel states; do not expose independent per-backend controls. Prompt input remains unavailable until the frozen catalogue is admitted. Its deterministic two-protected-backend vertical must exercise ToolHive's real ordered bundled chain and provider-scoped `QueryCapabilities` path, not a hand-built multi-backend grant fixture, then execute one safe tool from each backend only after complete admission. Task 09 Mode B depends on this task; its future GitHub run is a one-provider Scenario 11 qualification, while the already-recorded run predates Scenario 11 and is not evidence that bundled enrollment passed.

- AC11.12: Mecatui renders workspace enrollment separately from permission approval, offers no Allow/Always/Deny controls for it, and exposes no OAuth secret, browser URL, callback data, code, state, verifier, token, backend-private provider key, or private user data.
  - verify: `TestInvariant_mecatui_workspace_enrollment_is_not_permission_approval`
- AC11.13: In a deterministic two-protected-backend vertical on one process/replica, the real ToolHive bundled chain completes in configured order, provider-scoped `QueryCapabilities` discovers both candidates, the complete catalogue freezes, and one safe tool from each backend executes only afterward.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical`
- AC11.14: Prompt input remains unavailable throughout incomplete enrollment; duplicate, stale, foreign-owner, and independently targeted backend controls fail closed without admitting a partial catalogue or selecting a different backend.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ClientControlsFailClosed`
