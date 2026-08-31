---
id: 10-bundled-workspace-enrollment-domain-and-toolhive-chain
title: Bundled protected workspace enrollment
blocked_by: [08-command-root-https-vertical-and-documentation]
status: done
branch: "plan-session-vmcp-authorization/10-bundled-workspace-enrollment-domain-and-toolhive-chain"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

Implement ADR 0248's client-owned pre-prompt enrollment lifecycle. Multiple configured OAuth backends enter one deterministic ToolHive consent chain; all must connect before protected discovery starts. This is not permission approval: do not reuse `PendingMCPAuthorization` or `StateAuthorizing`, and create no model-selected `ToolCall`. Persist only safe owner/backend/status correlation; denial, failure, bundle-wide cancellation, expiry, restart, and process loss admit no partial bundle. Independent per-backend connect/retry/cancel is out of scope. Keep one process/replica.

- AC11.1: Before the first tool-enabled prompt, only the authenticated session owner can start the single Connect workspace services operation; it is neither permission approval nor a model-callable tool and creates neither `PendingMCPAuthorization` nor `StateAuthorizing`.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ConnectRequiresOwner`
- AC11.2: Protected providers are presented in stable configured order, discovery waits for all of them, and denial, bundle-wide cancellation, expiry, restart, process loss, or any backend failure leaves no protected catalogue or executable route.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AllOrNothing`
- AC11.3: Anonymous backend discovery remains eager and unchanged; no independent per-backend enrollment control is exposed.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AnonymousCompatibility`
