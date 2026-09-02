# Restart handover — session-scoped vMCP broker

**Target branch:** `acc/session-vmcp-broker`
**Stopped after:** tasks 01–05 were marked `done`; task 06 was left `in-progress`.
**This is a corrective handover.** Do not continue task 06 until the ownership and OAuth-route corrections below are resolved.

## Source-of-truth and scope

The accepted acceptance contract is `docs/acceptance/session-vmcp-broker.md`, with the boundary decision in `docs/adr/0288-session-scoped-vmcp-broker.md`.

`STAGE2-HANDOVER.md` is **not present on the accumulator**. Its last available copy is on `wip/session-vmcp-broker-stage0a-snapshot` at `88710382`. Before changing scope, recover or obtain any newer handover text and reconcile it with this note. The available handover establishes these non-negotiable rules:

- `internal/adapter/vmcpbroker` is root-internal; neither `engine/` nor `engine/port` may gain a ToolHive, OAuth, Kubernetes, or broker API.
- Stage 2 owns a broker runtime, not a second generic/direct MCP OAuth controller.
- ToolHive owns the upstream OAuth protocol and upstream credential store. The broker owns only the downstream client/callback rendezvous and session/backend binding.
- No stdio MCP, no global `MCP_<NAME>_TOKEN`, no global MCP-manager credential lifecycle, and no Ozz `OAuthController`/`LoginMCP` reuse.
- No public wire endpoint or mecatui command is added in this stage. A protected call before explicit connection produces a bounded authorization-required tool result; it neither parks nor replays a run.

### `mecak8s` versus `mecatui`

Keep the roles separate:

- **`mecak8s` / a future broker sidecar composition root** hosts or composes the long-lived broker Runtime. It owns server-side ToolHive/authserver/vMCP lifecycle and never becomes a UI or browser-controller implementation. Stage 2 must be composable there, but does **not** add a binary, sidecar RPC, Helm, Kind, ConfigMap mounting, or production sidecar authentication.
- **`mecatui`** is the eventual interactive client/presenter: it already has/gets the session selection context and will later invoke the private `Connect(sessionID, backendID)` control operation, present the safe browser URL, and obtain a session-local broker client. Stage 2 must make that possible without redesign, but must **not** add the `mecatui mcp connect …` command or a public control protocol.
- Stage 3 changes only the trigger: the first protected tool call drives the unchanged internal `Connect` primitive, parks, lets the client open the browser URL, and resumes that exact call.

Do not put the session ID in `tool.Environment`, model-facing arguments, or global request headers. It travels only through the server/composition session-creation and per-session-engine seam.

## What is safe to salvage

### Stage 0/1 proof inputs

Keep the existing Stage 0/1 proof tests under `internal/adapter/mcp/stage0a/`. They demonstrate the accepted ToolHive authserver/vMCP single-upstream path and deterministic static catalogue shape. Reuse their real ToolHive construction instead of recreating protocol behavior.

### Session-local route and wrapper shape

The following concepts in `internal/adapter/vmcpbroker/` are directionally right and may be retained/reworked:

- a stable neutral `tool.ToolSpec` catalogue with broker-private `BackendID` routing;
- model-facing arguments copied independently of private route state;
- one set of executable wrappers per canonical parent session;
- a bounded authorization-required tool result before a protected backend is connected;
- ordinary `auth:none` tools remaining usable;
- collision detection before broker tools can mount beside global MCP tools;
- a per-session standard streaming-HTTP MCP client, closed with the session rather than with the shared Runtime.

The hermetic `auth:none` Streamable HTTP test in `internal/adapter/vmcpbroker/session_tools_test.go` is useful evidence for the generic client/wrapper mechanics. It is **not** evidence that embedded ToolHive vMCP has been composed; add a distinct ToolHive proof.

### Server/composition mechanics

The following direction is also useful:

- reserve the canonical session ID before broker session resources open;
- close partially opened session resources on factory or persistence failure;
- mount broker tools only through the established per-session `assembleCatalog` path;
- reject a broker/global tool-name collision before registration;
- ensure closing one session cannot close the process-owned Runtime or another session's client.

## Mandatory rework before dispatching more tasks

### 1. Remove the engine API widening

Task 03 added `session.Session.BrokerEnabled`, persisted it in `engine/adapter/sessnap`, changed `engine/api/session.txt`, and updated `engine/CHANGELOG.md`.

This is out of scope and violates the handover. Remove all of these changes:

- `engine/session/session.go`
- `engine/adapter/sessnap/sessnap.go`
- `engine/api/session.txt`
- the corresponding `engine/CHANGELOG.md` entry

Do **not** replace it with another engine or port field. Stage 2 broker/session bindings are process-lifetime only: a new Runtime starts empty after restart and explicit `Connect` is required again. Do not add a root-sidecar binding store or restart reattachment path for this spike.

### 2. Replace the direct OAuth implementation with ToolHive composition

Tasks 04 and 05 implemented a separate upstream OAuth client in `internal/adapter/vmcpbroker/oauth_transaction.go`. It performs issuer discovery, constructs the upstream authorization URL, owns upstream PKCE/state, and exchanges the callback code directly at the upstream token endpoint.

That implementation must not be extended. It violates the explicit rule against a third hand-written OAuth implementation and cannot establish the required ToolHive authorization-session lineage.

The required happy path is:

```text
Connect(session, protected-backend)
  -> broker creates/binds a private ToolHive authorization session
  -> broker returns a safe URL for embedded ToolHive /oauth/authorize
  -> ToolHive walks its sole configured upstream and receives upstream callback
  -> ToolHive sends a downstream authorization code to the broker-owned callback
  -> broker validates and consumes its broker-created transaction
  -> broker exchanges the downstream code at ToolHive /oauth/token
  -> broker stores only the downstream refresh/access-token lineage privately
  -> session-local standard /mcp transport receives/refreshes only its short-lived
     vMCP bearer internally
```

The browser/callback may prove only possession of opaque broker-created state. It must not choose a mecatl session, backend, issuer, client, scopes, ToolHive locator, or storage key.

Use the accepted Stage 0 single-upstream ToolHive construction and the actual ToolHive API/version it demonstrates. Keep ToolHive imports in a narrow implementation file. For this spike, accept ToolHive v0.40.0's built-in upstream OAuth HTTP client as an opaque dependency default rather than adding direct OAuth or changing ToolHive to inject a client. Record the observed default behavior and the missing injection seam in `STAGE2-RESULTS.md`; do not claim that mecatl enforces a no-proxy, DNS-pinned, or redirect policy.

### 3. Derive protected routes from strict operator configuration

`CompileProfiles` currently checks only that a discovered backend name occurs in the profile list. It does not derive `Route.Protected` from `MCPServerProfile.Auth.Mode`; tests currently set `Protected: true` manually.

Fix the compiler so the immutable route catalogue reflects the strict operator profile:

- `auth: none` stays executable before a connection;
- the one supported `auth: oauth` backend becomes protected;
- unsupported authentication modes fail explicitly rather than becoming anonymous by omission;
- a second independently selected OAuth backend returns the typed unsupported-capability result before a second lineage/upstream request.

### 4. Keep lifecycle claims honest

Current `SessionTools.Close` does not drain calls that have already passed its closed check, and Runtime close only flips a boolean. Do not claim AC4.6/AC5.2 until a later lifecycle task tracks in-flight calls, rejects new work, cancels/joins login and refresh work, closes session MCP clients before their bindings, and closes vMCP/authserver/storage in documented ownership order.

## Task-plan recovery

The task files presently say 01–05 are complete, but 03–05 do not satisfy the accepted architecture. Before resuming the orchestration loop, the coordinator must reopen/rewrite the affected task graph rather than dispatching task 06 on top of it:

1. Keep Task 01/02 only after checking their code against the revised profile compilation contract.
2. Keep Task 03 process-lifetime only; remove the engine changes and do not add restart reattachment or binding persistence.
3. Replace Task 04 and Task 05 with ToolHive-authserver/vMCP integration tasks; their current direct-OAuth commits are not the implementation path. ToolHive v0.40.0's default upstream OAuth client is accepted for this spike, with its missing egress-client injection seam recorded as follow-up evidence.
4. Rebase/rewrite Task 06 and Task 07 against the repaired runtime; do not try to layer refresh or teardown over the direct OAuth state machine.
5. Update the acceptance plan/ADR only if the recovered latest Stage 2 handover changes scope; otherwise preserve their stated exclusions.

The current `acc/session-vmcp-broker` commits to audit are:

- `a197eed79` — initial route/runtime contract;
- `c100d2c72` — session-local streaming-HTTP wrapper mechanics;
- `7cd25b722` and `93d30888a` — composition/reservation work, including the out-of-scope engine marker;
- `d3d7b25cb`, `05a60b8b0`, and `9633e30e1` — direct OAuth/callback work to replace rather than extend.

## Verification requirements for the restart

- Keep all test traffic offline: `httptest`, Stage 0/1 fakes, ToolHive in-process composition; never live provider/browser/network tests.
- Do not place bearer values, refresh values, auth codes, PKCE verifiers, callback state, client secrets, ToolHive locators/`tsid`, or storage/signing keys in diagnostics, errors, tool specs/results, session/event data, browser completion pages, or test failure messages.
- Verify the exact ToolHive integration with a real in-process one-upstream flow, then separately verify the standard `/mcp` protected call uses the correct injected upstream credential.
- Run the relevant focused tests during iteration; the assembled branch must ultimately pass `task lint`, `task test`, `task docs`, and `task ac-trace-strict` before any PR is considered.
- Do not commit, push, or open a PR unless explicitly requested.
