---
id: 09-mecatui-projects-acceptance
title: Mecatui path-free Projects UI and real-client acceptance journey
blocked_by: [08-project-contract-transport-docs]
status: in-progress
branch: ""
worktree: ""
issue: "620"
retries: 0
last_error: ""
accumulator: acc/project-working-mvp
---

# Task brief

Implement the complete local `/projects` mecatui acceptance surface over the generated Project contract. Keep all protobuf contact in `cmd/mecatui/client`; UI must remain proto- and internal-package-free. Implement capability gating, source-backed create, independently paged detail/session navigation, active-session adoption/continuation, revision-conflict recovery, confirmed non-cascading delete, accessible width-safe control-safe keyboard states, stable goldens, and the offline real client/server teatest journey. Document the local `mecated --store-dir` and `/projects` manual workflow in `docs/tui.md` and `docs/usage.md` plus public user documentation as appropriate. Do not expose or derive any path, workspace, profile, EnvironmentRef, or backend locator.

## Acceptance criteria

- AC6.1: mecatui discovers the standalone server capability and exposes `/projects` only when `projects=true`; an older, unimplemented, or Project-disabled server leaves ordinary chat usable and provides no misleading Project affordance.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiCapabilityGate`
- AC6.2: `cmd/mecatui/client` owns all generated-protobuf contact and maps Project/source/page/conflict responses into plain client types; `cmd/mecatui/ui` imports no generated proto or server/internal package.
  - verify: `TestInvariant_mecatui_projects_keep_proto_boundary`
- AC6.3: the create flow lists only server-advertised working sources and submits a name plus opaque SourceRef; it never asks for, derives, stores, or sends a filesystem path, workspace, profile, EnvironmentRef, or backend locator.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiCreatePathFree`
- AC6.4: opening a Project lazily loads that Project's filtered Session pages; the operator can create a Project Session and adopt it through the existing active-Session lifecycle, or continue an eligible existing Session without duplicating conversation/session state machinery.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiProjectSessions`
- AC6.5: rename/replace sends the displayed revision. An `ABORTED` conflict never overwrites or automatically retries; the UI preserves the operator's input and offers explicit Reload and Back actions before another mutation.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiConflictRecovery`
- AC6.6: delete requires explicit confirmation and the displayed revision. Success removes the Project view but does not claim its Sessions were deleted; those Sessions remain reachable from ordinary Session history.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiDeleteNonCascading`
- AC6.7: list, empty, loading, detail, create, edit, conflict, delete-confirmation, unsupported, and error states are keyboard-operable, width-safe, control-character-safe, and covered by stable View goldens; an action-loading state prevents duplicate mutations.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiViewStates`
- AC6.8: one offline in-process gRPC/teatest journey over the real mecatui client and server composition proves capability discovery, Project create/list/open/rename/conflict, Project Session create/continue, filtered navigation, and non-cascading delete; `docs/tui.md` and `docs/usage.md` give the copy-paste local `--store-dir` workflow used for manual acceptance.
  - verify: `TestProjectWorkingMVP_Scenario6_MecatuiEndToEnd`
