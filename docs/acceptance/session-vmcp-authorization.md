# Configured resumable MCP authorization — acceptance plan

**Phase:** capability — operator-configured session broker and resumable MCP authorization
**Status:** in-progress, 2026-08-27. Synthesized from the Stage 3 handover, the accepted configuration discussion, and the completed five-axis `StateAuthorizing` review.
**ADR:** [ADR-0238](../adr/0238-configured-resumable-mcp-authorization.md) — one MCP authority mode, durable authorizing state, and exact continuation.
**Accumulator branch:** `acc/session-vmcp-authorization` (off `acc/session-vmcp-broker`).

The smallest set of work that lets an administrator configure MCP once, lets
`mecak8s` use the session broker by default, and lets an attached client observe one
protected tool call park before the protected request, complete browser authorization,
and resume the exact effective call once.

The terminal proof begins with the real operator `settings.yaml` path and ends with an
observed Streamable HTTP MCP request. Prebuilt Runtime injection and narrow fakes remain
supporting tests, not substitutes for that vertical. The approved planning discussion
intentionally expands the handover's minimum injected-Runtime allowance to include
configuration-driven `mecak8s` command-root construction and local HTTPS callback hosting;
Kind/Helm packaging remains optional qualification evidence, not a Stage 3 completion gate.
Stage 3 stays single-replica and process-local for broker transactions; durable distributed
broker custody remains later work.

The document is scenario-first because acceptance is about what the running harness can
demonstrate, not which packages happen to exist.

## Why these scope cuts

- [ADR-0113](../adr/0113-operator-mcp-auth-profiles.md) already establishes one strict,
  operator-tier MCP configuration and one canonical loader. Broker mode extends that
  route; it does not add a second profile file or parser.
- [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) fixes the Stage 2 boundary:
  stable session-local tools, one protected lineage, broker-owned credentials, and no
  ToolHive/OAuth types in the engine.
- [ADR-0027](../adr/0027-cloud-native.md) requires every process/session resource and
  restart-fidelity decision to be inventoried. The browser transaction and expiry
  worker are process-local; the exact pending call is snapshot state.
- [`AGENTS.md`](../../AGENTS.md) requires aggregate-owned session mutation, durable
  event-log persistence at the relay, explicit run-entry recovery, read-parallel /
  mutate-serial dispatch, and engine API compatibility accounting.

## In scope — 10 scenarios, in implementation order

### Scenario 1 — Canonical configuration selects one MCP authority model

An administrator keeps using the strict operator-only `mcp.servers` list introduced for
global MCP profiles. One `mcp.mode` selects either the existing global manager or the
session broker for the whole list; the two authority paths never coexist. The existing
profile resolver remains the only parser and preserves whole-block precedence and
project rejection ([ADR-0113](../adr/0113-operator-mcp-auth-profiles.md)).

The accepted shape is:

```yaml
mcp:
  mode: broker # global | broker
  broker:
    callback_url: https://agent.example/v1/mcp/authorization/callback
  servers:
    - name: docs
      url: https://modelcontextprotocol.io/mcp
      auth: {mode: none}
```

`mcp.broker` contains broker-only options; its presence does not enable the broker.
`callback_url` is the exact trusted HTTPS redirect URI and is required only when broker
mode contains an OAuth profile. Runtime transaction expiry uses a fixed documented
value rather than another operator knob.

**Acceptance:**
- AC1.1: An omitted `mcp.mode` resolves to `broker` in `mecak8s` and `global` in
  `mecated` and embedded `mecatui`; `mecatequi` rejects explicit broker mode as an
  unsupported unattended root. Programmatic composition receives an explicit root default,
  and an explicit supported-root mode overrides it.
  - verify: `TestSessionMCPAuthorization_Scenario1_RootModeDefaults`
- AC1.2: Global mode preserves byte-compatible `none`, `static_bearer`, OAuth
  credential, and `mecated mcp login` behavior, and constructs no broker Runtime.
  - verify: `TestSessionMCPAuthorization_Scenario1_GlobalModeCompatibility`
- AC1.3: Broker mode consumes the whole server list exclusively, accepts anonymous
  profiles plus at most one OAuth profile, rejects `static_bearer`, and never constructs
  a global MCP manager or direct `OAuthController` for those profiles.
  - verify: `TestSessionMCPAuthorization_Scenario1_BrokerModeIsExclusive`
- AC1.4: Broker OAuth reuses and validates issuer, client, scopes, refresh intent, and
  network-policy vocabulary where the Runtime can apply it, while global credential
  identity/source fields (`profile`, `principal`, and `credentials`) are rejected in
  broker mode and remain required in global OAuth mode. Configuration and docs do not
  claim that mecatl enforces egress controls inside ToolHive's non-injectable upstream
  OAuth client.
  - verify: `TestSessionMCPAuthorization_Scenario1_ModeSpecificOAuthSchema`
- AC1.5: `mcp.broker.callback_url` is required exactly when broker mode has an OAuth
  backend, must be an absolute HTTPS URL without userinfo/query/fragment, and is rejected
  as inert configuration in global mode. No URL is derived from `Host` or forwarded
  headers.
  - verify: `TestInvariant_mcp_broker_callback_url_is_trusted_configuration`
- AC1.6: Project-tier `mcp:` remains ignored with a value-free warning; explicit
  operator files retain whole-block precedence over conventional user settings.
  - verify: `TestSessionMCPAuthorization_Scenario1_OperatorTierOnly`
- AC1.7: Legacy `--mcp-server`/`MCP_<NAME>_TOKEN` stays global-only and conflicts with
  broker mode instead of overriding, appending to, or dual-mounting broker profiles.
  - verify: `TestSessionMCPAuthorization_Scenario1_LegacyGlobalConflict`
- AC1.8: The generated settings skeleton, configuration reference, usage guide, and
  user documentation show the root defaults, callback condition, single protected
  backend limit, and the explicit `mcp.mode: global` migration for existing mecak8s
  deployments.
  - verify: inspection — generated configuration and migration prose require a documentation review
- AC1.9: The canonical loader parses one lossless strict MCP syntax value, resolves the
  root default, then applies exactly one global-or-broker validation pass. Its typed result
  cannot carry both global server configs and broker declarations; programmatic
  `MCPServers`, injected Runtime, legacy flags, and acquired lifecycle resources obey the
  same exclusivity and rollback rules.
  - verify: `TestInvariant_mcp_authority_mode_is_single_construction_branch`

---

### Scenario 2 — Real operator settings construct one process-owned broker

The canonical loader validates one mode-specific result. In broker mode, `app.Build`
uses the declarations to discover the fixed ToolHive tool catalogue, compile private
routes, and construct one process-owned Runtime plus a root-internal HTTP handler bundle.
`app.Built` owns that bundle and its cleanup; supported command roots mount its fixed
public auth/vMCP/callback routes separately from owner-authenticated application controls.
Broker profiles never enter the global credential lifecycle
([`architecture.md` — session-scoped broker](../architecture.md#session-scoped-vmcp-broker-stage-2-integration-proof)).

**Acceptance:**
- AC2.1: A real operator settings file flows through `Resolver.OperatorMCP()` and the
  canonical profile loader into one broker construction; no package reparses YAML or
  reads project configuration for broker authority.
  - verify: `TestSessionMCPAuthorization_Scenario2_SettingsConstructBroker`
- AC2.2: Startup discovers every configured backend's stable ToolHive tool definitions,
  compiles private backend routes, and fails before serving on an unconfigured discovery
  result, duplicate tool, unsupported auth mode, second protected backend, or failed
  pre-authorization discovery.
  - verify: `TestSessionMCPAuthorization_Scenario2_CompilesDiscoveredRoutes`
- AC2.3: `app.Build` returns one owned broker handler bundle; `mecated` and `mecak8s`
  mount its fixed authorization, token, vMCP, and callback routes without overlapping
  health, API, or control routes. Generated browser and redirect URLs use only the
  configured callback URL's canonical origin/path contract.
  - verify: `TestSessionMCPAuthorization_Scenario2_MountsTrustedHandlers`
- AC2.4: The callback handler is GET-only and accepts exactly one non-empty decoded
  `code` and one `state`, each at most 8 KiB, plus an optional single non-empty decoded
  `scope` at most 8 KiB. `scope` is compatibility-only and is ignored completely.
  Duplicate, missing, unexpected, malformed, body-bearing, empty, or oversized input maps
  to the same generic HTTP 400; success maps to a fixed HTTP 200. Every response sets
  `Cache-Control: no-store` and `Referrer-Policy: no-referrer`, performs no redirect, and
  reflects neither value nor browser URLs in responses, diagnostics, traces, metrics, or
  access-log fields. A browser denial without a code remains pending for explicit cancel or
  expiry.
  - verify: `TestInvariant_mcp_callback_input_is_bounded_and_never_reflected`
- AC2.5: Callback requests carry broker-created code/state plus at most one ignored
  provider `scope`; they cannot choose a session, owner, backend, MCP endpoint, issuer,
  client, or authority scope.
  - verify: `TestInvariant_mcp_callback_cannot_select_authority`
- AC2.6: Construction failure closes every acquired ToolHive/profile resource, and
  normal shutdown closes session tools before the Runtime and the Runtime before any
  global profile credential sources.
  - verify: `TestSessionMCPAuthorization_Scenario2_RollbackAndCloseOrdering`
- AC2.7: A remotely reachable broker control plane fails startup unless verified caller
  identity enables ownership enforcement. Ownerless broker controls are permitted only
  for an explicitly local/loopback single-user composition, never a network-reachable
  mecak8s deployment.
  - verify: `TestInvariant_remote_mcp_broker_requires_verified_ownership`
- AC2.8: Stage 3 command-root construction is the approved expansion beyond the
  handover's minimum prebuilt-Runtime allowance; its local HTTPS test is required, while
  Helm/Kind packaging is not a completion dependency.
  - verify: `TestSessionMCPAuthorization_Scenario2_CommandRootConstructionEnabled`

---

### Scenario 3 — Configured sessions mount stable broker tools after create and reload

The server reserves the canonical session ID before opening broker state, then mounts
session-local wrappers through the existing `assembleCatalog` path. A durable non-secret
broker enrollment/configuration identity makes restored sessions rebuild the same class
of per-session catalogue or fail loudly; shared/global fallback is forbidden
([ADR-0237](../adr/0237-session-scoped-vmcp-broker.md)).

**Acceptance:**
- AC3.1: Session ID reservation precedes `Runtime.OpenSession`, and create/save/factory
  failure releases the reservation and closes the partially opened broker session.
  - verify: `TestSessionMCPAuthorization_Scenario3_ReserveBeforeOpen`
- AC3.2: The model sees a fixed ordinary tool catalogue whose wrappers retain private
  backend routes; backend IDs, callback data, ToolHive locators, and credentials are not
  model inputs or tool metadata.
  - verify: `TestInvariant_session_broker_route_is_not_model_input`
- AC3.3: Broker enrollment and enough non-secret configuration provenance persist so a
  restored default-profile/default-model session is forced through broker-aware
  rehydration.
  - verify: `TestSessionMCPAuthorization_Scenario3_PersistsBrokerEnrollment`
- AC3.4: A restored broker session recreates session-local wrappers from current trusted
  operator configuration before any fresh tool call.
  - verify: `TestSessionMCPAuthorization_Scenario3_RestoresBrokerCatalog`
- AC3.5: Missing Runtime construction, changed incompatible route inventory, failed
  discovery, or broker/global name collision returns failed-precondition and never uses
  the shared engine/global MCP authority.
  - verify: `TestInvariant_broker_rehydration_never_falls_back_global`
- AC3.6: A Service-owned broker-session registry makes concurrent create, rehydrate,
  per-session engine rebuild, and cache eviction for one ID reuse one live `SessionTools`
  owner or fail closed; only final session close may call `ForgetSession`, and partial
  factory failure cannot tombstone a still-live session.
  - verify: `TestSessionMCPAuthorization_Scenario3_BrokerSessionOwnership`
- AC3.7: Closing one session drains its calls and forgets only its broker state; another
  session and the process Runtime remain usable.
  - verify: `TestSessionMCPAuthorization_Scenario3_SessionIsolation`

---

### Scenario 4 — `StateAuthorizing` preserves one exact pending operation

The completed five-axis state review found that permission awaiting and MCP authorization
have different authorities and restart semantics. The aggregate therefore gains a
separate nonterminal `StateAuthorizing` and private pending value rather than widening
`PendingAsk`. This follows the aggregate rule in [`AGENTS.md`](../../AGENTS.md).

The pending value owns the exact effective call plus the ordered suffix of later sibling
calls that dispatch has not executed; completed-prefix results are already durable before
entry. The invariant is:

```text
StateAwaiting    iff PendingAsk exists
StateAuthorizing iff PendingMCPAuthorization exists
all other states have neither
both pending values can never coexist
```

**Acceptance:**
- AC4.1: `running -> authorizing` is legal only through a dedicated aggregate method with
  a valid pending value; permission-awaiting fields and policy learning remain untouched.
  - verify: `TestSessionMCPAuthorization_Scenario4_TransitionMatrix`
- AC4.2: `PendingMCPAuthorization` deep-copies the exact post-PreToolUse `ToolCall`,
  the ordered deep-copied suffix of later unexecuted sibling calls, authorization ID,
  safe backend label, expiry, and minimum non-secret route/config provenance at entry,
  accessor, and snapshot boundaries.
  - verify: `TestInvariant_pending_mcp_authorization_deep_copy`
- AC4.3: State/pending mismatch, both pending families, empty or malformed correlation,
  invalid expiry, duplicate/mismatched call ID, or a pending call inconsistent with the
  trailing assistant turn is rejected without execution.
  - verify: `TestSessionMCPAuthorization_Scenario4_RejectsMalformedState`
- AC4.4: New prompt, steer, mode change, rehome, fork/carryover, adoption, compaction,
  history replacement, usage reset, and any other operation that could alter the frozen
  call reject `StateAuthorizing` before mutation; title-only metadata remains governed by
  an explicit state-matrix decision.
  - verify: `TestInvariant_authorizing_state_rejects_conflicting_mutations`
- AC4.5: Dedicated claim, abort, and restart-interruption operations pair the exact call
  before leaving authorizing; after returning to running they produce one ordered
  `RecordToolResults` input containing the pending call's real/synthetic result followed
  by one deterministic synthetic result per deferred sibling. Generic
  Complete/Stop/Cancel/Fail/Abandon/reset cannot silently clear the pending state.
  - verify: `TestInvariant_authorizing_resolution_preserves_tool_pairing`
- AC4.6: The sole temporarily unmatched history shape is the stored pending call plus
  explicitly tracked later siblings; every resolved/aborted history passes
  `ValidateToolPairing`.
  - verify: `TestSessionMCPAuthorization_Scenario4_PairingExceptionIsExact`
- AC4.7: Snapshot round-trip preserves authorizing state and private call data across
  memstore, jsonlstore, Redis, and gRPC-driver conformance paths.
  - verify: `TestInvariant_authorizing_snapshot_store_conformance`
- AC4.8: An older or malformed reader encountering authorizing state fails closed before
  state mutation, `Connect`, or execution; it never coerces the state to idle/running.
  - verify: `TestSessionMCPAuthorization_Scenario4_OldReaderFailsClosed`

---

### Scenario 5 — Dispatch parks only after gates and durable save

The existing order remains permission, PreToolUse, then execution. A protected wrapper
adapts Runtime pending state to a small neutral engine-owned control signal containing
only authorization ID, backend, and expiry. Dispatch intercepts it before generic error,
audit, PostToolUse, or failure accounting. The authorizing snapshot is durable before a
client can act on the required event ([ADR-0020](../adr/0020-diagnostics.md)).

**Acceptance:**
- AC5.1: Permission deny and PreToolUse block return their ordinary paired results and
  never call broker `Connect`.
  - verify: `TestSessionMCPAuthorization_Scenario5_GatesPrecedeConnect`
- AC5.2: A PreToolUse argument mutation is exactly the call stored and later executed;
  the original call is never replayed.
  - verify: `TestInvariant_mcp_authorization_replays_effective_call`
- AC5.3: The protected broker tool card emitted before the gate carries safe call/tool
  identity but no arguments in live events, durable events, or wire projections.
  - verify: `TestInvariant_protected_broker_tool_card_redacts_arguments`
- AC5.4: Pending authorization records no result for the pending call, sends no protected
  request, runs no PostToolUse, writes no ToolCallRecorder entry, increments no failure
  counter, and emits no terminal `EvResult`.
  - verify: `TestSessionMCPAuthorization_Scenario5_PendingHasNoExecutionEffects`
- AC5.5: Earlier sibling results are recorded once in original order before entering
  authorizing; the pending call is exact; later siblings do not execute.
  - verify: `TestSessionMCPAuthorization_Scenario5_ParksMidTurnDeterministically`
- AC5.6: The private authorizing snapshot save succeeds before
  `mcp.authorization.required` is emitted or relayed.
  - verify: `TestInvariant_mcp_authorization_save_precedes_required_event`
- AC5.7: If the save fails after Runtime pending creation, the exact transaction is
  invalidated, one paired ordinary error is recorded, and no usable handle or authorizing
  state survives.
  - verify: `TestSessionMCPAuthorization_Scenario5_SaveFailureCancelsTransaction`
- AC5.8: `agent.Run` exposes a distinct `authorization_parked` completion outcome,
  separate from `session.StopReason`; gRPC and SSE relays treat channel closure after that
  outcome as expected, deregister only that Run, keep the Session nonterminal, and record
  parked metrics without fabricating success/failure or `EvResult`.
  - verify: `TestSessionMCPAuthorization_Scenario5_ParkedRunOutcome`

---

### Scenario 6 — Eligibility and broker serialization stay truthful

Presentation eligibility comes from the trusted wire entry point, not model input and not
process-global headless posture. Dispatch serialization is orthogonal to a tool's semantic
read-only declaration, preserving the existing plan/permission meaning of `ReadOnly()`
([`AGENTS.md` — read-parallel/mutate-serial](../../AGENTS.md)).

**Acceptance:**
- AC6.1: An owner-authorized remote interactive main run may enter authorizing on a
  process-headless mecak8s server.
  - verify: `TestSessionMCPAuthorization_Scenario6_RemoteMainMayPark`
- AC6.2: ACP, scheduled, detached, background, child, Parallel, Team, and other
  presentation-ineligible runs create no Runtime transaction and receive one bounded
  ordinary paired tool error.
  - verify: `TestInvariant_unattended_runs_never_park_for_mcp_authorization`
- AC6.3: A broker wrapper's `ReadOnly()` remains the configured tool's real semantic
  hint; read tools remain read-only and mutating tools remain mutating for permissions
  and plan-mode advertisement.
  - verify: `TestInvariant_broker_tools_preserve_read_only_semantics`
- AC6.4: All broker calls are dispatch-serialized relative to sibling broker calls, so
  one session has at most one pending authorization and result order is stable.
  - verify: `TestSessionMCPAuthorization_Scenario6_BrokerCallsSerialize`
- AC6.5: Unrelated non-broker read-only tools retain the existing parallel dispatch
  behavior.
  - verify: `TestSessionMCPAuthorization_Scenario6_UnrelatedReadsRemainParallel`

---

### Scenario 7 — Owner controls resume the effective call exactly once

MCP authorization has separate presentation, recheck, and cancellation controls; it is
not a permission verdict. The public operation is **cancel** only—there is no separate
OAuth `deny` vocabulary. Cancellation resolves with status `cancelled` and permits a
later fresh attempt. The client cannot assert OAuth success. Runtime callback completion
remains broker-owned, and only a subsequent `Connect == connected` observation may start
the continuation ([ADR-0238](../adr/0238-configured-resumable-mcp-authorization.md)).

The service linearization is: owner authorization, keyed `runEntryMu`, acquire/confirm the
session lease, reload and validate the snapshot, perform the bounded Runtime state check,
claim the aggregate resolution and save it, register the continuation Run, then release
the lock. The connected claim is the durable no-retry boundary: it moves to running and
clears the private pending value. Registration failure immediately invokes running-state
abandonment repair and persists paired errors; a process crash after claim but before or
during execution is repaired by ordinary lease-gated running recovery, which never retries
the protected request. No lock is held while `Tool.Execute`, callback token exchange, or
client streaming runs. Cancel, expiry, close, and restart use the same keyed critical
section; a loser observes non-authorizing/claimed state and performs no Runtime or tool side
effect.

**Acceptance:**
- AC7.1: Presentation authorizes the loaded session owner before Runtime lookup, validates
  the exact pending authorization, and returns the current URL only in the live response;
  wrong/foreign/stale targets reveal no existence detail.
  - verify: `TestInvariant_mcp_presentation_owner_checked_before_runtime`
- AC7.2: Recheck while Runtime is pending acknowledges pending without state mutation,
  result recording, or execution; a client payload has no success assertion field.
  - verify: `TestSessionMCPAuthorization_Scenario7_PendingRecheckIsInert`
- AC7.3: After callback completion, recheck resumes only when Runtime reports
  `ConnectionConnected`.
  - verify: `TestSessionMCPAuthorization_Scenario7_ConnectedRecheckResumes`
- AC7.4: The continuation executes the stored effective call once without rerunning
  permission or PreToolUse, then runs PostToolUse, audit recording, ordinary ToolResult
  recording, and model continuation once.
  - verify: `TestInvariant_mcp_authorization_continuation_exactly_once`
- AC7.5: Runtime exact-handle cancellation covers pending, callback-claimed,
  cancelled, expired, and connected states under one adapter linearization point. A
  cancel/expiry/close winner prevents downstream token exchange or grant installation,
  cannot be undone by callback restoration, never routes through permanent `Disconnect`,
  and allows a later fresh authorization attempt.
  - verify: `TestSessionMCPAuthorization_Scenario7_CancelAllowsFreshAttempt`
- AC7.6: A fixed-TTL service expiry worker resolves an expired pending call with one
  paired error, invalidates the exact Runtime transaction, and cannot race a connected
  winner into a second result.
  - verify: `TestSessionMCPAuthorization_Scenario7_ExpiryResolvesOnce`
- AC7.7: Concurrent recheck, cancel, expiry, close, and callback completion have one
  linearized winner; at most one protected request and one result are produced.
  - verify: `TestInvariant_mcp_authorization_resolution_single_winner`
- AC7.8: Wrong session, owner, authorization ID, backend, call ID, expiry, or already
  resolved state fails closed before Runtime side effects and uses an externally
  indistinguishable response class.
  - verify: `TestSessionMCPAuthorization_Scenario7_MismatchedControlsFailClosed`
- AC7.9: A continuation registration failure after the durable connected claim is repaired
  and persisted immediately; a crash after claim and before/during execution is recovered
  as crash-orphaned running with paired errors and zero automatic retries of the protected
  request.
  - verify: `TestSessionMCPAuthorization_Scenario7_PostClaimCrashNeverRetries`

---

### Scenario 8 — Restart, close, and retention never replay an old action

Runtime transactions and grants remain process-local. While authorizing, the original
process retains the session lease. A successor treats absence of that exact process-local
transaction as interruption, never as permission to start or attach a new browser flow.
This extends the explicit run-entry recovery discipline in
[`IMPLEMENTATION-NOTES.md`](../design/IMPLEMENTATION-NOTES.md#domain--enginesession-lifecycle-recovery).

**Acceptance:**
- AC8.1: The existing Service-owned `heldLeases` entry and renewer remain the sole
  lease owner after the parked Run is deregistered; renewal continues until resolution,
  session close, lease loss, or process exit, and resolution/close release behavior is
  independent of a live Run pointer.
  - verify: `TestSessionMCPAuthorization_Scenario8_ParkRetainsLease`
- AC8.2: After process loss and exclusive lease acquisition, the successor records one
  interruption-accurate paired result, clears authorizing, persists a recoverable state,
  and calls neither Runtime `Connect` nor `Tool.Execute` for the old action.
  - verify: `TestInvariant_restarted_authorization_never_executes_old_call`
- AC8.3: A newly constructed Runtime reporting the same backend connected does not change
  restart interruption behavior.
  - verify: `TestSessionMCPAuthorization_Scenario8_NewRuntimeIsNotContinuity`
- AC8.4: Session close/delete, lease loss, and service shutdown serialize with resolution;
  a nonconnected winner invalidates the exact transaction and pairs history before broker
  resources are forgotten.
  - verify: `TestSessionMCPAuthorization_Scenario8_CloseRaceHasOneWinner`
- AC8.5: Stale-running reconciliation never treats authorizing as generic running;
  retention, cleanup, adoption, carryover, and inventory capabilities have explicit
  authorizing policies and cannot silently delete or reopen the frozen operation.
  - verify: `TestInvariant_authorizing_state_all_lifecycle_consumers_explicit`
- AC8.6: Broker-mode deployment documentation and command diagnostics state the
  single-process/single-replica requirement. When two services share a store and lease,
  the non-holder fails closed with leased-elsewhere and never interrupts, rechecks, or
  executes while the original holder's lease is live; no transparent routing claim is
  made.
  - verify: `TestSessionMCPAuthorization_Scenario8_NonHolderFailsClosed`
- AC8.7: ADR 0027 inventories Runtime construction, session transports, pending
  transactions, the durable pending snapshot, lease ownership, and the expiry worker with
  explicit cleanup and restart decisions.
  - verify: inspection — cloud-native resource and rehydrate-fidelity ledgers require review

---

### Scenario 9 — Wire and client surfaces expose presentation, not approval

Required/resolved events are a distinct protocol family over gRPC and HTTP/SSE. Mecatui
uses them to present browser authorization and to invoke server controls; permission asks,
verdicts, and learning remain byte-compatible. Reconnect uses safe replay plus a live
status refresh ([`architecture.md` — API surface](../architecture/api-surface.md)).

**Acceptance:**
- AC9.1: `mcp.authorization.required` carries only safe session/run correlation as needed,
  call ID, authorization ID, backend label, expiry, and status `pending`; `resolved` uses
  exactly `connected`, `cancelled`, `expired`, `interrupted`, `failed`, or `closed`.
  Neither contains a URL, arguments, code, verifier, token, `tsid`, or secret. A protected
  tool failure after connected remains an ordinary ToolResult/Run failure and does not
  rewrite authorization status.
  - verify: `TestInvariant_mcp_authorization_events_are_safe_correlation_only`
- AC9.2: The exact effective arguments occur only in the authoritative snapshot/model
  history and trusted audit storage. Client transcript/session projections redact the
  pending protected call just like its tool card, and arguments are absent from event
  logs, diagnostics, control responses, proto/SSE, ACP, and mecatui.
  - verify: `TestInvariant_pending_mcp_arguments_are_snapshot_private`
- AC9.3: The durable event grammar is ordered by authorization ID: `required` opens a
  marker and `resolved` closes it. `eventsource.Fold` returns
  `eventsource.ErrPrivateStateRequired` whenever any broker-authorized call requires the
  snapshot-only effective call; malformed order, duplicate/mismatched IDs, unresolved
  end-of-stream, or a resolution without its request fail closed rather than returning an
  executable Session.
  - verify: `TestSessionMCPAuthorization_Scenario9_EventFoldRequiresPrivateState`
- AC9.4: Authorization event records use `eventlog-json/2`; new readers accept the v1/v2
  read set and write v2 for the new protocol, while old v1-only readers reject at the
  format boundary. Authorizing snapshot state likewise rejects in an old restore switch
  before overwrite or execution.
  - verify: `TestSessionMCPAuthorization_Scenario9_MixedVersionFailsClosed`
- AC9.5: gRPC exposes unary `GetMCPAuthorizationPresentation` and server-streaming
  `RecheckMCPAuthorization`/`CancelMCPAuthorization`; HTTP exposes the exact counterparts
  `GET /v1/sessions/{id}/mcp-authorizations/{authorization_id}/presentation`,
  `POST ...:recheck`, and `POST ...:cancel`, with recheck/cancel responses relayed as SSE.
  Requests carry only session and authorization IDs. Unknown, foreign, mismatched,
  expired, or resolved targets map to gRPC NotFound / HTTP 404; malformed requests map to
  InvalidArgument / 400; a pending recheck emits the safe current required status then
  closes, while a winning recheck/cancel streams resolved and continuation events.
  - verify: `TestSessionMCPAuthorization_Scenario9_WireControlParity`
- AC9.6: Mecatui renders a distinct authorization state with only Open Browser, Recheck,
  and Cancel; it never renders permission Allow/Always/Deny controls for this state.
  - verify: `TestInvariant_mecatui_mcp_authorization_is_not_permission_approval`
- AC9.7: Reconnect replays safe status, fetches current authorization state, does not
  auto-open a replayed URL, and subscribes to the continuation events idempotently by
  authorization ID.
  - verify: `TestSessionMCPAuthorization_Scenario9_MecatuiReconnect`
- AC9.8: Existing permission ask events, approval controls, policy learning, approval UI,
  and awaiting restart behavior remain unchanged.
  - verify: `TestSessionMCPAuthorization_Scenario9_PermissionRegression`
- AC9.9: ACP handles authorizing state explicitly but remains presentation-ineligible; it
  receives ordinary paired errors rather than partial browser controls or no-result EOF.
  - verify: `TestSessionMCPAuthorization_Scenario9_ACPIsExplicitlyIneligible`

---

### Scenario 10 — Real configuration drives an observable protected MCP vertical

The final evidence starts from an administrator-owned settings file, not a hand-built
route slice. It crosses the real loader, command composition, ToolHive Runtime, public
control surface, and an actual Streamable HTTP MCP server. Tests remain offline per
[`AGENTS.md`](../../AGENTS.md); deployment and optional external evidence are separate
layers rather than substitutes for deterministic race coverage.

**Acceptance:**
- AC10.1: A hermetic aggregate test uses the real resolver/loader, `app.Build`, embedded
  ToolHive authserver/vMCP, local OAuth fixture, actual Streamable HTTP MCP server,
  scripted model, wire controls, and safe event projections to prove pending -> live
  presentation -> callback -> recheck -> exactly one protected request -> ordinary model
  completion.
  - verify: `TestSessionMCPAuthorization_Scenario10_ConfigDrivenVertical`
- AC10.2: A real mecak8s command-root test starts loopback TLS from a broker-mode settings
  file, reaches the mounted auth/callback/control handlers over HTTPS, and does not invoke
  Runtime callback methods directly from the test.
  - verify: `TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical`
- AC10.3: `STAGE3-RESULTS.md` records deterministic and command-root evidence and the
  one-protected-backend, reconnect, process-local, single-replica, event-source, upstream
  egress, and ToolHive lifecycle limitations without suppression.
  - verify: inspection — result claims and known limitations require review

## Optional deployment qualification

Kind/Helm packaging is not a numbered Stage 3 acceptance gate. After the required local
command-root vertical passes, an operator may attempt a one-replica disposable
qualification using the existing `deploy/mecak8s-vmcp` work as a starting point. Its
result belongs in `STAGE3-RESULTS.md` as PASS, FAIL, or BLOCKED and cannot substitute for
AC10.1–AC10.2.

A credible attempt must first define—not assume—the ToolHive release/API, a separate TLS
upstream OAuth fixture (the existing Dex fixture is caller identity only), callback
reachability and certificate trust, settings/Secret mounts, DNS/Redis/Kubernetes API/MCP
egress NetworkPolicies, a deterministic provider driver, and a real mecatui invocation or
an explicitly separate protocol-client proof. An optional external server journey follows
the same evidence discipline and remains outside `task test`.

## Intentional engine API additions

The planned core surface is additive: `session.StateAuthorizing`,
`session.PendingMCPAuthorization`, aggregate methods
`PauseForMCPAuthorization`, `PendingMCPAuthorization`,
`ClaimMCPAuthorization`, `AbortMCPAuthorization`, and
`InterruptMCPAuthorization`; neutral `tool.MCPAuthorizationRequired`; optional
`tool.DispatchSerial`; and `agent.RunOutcome`/
`agent.RunOutcomeAuthorizationParked` with a read-only Run accessor. Exact signatures
must preserve the behavior above, but existing `tool.Tool.Execute`, permission approval,
and unrelated public signatures do not change. Any smaller root-internal implementation
that avoids an exported addition is preferred and documented before `task api:update`.

Every exported addition is classified Added/minor in `engine/CHANGELOG.md` and
`engine/api/*.txt`; a changed/removed existing signature is outside this plan unless a
new reviewed ADR explicitly accepts the break.

## Out of scope

| Item | Defer-to | ADR / decision |
|---|---|---|
| Durable/shared multi-replica broker transactions and credentials | distributed broker stage | [ADR-0238](../adr/0238-configured-resumable-mcp-authorization.md) |
| Remote sidecar broker protocol and authentication | deployment/sidecar stage | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Second protected backend and reconnect after permanent `Disconnect` | ToolHive `ConnectUpstream` capability | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Required Kind/Helm qualification and browser ingress journey | optional deployment qualification / production deployment stage | [ADR-0238](../adr/0238-configured-resumable-mcp-authorization.md) |
| Production ingress, DNS, certificate, and Secret rotation qualification | production deployment stage | [ADR-0238](../adr/0238-configured-resumable-mcp-authorization.md) |
| Broad external-provider interoperability matrix | provider qualification stage | [ADR-0238](../adr/0238-configured-resumable-mcp-authorization.md) |
| ToolHive residual `httprc` goroutine remediation | upstream ToolHive | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |
| Another OAuth client/controller | excluded | [ADR-0237](../adr/0237-session-scoped-vmcp-broker.md) |

## Sequencing recommendation

Settle configuration parsing and Runtime construction before the aggregate/dispatch work,
because every later vertical must begin from real administrator input. Land the complete
`StateAuthorizing` aggregate and snapshot contract before exposing controls. Then add the
dispatch park, resolution linearization, wire/client surfaces, and finally the aggregate
command-root evidence. Optional Kind qualification follows only after the required plan is
green. Task decomposition remains `/plan-orchestrate`'s job.

## Definition of done

1. `task lint` and `task test` pass across the root and engine modules.
2. `task docs` regenerates `llms.txt` and passes the strict documentation/link gate.
3. `task api:check` passes; intentional engine additions are present in
   `engine/api/*.txt` and classified as Added in `engine/CHANGELOG.md`.
4. `task generate` leaves generated protobuf/configuration artefacts current.
5. `task ac-trace-strict` resolves every AC proof after this plan becomes `landed`.
6. `task site:build` passes and user-facing configuration/deployment behavior is covered
   in `user-docs/`.
7. `go run ./cmd/mecademo` still prints a complete offline session.
8. Every named test above is green and grep-locatable.
9. `docs/architecture.md`, `docs/architecture/extensibility.md`, and
   `docs/design/IMPLEMENTATION-NOTES.md` describe configuration mode, handler ownership,
   parked-Run lifecycle, authorization controls, eligibility, restart, and event-source
   limitations; ADR 0027 inventories every new long-lived resource.
10. `STAGE3-RESULTS.md` records required deterministic/command-root evidence and any
    optional Kind/external attempt with honest PASS/FAIL/BLOCKED outcomes.
11. The real configured vertical reaches exactly one protected HTTP MCP request after
    authorization and reaches zero for the restart-interrupted action.

## Deferred decisions and known risks

- **Single replica.** Broker mode is intentionally one-replica in Stage 3. A wrong-replica
  request cannot recover process-local transaction state; distributed custody needs a
  separate design.
- **Snapshot confidentiality.** The exact call arguments are private from clients/events,
  not encrypted by the session snapshot format. Session-store operators remain trusted.
- **Event-source fidelity.** A redacted event log cannot reconstruct the private pending
  call. Failing closed is intentional until a protected event-sourced private-state channel
  exists.
- **Upstream OAuth egress.** ToolHive owns the upstream OAuth client where no injection
  seam exists; Stage 3 must not claim controls it cannot enforce.
- **Browser topology.** The deterministic command-root fixture proves the configured
  route. Optional Kind evidence has explicit prerequisites; production ingress and
  certificate lifecycle remain separate qualification work.

## Exit criteria

When every point under *Definition of done* holds on the accumulator, this plan is
satisfied.
