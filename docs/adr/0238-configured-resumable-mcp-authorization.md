# ADR 0238 — Configured resumable MCP authorization

- Status: Proposed
- Date: 2026-08-27
- Scope: operator MCP authority mode, session-broker construction, durable authorizing state, and exact protected-call continuation
- Supersedes: none
- Superseded by: none

## Context

ADR 0237 established a root-internal ToolHive/vMCP Runtime with a fixed catalogue,
session-local wrappers, one protected upstream lineage, broker-owned credentials, and
explicit process/session lifecycle. Its Stage 2 proof deliberately stopped before
operator configuration, public controls, agent-loop suspension, durable pending state,
and client presentation.

The repository already has one strict operator-tier `mcp.servers` configuration and one
canonical loader for global Streamable HTTP MCP servers. Adding a separate broker profile
file would duplicate endpoint, OAuth-client, scope, and egress-policy vocabulary. Feeding
the same profile to both the global manager and broker would be worse: it would create two
authority paths and could let global credentials bypass session-scoped custody.

A protected broker call cannot be modeled as an ordinary tool error. It must suspend
after permission and PreToolUse but before the protected request, preserve the exact
effective call, survive client disconnect, and resume only after the Runtime independently
reports a connected transaction. Permission awaiting is not reusable: it accepts client
verdicts, learns policy, and can resume across process restart, while browser authorization
cannot accept a client success assertion and loses its Runtime transaction on restart.

Mecak8s is the primary broker deployment. It is process-headless but may be driven by an
attached interactive client, so presentation eligibility cannot be inferred from the
process headless flag. Runtime transactions are process-local, which also means the first
shipped broker deployment cannot honestly claim transparent multi-replica operation. The
approved Stage 3 planning discussion deliberately goes beyond the handover's minimum
prebuilt-Runtime allowance by requiring configuration-driven command-root construction and
local HTTPS callback hosting; it retains Kind/Helm packaging as optional qualification.

## Decision

### One configured MCP authority mode

Extend the existing operator-only `mcp:` section with a closed `mode` value:

- `global` selects the existing global MCP manager and direct OAuth controller;
- `broker` selects the session-scoped ToolHive/vMCP broker;
- the two modes are mutually exclusive for the whole `mcp.servers` list.

Omitted mode resolves to `broker` in mecak8s and `global` in mecated and embedded
mecatui; mecatequi rejects explicit broker mode as unsupported for an unattended root.
Programmatic composition receives an explicit root default rather than assigning semantics
to an unqualified empty value. An explicit value overrides a supported root default.
Project-tier `mcp:` remains ignored. Legacy `--mcp-server` and `MCP_<NAME>_TOKEN`
remain global-only and conflict with broker mode.

Global mode retains the existing `none`, `static_bearer`, OAuth credential, and
`mecated mcp login` behavior. Broker mode accepts anonymous profiles plus exactly one
OAuth-protected backend and rejects `static_bearer`. Broker OAuth reuses and validates the
shared issuer, client, scopes, refresh-intent, and network-policy vocabulary where the
Runtime can apply it, but forbids global credential identity/source fields (`profile`,
`principal`, and `credentials`) because a broker grant belongs to one session and remains
Runtime-private. This does not claim enforcement inside ToolHive's upstream OAuth client
where ToolHive exposes no HTTP injection seam.

The strict parser first captures one lossless MCP syntax value. After the command root
supplies its explicit default, one mode-specific validation pass either requires the global
OAuth fields or forbids them for broker OAuth. The canonical loader returns a tagged,
mutually exclusive global-or-broker result; it cannot represent both authority paths.
The existing resolver and canonical profile loader remain the only ingestion path. No
package reparses YAML, and `app.Build` never constructs both authority paths.

### Broker-only callback configuration

Broker-only options live under `mcp.broker`. The section has no `enabled` field; `mcp.mode`
selects the feature. The initial option is:

```yaml
mcp:
  mode: broker
  broker:
    callback_url: https://agent.example/v1/mcp/authorization/callback
```

`callback_url` is the exact trusted HTTPS redirect URI an administrator registers. It is
required only when broker mode contains an OAuth profile and rejected as inert
configuration in global mode. Composition validates it and derives the fixed same-origin
broker authorization routes from trusted configuration. Request `Host` and forwarded
headers never establish browser-facing authority.

Pending browser transactions use one fixed, documented expiry in the initial release.
Expiry is a security/resource bound and appears in safe status, but is not an operator knob
until a demonstrated operational need justifies one.

### Process-owned Runtime and fixed routes

Supported serving roots construct one process-owned Runtime and one root-internal handler
bundle from broker-mode operator configuration. `app.Built` owns the bundle and its
cleanup; mecated and mecak8s mount its fixed public ToolHive authorization/vMCP/callback
routes separately from owner-authenticated application controls. Startup discovers the
fixed ToolHive tool definitions, compiles private routes, and fails before serving on
unsupported auth, failed protected pre-authorization discovery, duplicate/colliding tools,
or a second protected backend. Broker profiles never enter the global manager, global
direct OAuth controller, or global credential store.

The callback is `GET` only. It accepts exactly one percent-decoded `code` and one
`state`, each non-empty and at most 8 KiB, plus at most one non-empty percent-decoded
`scope` at most 8 KiB. `scope` is accepted only for ToolHive OAuth callback compatibility
and is ignored entirely: it never reaches Runtime, authority resolution, persistence,
responses, diagnostics, traces, metrics, or access logs. Duplicate, missing, unexpected,
malformed, body-bearing, empty, or oversized input receives the same generic HTTP 400.
Success returns HTTP 200 with a fixed text response. Every response sets
`Cache-Control: no-store` and `Referrer-Policy: no-referrer`; there is no callback redirect.
The handler never reflects code, state, scope, or browser URL in responses, diagnostics,
traces, metrics, or access logs. Callback input cannot select a session, owner, backend,
issuer, client, authority scope, or MCP endpoint. A browser denial that supplies no code
remains pending until explicit client cancel or expiry. Session tools close before the
Runtime; Runtime construction participates in normal `app.Build` rollback.

A remotely reachable broker control plane requires verified caller identity and ownership
enforcement. Ownerless controls are permitted only in an explicitly local/loopback
single-user composition.

A durable, non-secret broker enrollment/configuration identity marks sessions that require
broker-aware rehydration. Missing or incompatible reconstruction fails loudly and never
falls back to the shared/global catalogue.

### Distinct durable authorizing state

Add nonterminal `StateAuthorizing` and a separate private
`PendingMCPAuthorization`. Do not overload `StateAwaiting`, `PendingAsk`, approval verdicts,
or policy learning.

The aggregate invariant is:

```text
StateAwaiting    iff PendingAsk exists
StateAuthorizing iff PendingMCPAuthorization exists
all other states have neither
both pending values can never coexist
```

The pending value deep-copies the exact post-PreToolUse `ToolCall`, the ordered suffix of
later sibling calls that dispatch has not executed, authorization ID, safe backend label,
expiry, and minimum non-secret route/configuration provenance. Results completed before
that call are durable before entry. Aggregate methods exclusively enter authorizing, claim
a connected continuation, abort with paired synthetic results, and interrupt after
restart. Claim/abort returns to running and produces one ordered `RecordToolResults` input:
the pending call's real/synthetic result followed by one deterministic synthetic result
for each deferred sibling. Generic completion, failure, cancellation, abandonment, and
reset paths cannot erase the unmatched state.

While authorizing, new prompts, steer, mode changes, rehome, fork/carryover, adoption,
compaction, history replacement, usage reset, and other operations that could alter the
frozen call are rejected before mutation. The only temporarily unmatched history is the
exact pending call and explicitly tracked later siblings.

### Durable park before presentation

The execution order remains:

```text
permission -> PreToolUse -> broker Connect
```

If Connect reports pending, the engine transitions to authorizing and the authoritative
snapshot save must succeed before emitting `mcp.authorization.required`. The required
event contains safe correlation only and never the browser URL or call arguments. The
current transport Run then ends with exported `agent.RunOutcomeAuthorizationParked`, not a
`session.StopReason` and not an `EvResult`; relays treat that outcome as expected,
deregister only the Run, leave the Session nonterminal, and keep the Service-owned
`heldLeases` entry and renewer alive. Client disconnect after durable park therefore does
not cancel the authorization.

If saving fails after Connect, the exact Runtime transaction is invalidated and the
original run records one ordinary paired error. A client never receives a handle that has
no durable session correlation.

For a multi-tool assistant turn, results completed before the suspending call are recorded
once before authorizing. The pending call is exact; later siblings do not execute and are
paired deterministically on successful or terminal resolution. Exact call ID, never a tool
name fallback, selects the continuation.

Protected broker tool-card and client transcript/session projections omit arguments. The
effective call remains available to the model conversation, trusted session snapshot, and
trusted audit storage, but not to durable events, controls, diagnostics, ACP, or UI
projections.

### Presentation, callback, and exact continuation

MCP authorization uses separate owner-authorized controls. The public operation is cancel;
there is no separate OAuth-deny verdict:

- unary `GetMCPAuthorizationPresentation` validates the owning loaded session and exact
  pending handle, then returns the Runtime's current live URL;
- server-streaming `RecheckMCPAuthorization` asks Runtime Connect and resumes only on
  `ConnectionConnected`;
- server-streaming `CancelMCPAuthorization` resolves status `cancelled`, invalidates the
  exact pending transaction, permits a later fresh attempt, and never calls permanent
  `Disconnect`;
- a service-owned expiry worker resolves the pending call at the fixed expiry;
- callback accepts only broker-created code/state and independently commits Runtime state.

HTTP supplies exact GET-presentation and POST-recheck/cancel counterparts beneath
`/v1/sessions/{id}/mcp-authorizations/{authorization_id}`; the two mutating responses are
SSE. Requests carry only session and authorization IDs. Unknown, foreign, mismatched,
expired, and resolved targets are externally NotFound/404; malformed input is
InvalidArgument/400. Pending recheck emits safe current status and closes. A winning
recheck/cancel streams resolved and continuation events. Authorization status is a closed
vocabulary: `pending` appears only on required/current status; resolved events use
`connected`, `cancelled`, `expired`, `interrupted`, `failed`, or `closed`. A protected tool
failure after a connected claim remains an ordinary ToolResult/Run failure and does not
rewrite the authorization status.

The service linearization is owner authorization, keyed `runEntryMu`, acquire/confirm the
session lease, reload/validate the snapshot, perform the bounded Runtime state operation,
claim the aggregate resolution and save it, register the continuation Run, then release
the lock. The connected claim is the durable **no-retry boundary**: it moves to
`StateRunning`, clears the private pending authorization, and guarantees that no later
process will replay the protected request. If continuation registration fails in-process,
the service immediately uses the running-state abandonment repair and persists paired
synthetic results. If the process crashes after the claim save but before or during
execution, the ordinary lease-gated `StateRunning` crash recovery pairs every unanswered
call and never retries it. Thus the narrow claim-to-execute window may lose an execution,
but cannot duplicate one or leave a permanently unmatched history.

Cancel, expiry, close, and restart use the same critical section. No lock is held while
`Tool.Execute`, callback token exchange, or client streaming runs. A loser observes
non-authorizing/claimed state and performs no Runtime or tool side effect.

Runtime itself tracks the exact handle through pending, callback-claimed, cancelled,
expired, and connected states. Exact-handle cancellation has an adapter linearization
point that prevents a cancel/expiry/close winner from later exchanging a code, installing
a grant, or restoring a transaction.

The client cannot send an OAuth code, token, success assertion, backend selection, or
permission verdict. After a connected resolution claim is durably persisted, the engine
executes the stored effective call exactly once without rerunning permission or
PreToolUse. PostToolUse, audit recording, ordinary ToolResult recording, and model
continuation run once.

### Restart and event-source behavior

The original process retains the session lease while authorizing. Runtime transactions and
grants do not survive process loss. After the lease becomes available, the first exclusive
successor records one interruption-accurate paired result and returns the session to a
recoverable state without calling Runtime Connect or executing the old action. A new
Runtime with the same configured backend is not proof of continuity.

The session snapshot is authoritative for the private pending call. Durable event grammar
uses authorization ID: `required` opens a marker and `resolved` closes it. Because safe
events cannot reconstruct the effective arguments, `eventsource.Fold` returns
`eventsource.ErrPrivateStateRequired` for a broker-authorized call whose snapshot-only
state is required, including malformed ordering, duplicate/mismatched markers, and an
unresolved end-of-stream. It never ignores the event and returns an executable idle
session.

Authorization event records introduce `eventlog-json/2`: new readers accept the v1/v2
read set and write v2 for the new protocol; old v1-only readers reject at the format
boundary. Authorizing snapshot state likewise reaches the existing unknown-state failure
of an old restore switch before overwrite or execution.

### Eligibility, read-only semantics, and deployment bound

A trusted per-run capability established by the wire handler permits a remotely attached
main client to park even on process-headless mecak8s. ACP, scheduled, detached/background,
child, Parallel, Team, and other unattended runs never park or create a transaction; they
receive a bounded ordinary paired tool error.

Broker dispatch serialization is separate from semantic read-only classification. Each
wrapper continues to report the configured tool's real `ReadOnly()` value for permission
and plan-mode behavior, while broker calls are scheduled serially relative to sibling
broker calls. Unrelated non-broker read-only calls remain parallel.

Broker-mode mecak8s is operationally single-process/single-replica in this stage. Session
leases fail closed and the existing Service-owned lease renewer remains alive after a Run
parks, but a lease does not make process-local Runtime transactions available on another
pod. A non-holder returns leased-elsewhere without interrupting or rechecking while the
holder is live. Required acceptance stops at the real local command-root HTTPS vertical;
Kind/Helm packaging is optional qualification with explicit prerequisites, not a completion
gate. Durable/shared broker custody is a later decision.

## Consequences

Administrators use one MCP configuration vocabulary and make one authority choice. Mecak8s
gets session-broker isolation by default, while an explicit global mode preserves existing
deployments. The browser flow becomes observable and reconnectable without teaching the
model OAuth or exposing credentials.

The cost is a new nonterminal aggregate state with broad lifecycle consequences, a new
expected no-result Run outcome, mode-dependent OAuth validation, command-root handler
composition, an expiry worker, and explicit snapshot/event asymmetry. The engine exported
surface grows and requires compatibility accounting. Broker-mode mecak8s gives up
multi-replica operation until transaction custody is durable or remotely owned.

Exact call arguments remain plaintext in trusted session snapshots. They are private from
clients and event logs, not encrypted by this decision. ToolHive's upstream OAuth client
also remains outside controls mecatl cannot inject, and its observed residual goroutines
remain an upstream limitation rather than a test exclusion.

## See also

- [Configured resumable MCP authorization acceptance plan](../acceptance/session-vmcp-authorization.md)
- [ADR 0237 — session-scoped vMCP broker](./0237-session-scoped-vmcp-broker.md)
- [ADR 0113 — operator-configured MCP authentication profiles](./0113-operator-mcp-auth-profiles.md)
- [ADR 0027 — cloud-native resource and fidelity inventory](./0027-cloud-native.md)
- [ADR 0020 — diagnostics](./0020-diagnostics.md)
- [Architecture: session-scoped vMCP broker](../architecture.md#session-scoped-vmcp-broker-stage-2-integration-proof)
- [Extensibility: MCP](../architecture/extensibility.md)
