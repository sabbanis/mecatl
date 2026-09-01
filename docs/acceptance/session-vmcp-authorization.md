# Configured resumable MCP authorization — acceptance plan

**Phase:** capability — operator-configured session broker and resumable MCP authorization
**Status:** in-progress, 2026-08-31. Synthesized from the Stage 3 handover, the accepted configuration discussion, the completed five-axis `StateAuthorizing` review, and the bundled workspace-enrollment amendment.
**ADR:** [ADR-0246](../adr/0246-configured-resumable-mcp-authorization.md) — one MCP authority mode, durable authorizing state, and exact continuation; [ADR-0247](../adr/0247-broker-generic-oauth2-upstreams.md) — broker-only explicit generic OAuth2 upstreams; [ADR-0248](../adr/0248-bundled-mcp-workspace-enrollment.md) — pre-prompt bundled enrollment and authenticated frozen catalogues.
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
- [ADR-0245](../adr/0245-session-scoped-vmcp-broker.md) fixes the original Stage 2
  boundary: stable session-local tools, one protected lineage, broker-owned credentials, and
  no ToolHive/OAuth types in the engine. ADR 0248 extends protected-backend cardinality only
  through all-or-nothing pre-prompt bundled enrollment.
- [ADR-0027](../adr/0027-cloud-native.md) requires every process/session resource and
  restart-fidelity decision to be inventoried. The browser transaction and expiry
  worker are process-local; the exact pending call is snapshot state.
- [`AGENTS.md`](../../AGENTS.md) requires aggregate-owned session mutation, durable
  event-log persistence at the relay, explicit run-entry recovery, read-parallel /
  mutate-serial dispatch, and engine API compatibility accounting.

## In scope — 11 scenarios, in implementation order

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
value rather than another operator knob. Protected upstreams default to OIDC discovery.
A broker-only generic OAuth2 upstream instead supplies exact HTTPS authorization and token
endpoints and forbids `issuer`; global/direct MCP rejects this selector and remains
unchanged. For example, GitHub remote MCP uses the following protocol shape (the client ID,
scopes, and registered callback remain operator-specific):

```yaml
mcp:
  mode: broker
  broker:
    callback_url: https://agent.example/v1/mcp/authorization/callback
  servers:
    - name: github
      url: https://api.githubcopilot.com/mcp/
      auth:
        mode: oauth
        oauth:
          upstream:
            mode: oauth2
            oauth2:
              authorization_endpoint: https://github.com/login/oauth/authorize
              token_endpoint: https://github.com/login/oauth/access_token
          client:
            mode: preregistered
            preregistered:
              id: mecatl-github-mcp
              secret_env: MECATL_GITHUB_MCP_CLIENT_SECRET
          scopes: [repo]
          network: {}
```

Explicit OAuth2 accepts only `network: {}`: non-empty `additional_origins` or
`private_origins`, and non-zero `max_redirects`, are rejected because ToolHive's upstream
client cannot enforce them. This fail-closed rejection replaces any claim that those
controls apply. OIDC remains the default and the process-local broker limit remains. The
original proof admitted one protected backend; Scenario 11 replaces that cardinality limit
with ToolHive's deterministic all-or-nothing bundled chain
([ADR-0248](../adr/0248-bundled-mcp-workspace-enrollment.md)).

**Acceptance:**
- AC1.1: An omitted `mcp.mode` resolves to `broker` in `mecak8s` and `global` in
  `mecated` and embedded `mecatui`; `mecatequi` rejects explicit broker mode as an
  unsupported unattended root. Programmatic composition receives an explicit root default,
  and an explicit supported-root mode overrides it.
  - verify: `TestSessionMCPAuthorization_Scenario1_RootModeDefaults`
- AC1.2: Global mode preserves byte-compatible `none`, `static_bearer`, OAuth
  credential, and `mecated mcp login` behavior, and constructs no broker Runtime.
  - verify: `TestSessionMCPAuthorization_Scenario1_GlobalModeCompatibility`
- AC1.3: Broker mode consumes the whole server list exclusively, accepts anonymous and
  OAuth profiles, rejects `static_bearer`, and never constructs a global MCP manager or
  direct `OAuthController` for those profiles. Multiple OAuth profiles are admitted only
  through Scenario 11's bundled pre-prompt enrollment contract.
  - verify: `TestSessionMCPAuthorization_Scenario1_BrokerModeIsExclusive`
- AC1.4: Broker OAuth defaults to OIDC discovery and reuses the existing client, scopes,
  refresh-intent, and network-policy vocabulary where the Runtime can apply it. Broker-only
  generic OAuth2 requires exact HTTPS authorization/token endpoints, forbids `issuer`, and
  rejects non-empty additional/private origins or non-zero redirect limits because ToolHive
  cannot enforce them. Global/direct MCP rejects the upstream selector and remains unchanged.
  Global credential identity/source fields (`profile`, `principal`, and `credentials`) are
  rejected in broker mode and remain required in global OAuth mode. Configuration and docs
  never claim enforcement inside ToolHive's non-injectable upstream OAuth client.
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
- AC1.8: The generated settings skeleton, configuration reference, usage guide, and user
  documentation show the root defaults, callback condition, bundled protected enrollment,
  one-process/one-replica limit, and the explicit `mcp.mode: global` migration for existing
  mecak8s deployments.
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
uses the declarations to discover anonymous ToolHive definitions, compile private routes,
and construct one process-owned Runtime plus a root-internal HTTP handler bundle. Protected
backends never contribute startup definitions: after Scenario 11's complete bundled
enrollment, authenticated provider-scoped discovery is their sole catalogue source. Static
protected declarations remain parseable comparison data only. `app.Built` owns that bundle
and its cleanup; supported command roots mount its fixed public auth/vMCP/callback routes
separately from owner-authenticated application controls. Broker profiles never enter the
global credential lifecycle
([`architecture.md` — session-scoped broker](../architecture.md#session-scoped-vmcp-broker-stage-3-command-root-proof)).

**Acceptance:**
- AC2.1: A real operator settings file flows through `Resolver.OperatorMCP()` and the
  canonical profile loader into one broker construction; no package reparses YAML or
  reads project configuration for broker authority.
  - verify: `TestSessionMCPAuthorization_Scenario2_SettingsConstructBroker`
- AC2.2: Startup eagerly discovers anonymous backends, compiles their private routes, and
  fails before serving on an unconfigured discovery result, duplicate tool, unsupported auth
  mode, or failed eager discovery. Protected backends perform no startup discovery and admit no
  static definitions; they remain unavailable until Scenario 11 completes authenticated
  provider-scoped discovery.
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
([ADR-0245](../adr/0245-session-scoped-vmcp-broker.md)).

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
the continuation ([ADR-0246](../adr/0246-configured-resumable-mcp-authorization.md)).

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
  egress, and ToolHive lifecycle limitations of the original Scenario 10 proof without
  suppression. It does not qualify the later bundled-enrollment amendment.
  - verify: inspection — result claims and known limitations require review

---

### Scenario 11 — Bundled protected workspace enrollment

Anonymous MCP backends retain the existing eager startup discovery path. When a session has
multiple OAuth-protected backends, its owner uses one client-owned **Connect workspace
services** operation before prompt input is available. This enrollment is neither permission
approval nor a model-selected `ToolCall`; because no protected tool has been discovered or
called, it does not reuse `PendingMCPAuthorization` or `StateAuthorizing`. ToolHive drives all
configured protected backends as one deterministic bundled consent sequence
([ADR-0248](../adr/0248-bundled-mcp-workspace-enrollment.md)).

Every protected backend must connect before authenticated discovery starts. The broker builds
one ToolHive `UpstreamRunConfig` per protected profile in configured order; the first
protected provider is ToolHive's bundle identity anchor. Adapter-private DNS-label provider
keys are collision-checked and bind each vMCP backend's `UpstreamInject.ProviderName` to its
own credential without changing model-visible tool names. Anonymous routes remain eagerly
discovered, while every protected backend is left untouched at startup and its routes remain
deferred regardless of optional static `auth.oauth.tools` comparison data.

After the complete consent chain succeeds, the broker calls ToolHive's provider-scoped
`QueryCapabilities(ctx, backend)` separately for every protected backend. It never uses
`QueryAllCapabilities`, whose partial-failure behavior cannot prove all-or-nothing admission.
All authenticated candidate definitions are staged, validated, and collision-checked before one
session-local multi-backend catalogue is atomically admitted and frozen; they are the sole
admitted protected definitions. Denial, cancellation, expiry, restart, process loss, refresh
failure, malformed discovery, or a tool-name collision admits no partial protected catalogue or
executable protected route. A restart replays neither grants nor the catalogue and requires fresh
bundled enrollment.

A process-owned cancelable context bounds ToolHive incoming-auth/JWKS work and is cancelled
only after vMCP and authserver shutdown. Independent per-backend connect, retry, and cancel
remain deferred because ToolHive exposes only the bundled chain. Static protected `tools:`
remains optional parseable compatibility/comparison data but is never a definition source and
cannot alter authenticated name, schema, description, or read-only metadata. A bootstrap-discovery
CLI is deferred. The supported Stage 3 deployment remains one process and one replica. Task 09 Mode A remains valid. Its Mode B becomes a
one-provider live qualification of this scenario only after Task 12; the already-recorded
GitHub run predates Scenario 11 and is not evidence that bundled enrollment passed.

**Acceptance:**
- AC11.1: Before the first tool-enabled prompt, only the authenticated session owner can
  start the single **Connect workspace services** operation. The operation is rejected unless
  the session is idle and unprompted with no run, pending enrollment, permission approval, or
  tool authorization; it creates neither `PendingMCPAuthorization` nor `StateAuthorizing`.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ConnectRequiresOwner`
- AC11.2: One owner-bound bundled operation has one terminal outcome. Denial, bundle-wide
  cancellation, expiry, process loss, refresh failure, or failure from any protected backend
  clears all protected admission state and leaves no visible or executable protected route.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AllOrNothing`
- AC11.3: Every configured protected profile produces one ToolHive
  `authserver.UpstreamRunConfig` in stable configured order, with the first protected provider
  documented and tested as the bundle identity anchor.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_MultiUpstreamConstruction`
- AC11.4: Every profile maps to a collision-checked adapter-private DNS-label ToolHive
  provider key, and each backend's `UpstreamInject.ProviderName` selects only its matching
  credential while model-visible namespaces remain unchanged.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ProviderNameMapping`
- AC11.5: Broker startup performs no anonymous `initialize` or `tools/list` against any
  protected backend, regardless of optional static configuration; a 401-capable protected
  upstream therefore cannot prevent process startup, and its route stays deferred.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ProtectedStartupSkipsAnonymousDiscovery`
- AC11.6: ToolHive incoming-auth/JWKS work uses one process-owned cancelable context; process
  close stops vMCP, closes authserver, then cancels that context without a goleak exclusion.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AuthContextStopsOnProcessClose`
- AC11.7: Anonymous backends retain eager startup discovery and executable routes unchanged
  while protected routes remain deferred until bundled enrollment succeeds.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AnonymousCompatibility`
- AC11.8: After ToolHive reports the complete chain connected, each protected backend is
  queried separately through provider-scoped authenticated `QueryCapabilities(ctx, backend)`;
  `QueryAllCapabilities` is never used.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AuthenticatedDiscovery`
- AC11.9: Tool name, schema, description, and read-only metadata are validated for every
  candidate; collision or malformed/failing discovery against any protected, anonymous, or
  global tool rejects the complete protected candidate set. On success, the session's durable
  capability set admits exactly the frozen protected tool names before prompting without
  widening filesystem, direct-write, delegation-depth, provenance, or definition identity.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_DiscoveryFailsClosed`,
    `TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical`
- AC11.10: After process loss or restart, a session exposes no prior protected grant,
  catalogue, or executable route and requires fresh complete bundled enrollment.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_RestartRequiresEnrollment`
- AC11.11: Static protected `tools:` declarations remain parseable comparison data only. They
  never enter protected `Process`/`Runtime` catalogue construction and cannot replace or alter
  the authenticated discovered name, schema, description, or read-only metadata.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_StaticCandidatesStayConfigurationOnly`,
    `TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical`
- AC11.12: Mecatui renders workspace enrollment separately from permission approval, offers
  no Allow/Always/Deny controls for it, and exposes no OAuth secret, browser URL, callback
  data, code, state, verifier, token, backend-private provider key, or private user data.
  - verify: `TestInvariant_mecatui_workspace_enrollment_is_not_permission_approval`
- AC11.13: In a deterministic two-protected-backend vertical on one process/replica, the real
  ToolHive bundled chain completes in configured order, provider-scoped
  `QueryCapabilities` discovers both candidates, the complete catalogue freezes, and one
  safe tool from each backend executes only afterward.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical`
- AC11.14: Prompt input remains unavailable throughout incomplete enrollment; duplicate,
  stale, foreign-owner, and independently targeted backend controls fail closed without
  admitting a partial catalogue or selecting a different backend.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ClientControlsFailClosed`

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
`InterruptMCPAuthorization`; `session.Session.AdmitAuthorityTools` for the pre-first-turn,
tool-only authority extension after authenticated workspace discovery; neutral
`tool.MCPAuthorizationRequired`; optional
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
| Durable/shared multi-replica broker transactions and credentials | distributed broker stage | [ADR-0246](../adr/0246-configured-resumable-mcp-authorization.md) |
| Remote sidecar broker protocol and authentication | deployment/sidecar stage | [ADR-0245](../adr/0245-session-scoped-vmcp-broker.md) |
| Independent per-backend connect, retry, and cancel; reconnect after permanent `Disconnect` | targeted ToolHive upstream controls | [ADR-0248](../adr/0248-bundled-mcp-workspace-enrollment.md) |
| Bootstrap-discovery CLI for generating curated static protected `tools:` | later operator tooling | [ADR-0248](../adr/0248-bundled-mcp-workspace-enrollment.md) |
| Required Kind/Helm qualification and browser ingress journey | optional deployment qualification / production deployment stage | [ADR-0246](../adr/0246-configured-resumable-mcp-authorization.md) |
| Production ingress, DNS, certificate, and Secret rotation qualification | production deployment stage | [ADR-0246](../adr/0246-configured-resumable-mcp-authorization.md) |
| Broad external-provider interoperability matrix | provider qualification stage | [ADR-0246](../adr/0246-configured-resumable-mcp-authorization.md) |
| ToolHive residual `httprc` goroutine remediation | upstream ToolHive | [ADR-0245](../adr/0245-session-scoped-vmcp-broker.md) |
| Another OAuth client/controller | excluded | [ADR-0245](../adr/0245-session-scoped-vmcp-broker.md) |

## Sequencing recommendation

Settle configuration parsing and Runtime construction before the aggregate/dispatch work,
because every later vertical must begin from real administrator input. Land the complete
`StateAuthorizing` aggregate and snapshot contract before exposing controls. Then add the
dispatch park, resolution linearization, wire/client surfaces, and the aggregate
command-root evidence. Then land bundled enrollment, authenticated frozen discovery, and the
mecatui two-backend vertical in that dependency order. Optional Kind qualification follows
only after the relevant deterministic plan is green. Task decomposition remains
`/plan-orchestrate`'s job.

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
11. The original configured vertical reaches exactly one protected HTTP MCP request after
    authorization and reaches zero for the restart-interrupted action.
12. Scenario 11's two-backend vertical admits and freezes the complete protected catalogue
    only after bundled enrollment, then executes one safe tool from each backend.

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
