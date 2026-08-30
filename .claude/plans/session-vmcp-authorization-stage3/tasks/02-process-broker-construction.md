---
id: 02-process-broker-construction
title: Broker injection, route compilation, and ownership
blocked_by: [01-mcp-authority-configuration]
status: done
branch: "plan-session-vmcp-authorization/02-process-broker-construction"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Implement only the minimum process-composition prerequisite for Stage 3. The canonical `cliconfig.MCPAuthority` broker declarations must reach `app.Build` without YAML reparsing or project configuration reads. Permit a trusted caller to inject one prebuilt process-owned `vmcpbroker.Runtime` and root-internal handler bundle; `app.Built` owns construction rollback and process shutdown. Keep the global and broker authority paths mutually exclusive. Compile fixed private routes from startup discovery and reject an unconfigured discovery result, duplicate tool, unsupported auth mode, failed pre-authorization discovery, and a second protected backend.

Preserve and extend the hermetic callback boundary proof. Do not mount command-root routes, create a listener, derive deployment topology, or invent remote ownership policy. Those requirements are deliberately deferred to task 08 after the session, aggregate, dispatch, and control seams exist. Stage 3 includes in-process construction and a loopback HTTPS command-root proof using existing listeners; production sidecar exposure, ingress/Helm/Kind topology, and external callback deployment remain Stage 5.

## Acceptance criteria

- AC2.1: A real operator settings file flows through `Resolver.OperatorMCP()` and the
  canonical profile loader into one broker construction; no package reparses YAML or
  reads project configuration for broker authority.
  - verify: `TestSessionMCPAuthorization_Scenario2_SettingsConstructBroker`
- AC2.2: Startup discovers every configured backend's stable ToolHive tool definitions,
  compiles private backend routes, and fails before serving on an unconfigured discovery
  result, duplicate tool, unsupported auth mode, second protected backend, or failed
  pre-authorization discovery.
  - verify: `TestSessionMCPAuthorization_Scenario2_CompilesDiscoveredRoutes`
- AC2.4: The callback handler is GET-only and accepts exactly one non-empty decoded
  `code` and one `state`, each at most 8 KiB. Duplicate, missing, unexpected, malformed,
  body-bearing, or oversized input maps to the same generic HTTP 400; success maps to a
  fixed HTTP 200. Every response sets `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer`, performs no redirect, and reflects neither value nor
  browser URLs in responses, diagnostics, traces, metrics, or access-log fields. A browser
  denial without a code remains pending for explicit cancel or expiry.
  - verify: `TestInvariant_mcp_callback_input_is_bounded_and_never_reflected`
- AC2.5: Callback requests carry only broker-created code/state and cannot choose a
  session, owner, backend, MCP endpoint, issuer, client, or scopes.
  - verify: `TestInvariant_mcp_callback_cannot_select_authority`
