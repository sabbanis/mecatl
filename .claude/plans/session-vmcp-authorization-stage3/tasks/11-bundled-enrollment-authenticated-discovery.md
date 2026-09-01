---
id: 11-bundled-enrollment-authenticated-discovery
title: Bundled enrollment and authenticated discovery
blocked_by: [10a-toolhive-bundled-upstream-construction-repair]
status: done
branch: "plan-session-vmcp-authorization/11-bundled-enrollment-authenticated-discovery"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

Task 11 has been replanned around ToolHive's provider-scoped capability path. The paused
prototype is preserved locally in stash `task11-paused-prototype-before-10a` as reference for
freeze/admission scaffolding; do not apply or commit it unchanged.

After Task 10a lands, implement the Service/session admission layer. Workspace enrollment is
client-owned and pre-prompt: reject start unless the authenticated caller owns an idle,
unprompted session with no active run, pending enrollment, permission approval, or tool
authorization. It is not permission approval, `StateAuthorizing`, or
`PendingMCPAuthorization`. Start exactly one owner-bound bundled consent operation.

After ToolHive reports the complete chain connected, obtain each backend's valid provider
credential and call provider-scoped authenticated `QueryCapabilities(ctx, backend)` separately
for every backend. Never use `QueryAllCapabilities`. Stage every definition first; validate
tool names, schemas, descriptions, and read-only metadata; collision-check against anonymous,
global, and every bundled candidate; then atomically admit and freeze the complete
session-local catalogue. Prompting remains disabled until admission succeeds.

One failure, denial, bundle-wide cancellation, expiry, terminal refresh failure, restart, or
process loss clears all protected admission state. A terminal refresh failure removes only
the failed provider token internally but requires whole-bundle re-enrollment in v1. Static
`tools:` may supply reviewed definitions, but never permits partial protected admission before
the complete bundle succeeds. Do not add per-backend controls. Keep secrets,
backend-private ToolHive names, tokens, callback material, and raw discovery payloads out of
snapshots, events, diagnostics, and client projections.

If Task 10a does not expose a public ToolHive-backed provider-scoped discovery seam, report
mis-decomposition before committing. Do not replace it with direct `mcp.NewManager`, a static
Authorization header, callback-based ad-hoc discovery, or independent upstream emulation.

- AC11.1: Before the first tool-enabled prompt, only the authenticated session owner can
  start the single **Connect workspace services** operation. The operation is rejected unless
  the session is idle and unprompted with no run, pending enrollment, permission approval, or
  tool authorization; it creates neither `PendingMCPAuthorization` nor `StateAuthorizing`.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ConnectRequiresOwner`
- AC11.2: One owner-bound bundled operation has one terminal outcome. Denial, bundle-wide
  cancellation, expiry, process loss, refresh failure, or failure from any protected backend
  clears all protected admission state and leaves no visible or executable protected route.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AllOrNothing`
- AC11.8: After ToolHive reports the complete chain connected, each protected backend is
  queried separately through provider-scoped authenticated `QueryCapabilities(ctx, backend)`;
  `QueryAllCapabilities` is never used.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AuthenticatedDiscovery`
- AC11.9: Tool name, schema, description, and read-only metadata are validated for every
  candidate; collision or malformed/failing discovery against any protected, anonymous, or
  global tool rejects the complete protected candidate set.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_DiscoveryFailsClosed`
- AC11.10: After process loss or restart, a session exposes no prior protected grant,
  catalogue, or executable route and requires fresh complete bundled enrollment.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_RestartRequiresEnrollment`
- AC11.11: Static protected `tools:` declarations remain accepted operator configuration for
  compatibility/comparison only. They never enter `Process`/`Runtime` catalogue construction;
  the admitted protected name, schema, description, and read-only metadata come solely from
  authenticated provider-scoped discovery after complete bundled consent.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical` and
    `TestBundledWorkspaceEnrollment_Scenario11_AuthenticatedMetadataIsAdmitted`
