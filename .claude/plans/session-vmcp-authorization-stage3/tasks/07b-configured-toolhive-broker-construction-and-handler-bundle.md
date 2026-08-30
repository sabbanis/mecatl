---
id: 07b-configured-toolhive-broker-construction-and-handler-bundle
title: Configured ToolHive broker construction and handler bundle
blocked_by: [07-wire-event-log-acp-and-mecatui-surfaces]
status: done
branch: "plan-session-vmcp-authorization/07b-configured-toolhive-broker-construction-and-handler-bundle"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Provide the production, process-owned ToolHive broker construction that Task 08 mounts. Define the minimum operator-only settings and CLI composition inputs for broker-mode ToolHive authserver, storage, route discovery, protected Streamable-HTTP endpoint, callback URL, transaction TTL, and local TLS/test transport. Reuse the canonical MCP authority loader and existing `permconfig` authority boundary; command roots must not parse broker YAML. Validate canonical public callback authority once, deriving browser and redirect URLs only from that value.

Make `app.Build` construct the embedded ToolHive authorization server, storage, discovered private routes, and `vmcpbroker.NewToolHiveStreamingHTTPRuntime` in broker mode. `VMCPBrokerConstructor` remains an explicit test seam, never the only production construction path. Expand `vmcpbroker.HandlerBundle` to own fixed authorization, token, Streamable HTTP vMCP, and exact callback handlers. Keep app API and control routes out of this bundle. Preserve callback input hardening and never reflect secrets.

`app.Built` owns one `Process` and exposes the complete handler bundle. On a build failure, close every partially acquired ToolHive/profile resource. `Built.Close` preserves teardown ordering: session/service, then broker Runtime/authserver, then global profile lifecycle. `app.Build` starts no listener.

Write hermetic config-driven `app.Build` proof using real operator settings and embedded ToolHive components: every fixed handler exists, only expected routes mount, malformed or unsupported broker declarations fail before serving, and public config/result/event projections never reveal credentials, private route IDs, client IDs, tokens, callback codes, verifiers, or browser URLs.

## Acceptance criteria

- AC2.3: `app.Build` returns one owned broker handler bundle; `mecated` and `mecak8s`
  mount its fixed authorization, token, vMCP, and callback routes without overlapping
  health, API, or control routes. Generated browser and redirect URLs use only the
  configured callback URL's canonical origin/path contract.
  - verify: `TestSessionMCPAuthorization_Scenario2_MountsTrustedHandlers`
- AC2.8: Stage 3 command-root construction is the approved expansion beyond the
  handover's minimum prebuilt-Runtime allowance; its local HTTPS test is required, while
  Helm/Kind packaging is not a completion dependency.
  - verify: `TestSessionMCPAuthorization_Scenario2_CommandRootConstructionEnabled`
- AC10.1: A hermetic aggregate test uses the real resolver/loader, `app.Build`, embedded
  ToolHive authserver/vMCP, local OAuth fixture, actual Streamable HTTP MCP server,
  scripted model, wire controls, and safe event projections to prove pending -> live
  presentation -> callback -> recheck -> exactly one protected request -> ordinary model
  completion.
  - verify: `TestSessionMCPAuthorization_Scenario10_ConfigDrivenVertical`
