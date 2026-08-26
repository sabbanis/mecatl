---
id: 06-refresh-custody
title: Broker-only bearer refresh, secrecy, and OAuth capability boundary
blocked_by: [05-callback-execution]
status: done
branch: "plan-session-vmcp-broker/06"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Implement session-local broker transport renewal and all custody protections. A terminal downstream refresh failure must remove the unusable private grant so the next `Connect` returns `AuthorizationRequired`, never stale `Connected`. Refresh must also handle bearer expiry after an MCP transport is already established: close/reconnect the protected session-local transport as needed, refresh privately, and retry without a browser flow. Concurrent renewal cannot restore removed state. Prove the real embedded ToolHive refresh path in addition to tight unit tests; do not treat a standalone fake endpoint plus internal grant injection as sufficient. Audit returned errors, injected diagnostics, tool/session/event projections, browser responses, and outbound metadata for every listed secret canary with actual captures; use injected diagnostics only. Reject a second OAuth backend before a second auth lineage or upstream request, while preserving anonymous backends.

## Acceptance criteria

- AC3.1: A session-local broker transport refreshes an expired short-lived downstream bearer internally and the next protected MCP call succeeds without a new browser flow.
  - verify: `TestSessionVMCPBroker_Scenario3_RefreshesTransportInternally`
- AC3.2: Concurrent expired transport requests coalesce safely and a late refresh cannot restore state after session forget, disconnect, or Runtime close.
  - verify: `TestSessionVMCPBroker_Scenario3_RefreshCannotResurrectState`
- AC3.3: Distinct canaries for upstream/downstream access and refresh values, OAuth client secret, authorization code, PKCE verifier, callback state, `tsid`, and storage/signing keys are absent from captured returned errors, injected diagnostics, browser responses, tool metadata/results, session snapshots, event data, and outbound request metadata. Broker operational messages use the injected diagnostics seam rather than package-global slog.
  - verify: `TestInvariant_vmcp_broker_secrets_do_not_escape`; `TestSessionVMCPBroker_Scenario3_UsesInjectedDiagnostics`
- AC3.4: Selecting a second OAuth backend fails with a typed unsupported-capability error before creating another auth-session lineage or contacting that upstream; configured anonymous backends remain usable.
  - verify: `TestSessionVMCPBroker_Scenario3_SecondOAuthBackendUnsupported`
