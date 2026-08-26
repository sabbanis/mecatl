# Session-scoped vMCP broker — acceptance plan

**Phase:** capability — session-scoped brokered streaming-HTTP MCP
**Status:** in-progress, 2026-08-26. Synthesized from the Stage 0/1 proofs and the settled Stage 2 broker design.
**ADR:** [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) — broker ownership, stable tool routing, and the control/data-plane boundary.
**Accumulator branch:** `acc/session-vmcp-broker` (off `main`).

The smallest set of work that lets one mecatl session use configured MCP tools
through an embedded ToolHive vMCP broker without sharing its upstream credentials
or connection lifecycle with another session. The first protected vertical is an
**internal composition proof**: one OAuth backend plus any number of `auth:none`
backends, driven by the root-internal Runtime API in hermetic tests. It adds no
public Connect wire endpoint or mecatui command. Stage 3 later replaces that
explicit internal connection with parked, exact-call continuation.

The document is scenario-first because the acceptance contract is what a running
mecatl session can demonstrate, not which packages happen to exist.

## Why these scope cuts

- **Session-local tools, never the global MCP manager.** Existing client MCP
  already mounts a manager per session and folds its close lifecycle into the
  per-session engine; global MCP is process-owned and must never be closed by one
  session ([ADR-0016](../adr/0016-multi-provider.md)). Broker tools are a new,
  explicitly sanctioned per-session `assembleCatalog` input. A broker/global MCP
  tool-name collision is rejected at construction, rather than silently allowing
  global precedence to bypass session-scoped authority.
- **Stable configured tools, authorization at execution.** The model chooses an
  ordinary MCP tool; it never sees a backend ID, token, or OAuth action.
  Connection changes whether a pre-existing tool can execute, not the tool set.
  This keeps the model-facing catalogue fixed and preserves eager MCP tool
  registration ([ADR-0237](../adr/0237-session-scoped-vmcp-broker.md)).
- **One OAuth backend only.** ToolHive does not yet expose the targeted
  `ConnectUpstream(existingSession, upstream)` operation needed to safely attach a
  second provider without creating a second lineage. The second backend therefore
  fails explicitly rather than pretending multi-provider support.
- **No new OAuth implementation.** ToolHive owns upstream OAuth behavior;
  `x/oauth2` exchanges only the broker-owned downstream authorization code. The
  existing direct-MCP `OAuthController` remains a distinct global profile flow
  ([ADR-0220](../adr/0220-mcp-oauth-controller.md)).

## In scope — 5 scenarios, in implementation order

### Scenario 1 — A broker session mounts stable executable MCP tools

The server reserves the canonical `session.SessionID` before it invokes the
per-session engine factory. Composition asks the root-internal broker to open
that session, and mounts the returned session-local tools through the existing
catalogue path. This follows the established per-session client-MCP rule:
composition builds the manager, the session owns its close function, and no
session can tear down a process-global manager ([ADR-0001](../adr/0001-acp-adapter.md)).
The new broker keeps ToolHive/OAuth types out of `engine/` and `engine/port`, as
required by the layering rule ([AGENTS.md](../../AGENTS.md)).

**Acceptance:**
- AC1.1: Creating a broker-enabled session reserves its canonical session ID
  before the per-session factory opens broker state; a construction or persistence
  failure releases the reservation and closes every partially-created session
  resource.
  - verify: `TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession`
- AC1.2: A broker-enabled session receives executable wrappers for the configured
  fixed MCP tool catalogue through the same `assembleCatalog` path as other
  per-session tools, while `Config.MCPServers` and the process-global manager are
  unchanged.
  - verify: `TestSessionVMCPBroker_Scenario1_MountsSessionToolsOnly`
- AC1.3: An Engine run invokes a fake `auth:none` upstream tool through the
  standard broker `/mcp` endpoint and receives its ordinary tool result.
  - verify: `TestSessionVMCPBroker_Scenario1_AuthNoneEngineRoundTrip`
- AC1.4: Two sessions receive independent broker session tools; closing one
  session neither breaks the other session's tool call nor closes shared broker
  infrastructure.
  - verify: `TestSessionVMCPBroker_Scenario1_SessionToolIsolation`
- AC1.5: A configured broker tool whose fully-qualified name collides with a
  process-global MCP tool causes broker-session construction to fail before it
  can mount either ambiguous wrapper; it never silently routes through global
  credentials. Non-conflicting broker tools remain mountable.
  - verify: `TestSessionVMCPBroker_Scenario1_RejectsGlobalToolCollision`
- AC1.6: The model-facing call contains only the selected tool's declared
  arguments. `BackendID`, broker bearer material, ToolHive locators, and OAuth
  state are never tool arguments, tool descriptions, or tool results.
  - verify: `TestInvariant_vmcp_broker_route_is_not_model_input`

---

### Scenario 2 — Explicit connection authorizes one protected backend

A composition-private control caller selects a configured backend, such as
`github`, and calls `Connect(sessionID, backendID)` in the hermetic vertical.
No public RPC/HTTP/UI surface is added in this plan; any later caller must first
apply the owning session's existing authorization before it reaches Runtime. The
backend ID enters only at this trusted composition boundary; the engine later
selects `mcp__github__list_issues`, whose wrapper already carries the
broker-private route to `github`. The callback proves knowledge of
broker-created state only: it cannot choose the mecatl session, backend, issuer,
scopes, client, or storage key. This keeps browser input out of the authorization
decision ([ADR-0237](../adr/0237-session-scoped-vmcp-broker.md)) and preserves
the repository's no-stdio-MCP invariant ([AGENTS.md](../../AGENTS.md)).

**Acceptance:**
- AC2.1: The first `Connect(session, protectedBackend)` with no usable upstream
  grant returns `AuthorizationRequired` containing one opaque handle, one HTTPS
  browser URL at the embedded ToolHive `/oauth/authorize` endpoint, and an
  expiry; it returns no token, refresh value, verifier, code, secret, or ToolHive
  locator. This spike uses ToolHive v0.40.0's built-in upstream OAuth client
  without a mecatl-injected egress client; its observed behavior and the missing
  control seam are recorded as a ToolHive follow-up, not implemented through a
  direct OAuth substitute.
  - verify: `TestSessionVMCPBroker_Scenario2_FirstConnectRequiresAuthorization`; inspection — `STAGE2-RESULTS.md` records the ToolHive version/default and missing injection seam.
- AC2.2: Concurrent and repeated `Connect` calls for the same session/backend
  share one pending browser transaction and return the same opaque handle and
  URL; cancellation of one waiter does not cancel the shared flow.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectSingleflight`
- AC2.3: `Connect` and `Disconnect` accept only an opened, non-tombstoned
  canonical parent session and configured backend. Unknown, delegation-child,
  forgotten, or unconfigured IDs allocate no transaction/binding, contact no
  upstream, and expose no additional session/backend information.
  - verify: `TestSessionVMCPBroker_Scenario2_RejectsInvalidControlTargets`
- AC2.4: Expiry removes a pending transaction, its verifier/state, waiter
  bookkeeping, and singleflight entry. Its callback remains inert, and a later
  valid `Connect` creates exactly one fresh opaque handle.
  - verify: `TestSessionVMCPBroker_Scenario2_ExpiredTransactionIsCollected`
- AC2.5: A valid broker callback commits a protected credential only to the
  session/backend bound into its original transaction. Wrong, expired, duplicate,
  cross-session, or late callbacks cannot install or resurrect a grant.
  - verify: `TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay`
- AC2.6: After successful callback completion, `Connect` returns `Connected` and
  the already-mounted protected tool executes through vMCP with the correct fake
  upstream credential; its model-visible tool identity is unchanged.
  - verify: `TestSessionVMCPBroker_Scenario2_ConnectedToolExecutesWithoutCatalogueMutation`
- AC2.7: Calling the protected tool before explicit connection returns a bounded
  authorization-required tool error, while an anonymous configured tool remains
  executable. Stage 2 neither parks nor replays the agent run.
  - verify: `TestSessionVMCPBroker_Scenario2_UnconnectedProtectedToolIsBounded`

---

### Scenario 3 — Broker custody refreshes session transport without exposing it

The broker owns downstream refresh state, upstream credentials, PKCE verifier,
authorization code, client secret, signing material, and the private ToolHive
locator. `SessionTools` obtains a current short-lived broker bearer only inside
its own HTTP transport; the engine and session record never receive a general
access-token value. The broker adopts an explicit no-proxy, exact-origin,
DNS-pinned, redirect-bounded OAuth egress profile rather than inheriting the
direct-MCP controller implicitly; this is pinned by
[ADR-0237](../adr/0237-session-scoped-vmcp-broker.md). Its operational messages
use injected diagnostics and its secret-shaped values are never projected or
logged ([ADR-0020](../adr/0020-diagnostics.md)).

**Acceptance:**
- AC3.1: A session-local broker transport refreshes an expired short-lived
  downstream bearer internally and the next protected MCP call succeeds without
  a new browser flow.
  - verify: `TestSessionVMCPBroker_Scenario3_RefreshesTransportInternally`
- AC3.2: Concurrent expired transport requests coalesce safely and a late refresh
  cannot restore state after session forget, disconnect, or Runtime close.
  - verify: `TestSessionVMCPBroker_Scenario3_RefreshCannotResurrectState`
- AC3.3: Distinct canaries for upstream/downstream access and refresh values,
  OAuth client secret, authorization code, PKCE verifier, callback state, `tsid`,
  and storage/signing keys are absent from captured returned errors, injected
  diagnostics, browser responses, tool metadata/results, session snapshots,
  event data, and outbound request metadata. Broker operational messages use the
  injected diagnostics seam rather than package-global slog.
  - verify: `TestInvariant_vmcp_broker_secrets_do_not_escape`; `TestSessionVMCPBroker_Scenario3_UsesInjectedDiagnostics`
- AC3.4: Selecting a second OAuth backend fails with a typed unsupported-capability
  error before creating another auth-session lineage or contacting that upstream;
  configured anonymous backends remain usable.
  - verify: `TestSessionVMCPBroker_Scenario3_SecondOAuthBackendUnsupported`

---

### Scenario 4 — Disconnect and forget contain authority to one session

A Runtime control operation is composition-private in this phase: the server has
already accepted the canonical session before it calls the broker. A future public
control surface must authorize the owning session before it reaches Runtime;
ownerless Stage 2 must not become an implicit authorization bypass. `ForgetSession`
is called only after the session's MCP client has drained, matching the existing
per-session MCP lifecycle where closing a client must not abort in-flight calls
([ADR-0001](../adr/0001-acp-adapter.md)).

**Acceptance:**
- AC4.1: `Disconnect(session, backend)` cancels that backend's pending flow,
  removes its broker binding and removable upstream credential, preserves the
  session's other backends, and is idempotent.
  - verify: `TestSessionVMCPBroker_Scenario4_DisconnectIsBackendScoped`
- AC4.2: Reconnecting a disconnected OAuth backend returns the documented typed
  limitation rather than silently creating a second ToolHive lineage; the result
  names no credential material.
  - verify: `TestSessionVMCPBroker_Scenario4_ReconnectRequiresConnectUpstream`
- AC4.3: `ForgetSession(session)` tombstones the session, cancels and joins its
  pending login/refresh work, removes all broker bindings and token state, deletes
  indexed upstream credentials, and is idempotent.
  - verify: `TestSessionVMCPBroker_Scenario4_ForgetRevokesAndTombstones`
- AC4.6: A session close that races an in-flight broker tool call waits for the
  call to settle before `ForgetSession` removes its state; after close, new calls
  are rejected and `ForgetSession` runs exactly once.
  - verify: `TestSessionVMCPBroker_Scenario4_CloseDrainsInFlightCall`

---

### Scenario 5 — Shared runtime closes honestly and the external boundary is proven

One Runtime owns shared ToolHive resources, while `SessionEngineResult.Close`
owns each session's `SessionTools` before it calls `ForgetSession`. The existing
composition rule is that a per-session close must not close global MCP state
([ADR-0016](../adr/0016-multi-provider.md)). ToolHive residual goroutines are
reported honestly, never suppressed; external servers remain manual smoke tests
because the repository test suite is offline ([AGENTS.md](../../AGENTS.md)).

**Acceptance:**
- AC5.1: Closing a session drains and closes only its `SessionTools`, then calls
  `ForgetSession`; it does not close the Runtime or another session's tools.
  - verify: `TestSessionVMCPBroker_Scenario5_SessionCloseOrdering`
- AC5.2: `Runtime.Close` rejects new control/MCP work, cancels and joins broker
  login/refresh work, closes vMCP/authserver/storage in ownership order, and is
  idempotent.
  - verify: `TestSessionVMCPBroker_Scenario5_RuntimeCloseOrdering`
- AC5.3: Tests add no goleak exclusions or residual-goroutine hiding. Any
  ToolHive-owned goroutines still remaining after public close are recorded in
  `STAGE2-RESULTS.md` with their observed stack evidence.
  - verify: inspection — residuals are an upstream dependency finding; the result document records unfiltered evidence.
- AC5.4: A manual live smoke uses `https://modelcontextprotocol.io/mcp` behind
  the broker and proves remote initialize, authenticated broker `tools/list`, and
  one documentation tool call; it is not part of `task test`.
  - verify: demonstration — documented command and successful outcome in `STAGE2-RESULTS.md`.

## Out of scope

| Item | Defer-to | ADR / decision |
|---|---|---|
| Agent-loop parking and exact original-tool-call replay | Stage 3 conversation integration | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Mecatui command and public control protocol | later UI/API slice | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Second OAuth backend under one ToolHive auth session | ToolHive `ConnectUpstream` capability | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Owner/principal matrix, delegation, and tenant authorization | later identity stage | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Durable/multi-replica broker storage | later sidecar storage stage | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Sidecar binary, Helm, Kind, ConfigMap mounting, RPC, and production sidecar authentication | deployment stage | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Dynamic configuration or catalogue reload | later operations stage | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |

## Sequencing recommendation

Land Scenario 1 before building any OAuth callback path: it proves that the
broker's session ID, stable tools, execution route, catalogue mount, and close
ownership fit the running harness. Scenario 2 adds connection state and one
protected backend without changing those tools. Scenario 3 adds refresh/custody,
then Scenario 4 hardens removal races. Scenario 5 is the aggregate lifecycle and
manual-compatibility gate.

## Named tests landing in this plan

- `TestSessionVMCPBroker_Scenario1_ReservesIDBeforeBrokerSession`
- `TestSessionVMCPBroker_Scenario1_MountsSessionToolsOnly`
- `TestSessionVMCPBroker_Scenario1_AuthNoneEngineRoundTrip`
- `TestSessionVMCPBroker_Scenario1_SessionToolIsolation`
- `TestSessionVMCPBroker_Scenario1_RejectsGlobalToolCollision`
- `TestInvariant_vmcp_broker_route_is_not_model_input`
- `TestSessionVMCPBroker_Scenario2_FirstConnectRequiresAuthorization`
- `TestSessionVMCPBroker_Scenario2_RejectsForeignOAuthEgress`
- `TestSessionVMCPBroker_Scenario2_ConnectSingleflight`
- `TestSessionVMCPBroker_Scenario2_RejectsInvalidControlTargets`
- `TestSessionVMCPBroker_Scenario2_ExpiredTransactionIsCollected`
- `TestSessionVMCPBroker_Scenario2_CallbackBindingAndReplay`
- `TestSessionVMCPBroker_Scenario2_ConnectedToolExecutesWithoutCatalogueMutation`
- `TestSessionVMCPBroker_Scenario2_UnconnectedProtectedToolIsBounded`
- `TestSessionVMCPBroker_Scenario3_RefreshesTransportInternally`
- `TestSessionVMCPBroker_Scenario3_RefreshCannotResurrectState`
- `TestInvariant_vmcp_broker_secrets_do_not_escape`
- `TestSessionVMCPBroker_Scenario3_UsesInjectedDiagnostics`
- `TestSessionVMCPBroker_Scenario3_SecondOAuthBackendUnsupported`
- `TestSessionVMCPBroker_Scenario4_DisconnectIsBackendScoped`
- `TestSessionVMCPBroker_Scenario4_ReconnectRequiresConnectUpstream`
- `TestSessionVMCPBroker_Scenario4_ForgetRevokesAndTombstones`
- `TestSessionVMCPBroker_Scenario4_LateOperationsCannotResurrect`
- `TestSessionVMCPBroker_Scenario4_CloseDrainsInFlightCall`
- `TestSessionVMCPBroker_Scenario5_SessionCloseOrdering`
- `TestSessionVMCPBroker_Scenario5_RuntimeCloseOrdering`

## Definition of done

1. `task lint` and `task test` pass.
2. `task docs` regenerates `llms.txt` and passes the strict link gate.
3. `task ac-trace-strict` passes after the plan is marked `landed`.
4. Every named test above is green and grep-locatable.
5. `go run ./cmd/mecademo` still prints a complete offline session.
6. `docs/architecture.md`, `docs/architecture/extensibility.md`, and
   `docs/design/IMPLEMENTATION-NOTES.md` describe the distinct brokered
   per-session path, its sanctioned catalogue input/collision rule, diagnostics,
   and close/restart behavior; [ADR-0027](../adr/0027-cloud-native.md) Lists 1
   and 2 inventory every Runtime/session resource with an explicit reattach,
   reset, or persist decision.
7. `STAGE2-RESULTS.md` records required evidence as pass/fail/blocked, selected
   ToolHive APIs/versions, lifecycle residuals, manual docs-server smoke outcome,
   reuse versus direct-MCP/Ozz code, `ConnectUpstream` differences, and Stage 3
   go/no-go. A GitHub OAuth App smoke is a later vertical-slice gate, not a
   passing substitute for this generic broker plan.

## Deferred decisions and known risks

- **Pre-authorization tool discovery.** The implementation must prove that the
  standard ToolHive/vMCP path exposes fixed configured protected tools before
  upstream OAuth completes. If public ToolHive APIs cannot satisfy that contract,
  the plan is blocked rather than introducing dynamic catalogue churn or a second
  OAuth implementation.
- **Bearer theft.** A short-lived broker token remains bearer authority until it
  expires. Session isolation prevents lookup abuse but is not proof of
  non-transferability.
- **ToolHive shutdown residuals.** Existing vMCP/mcpcompat residual goroutines
  are an upstream limitation; public close behavior and unfiltered evidence are
  still required.

## Exit criteria

When every point under *Definition of done* holds on the accumulator, this plan
is satisfied.
