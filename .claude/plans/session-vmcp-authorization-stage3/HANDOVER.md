# Handover — Stage 3 resumable MCP authorization

**Worktree:** `/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3`  
**Branch:** `handover/session-vmcp-authorization-stage3`  
**Base:** `acc/session-vmcp-broker` at `b1beea974`  
**Purpose:** turn the accepted Stage 3 design into an acceptance plan, then implement it through the acceptance-plan spine. This handover is not itself the acceptance plan.

## Read this first

Stage 2 is a useful and coherent **root-internal broker proof**, but its own result document deliberately says **NO-GO for shipping Stage 3 conversation integration as-is**. Do not interpret the existence of `internal/adapter/vmcpbroker.Runtime` as an operator-accessible broker.

The Stage 3 planner must reconcile all of these sources:

1. `STAGE2-RESULTS.md` — honest evidence and limitations at the accumulator tip.
2. `docs/acceptance/session-vmcp-broker.md` — Stage 2 contract and exclusions.
3. `docs/adr/0284-session-scoped-vmcp-broker.md` — frozen Stage 2 boundary.
4. `internal/adapter/vmcpbroker/runtime.go` — the executable API, not an older design sketch.
5. The accepted twenty-point Stage 3 contract reproduced below.

Create a **new ADR** for the new authorizing state and continuation protocol. Do not rewrite ADR 0237 in place.

## Audit of the Stage 2 deliverable

### What exists and should be extended

At `b1beea974`, Stage 2 provides:

- `vmcpbroker.Runtime` with process-local `OpenSession`, `Connect`, `Disconnect`, `Callback`, `ForgetSession`, and `Close` operations.
- `ConnectResult{Status, AuthorizationRequired}` where a pending result contains an opaque handle, browser URL, and expiry; a completed transaction reports `ConnectionConnected`.
- Stable session-local `tool.Tool` wrappers whose private `Route` carries `BackendID`, declared tool spec, `ReadOnly`, and `Protected`.
- One protected ToolHive upstream lineage plus anonymous routes, downstream bearer refresh, callback replay protection, tombstones, close ordering, and secret-containment tests.
- Real in-process ToolHive authserver/vMCP evidence and a manual public documentation MCP smoke, both recorded in `STAGE2-RESULTS.md`.
- A server-side canonical-ID reservation seam: `server.Config.VMCPBroker`, `Service.openBrokerSession`, `server.VMCPBrokerTools(ctx)`, and per-session catalogue mounting through `assembleCatalog`.
- Broker/global MCP collision rejection and per-session lifecycle tests.

Preserve these boundaries:

- ToolHive, OAuth, broker, and Kubernetes types remain out of `engine/` and `engine/port`.
- The model sees an ordinary fixed MCP tool catalogue and never supplies `BackendID`.
- Credentials, callback code, verifier, `tsid`, client secret, signing/storage keys, and bearer values remain adapter-private.
- The global MCP manager, direct-MCP `OAuthController`, Ozz lifecycle, and global `MCP_<NAME>_TOKEN` path remain separate.
- Only streaming HTTP is supported; never add stdio MCP.

### What does not exist yet

The handover must not hide these gaps:

1. **No default production construction.** `app.Config` can receive a prebuilt `VMCPBroker`, but `app.Build` does not construct one from operator configuration and no command root activates it. Stage 2's app/server tests inject a Runtime.
2. **No public trusted control surface.** There is no RPC/HTTP/mecatui flow for presentation, recheck, cancellation, or callback hosting.
3. **No agent-loop interruption.** An unconnected protected wrapper currently returns the ordinary model-visible ToolResult text `authorization required for this broker tool`; it does not call `Connect`, return a typed control signal, park, or replay.
4. **No durable authorizing state.** Runtime transactions and grants are intentionally process-local.
5. **Rehydration is incomplete for broker sessions.** Broker presence forces new sessions through the per-session factory, but the loaded-session rebuild path does not reopen broker session wrappers before `SessionEngine` runs. A restarted default session must never silently fall back to the shared/global catalogue.
6. **The browser callback is an internal method.** `Runtime.Callback(code, state)` is proven in-process; Stage 5 will own production sidecar/Kind callback hosting. Stage 3 must not claim a deployed browser journey unless it actually adds and secures such a host.
7. **One protected backend only.** Reconnect after `Disconnect` and a second protected backend return `ErrUnsupportedCapability`; Stage 3 must retain this honest limit.
8. **Upstream lifecycle finding remains open.** ToolHive v0.45.0 left seven `httprc/v3` goroutines in the manual post-close capture. Do not suppress it with a goleak exclusion.
9. **`Disconnect` is not pending-flow cancellation.** It deletes the transaction and marks the protected target permanently disconnected; later `Connect` returns the explicit missing-`ConnectUpstream` limitation. Stage 3 cancel/deny must not accidentally consume the session's one supported OAuth lineage.

### Stage 2/design corrections that Stage 3 must carry forward

- The old phrase “use a fake authorizer; no OAuth protocol yet” means: use fakes for deterministic loop/state tests and do not add OAuth protocol code. Production integration must use the existing Stage 2 Runtime; it must not create a second authorizer.
- Stage 3 does not receive a bearer from `Connect`. Stage 2 keeps downstream access/refresh inside the session transport. Stage 3 waits for `ConnectionConnected`, then executes the already-mounted wrapper.
- Stage 2 already supplies the exact opaque pending handle and expiry. Reuse them as the public authorization correlation; do not invent a second attempt lineage.
- `Runtime.Connect(session, backend)` is idempotent/singleflight for a pending target. It can also re-fetch the current pending URL. This is the natural basis for live presentation and recheck.
- Because the durable event log records every `session.Event`, the browser URL **must not be a durable event field**. Emit safe correlation/backend/expiry, then let an owner-authorized control request call `Connect` and return the current live URL only after matching the pending handle.
- The persisted pending marker must contain the exact post-PreToolUse effective `ToolCall`, including its private arguments, because exact continuation requires it. Those arguments must never be projected into events, diagnostics, control responses, or client UI. “No client-visible arguments” does not mean “discard arguments from the private snapshot.”
- Add a narrow exact-handle pending-transaction cancellation operation if cancellation must permit a later retry. Do not implement authorization cancellation by calling `Disconnect`, because the Stage 2 Runtime deliberately makes a disconnected protected backend non-reconnectable.

## Accepted Stage 3 contract

Stage 3 answers:

> Can a concrete protected MCP tool call pause before any protected request is sent, survive client disconnect, and resume exactly once after broker authorization resolves?

It is done only when all of the following are proven:

1. Brokered main-session tools execute through ordinary `Tool.Execute`.
2. Permission and PreToolUse run before broker `Connect`.
3. A typed safe control error is intercepted before generic error handling.
4. Session transitions `running -> authorizing` with one `PendingMCPAuthorization`.
5. No ToolResult is recorded while authorization is pending.
6. Typed required/resolved events carry only safe correlation; presentation URL is live-only.
7. Mecatui may open the browser, recheck, or cancel; it never approves OAuth.
8. Broker callback completion is broker-owned; the client triggers a server recheck.
9. The service resumes only when `Runtime.Connect` reports `ConnectionConnected`.
10. The exact post-hook effective call executes once without rerunning permission or PreToolUse.
11. PostToolUse and ordinary result recording run once.
12. Deny/cancel/expiry/failure record one synthetic paired ToolResult.
13. Client disconnect/reconnect may resume the same still-live authorization.
14. Process restart resolves the pending call as `INTERRUPTED` and never auto-executes it.
15. Child, parallel, team, scheduled, background, and headless runs never park; they receive a bounded ordinary tool error.
16. Brokered calls are serialized; a session has at most one pending MCP authorization.
17. Snapshot/event/control surfaces expose no URL-at-rest, token, code, verifier, `tsid`, secret, or client-visible arguments.
18. Permission awaiting/approval behavior remains unchanged.
19. Stores, event folding, inventory, retention, service/proto/mecatui/ACP, and engine API baselines handle `StateAuthorizing` explicitly.
20. Mixed-version shared-store behavior is documented as fail-closed.

## Required flow and linearization

Keep the existing gate order:

```text
permission
  -> PreToolUse
  -> broker Connect
  -> [Connected: Execute -> PostToolUse -> record result]
  -> [Pending: persist exact effective call -> StateAuthorizing -> emit required]
```

Successful continuation:

```text
client receives required correlation
  -> owner-authorized presentation lookup calls Connect
  -> client opens returned live URL
  -> broker callback completes independently
  -> client sends recheck for session + authorization id
  -> service validates loaded session/pending owner, call, backend, id, expiry
  -> Connect reports Connected
  -> one resume transition wins
  -> execute stored effective call once
  -> PostToolUse once
  -> record one ToolResult
  -> continue the ordinary run loop
```

Terminal continuation:

```text
deny | cancel | expiry | session close | restart interruption
  -> one resolution transition wins
  -> cancel broker transaction when a live Runtime is available
  -> record one synthetic error result paired to the original call
  -> never send the protected MCP request
  -> later duplicate recheck/cancel is an idempotent refusal
```

Do not rerun permission or PreToolUse after the browser pause. Their effective call is the operation the user authorized. Do not automatically retry a mutating MCP request after it has entered `Execute`; the interruption point must remain before the protected send.

## Architecture constraints for the acceptance plan

### Neutral typed control signal

Do not widen `Tool.Execute` for one suspension family. Define a small engine-owned neutral error/value type in an inward package already imported by the adapter and dispatcher. It may carry only:

- opaque authorization ID;
- safe configured backend label;
- expiry.

It must not carry browser URL, ToolHive type, arguments, credentials, or upstream response data. Returning it will be an exported engine API addition, so update the appropriate `engine/api/*.txt` and `engine/CHANGELOG.md` according to `engine/COMPATIBILITY.md`.

The Stage 2 wrapper should invoke `Runtime.Connect` only after the dispatcher has completed permission and PreToolUse. If pending, adapt the Runtime result to this neutral control signal. If connected, continue through the existing caller. Headless/non-main posture must convert pending into a bounded ordinary ToolResult rather than park.

### Session aggregate and replay

Add a distinct `StateAuthorizing`; do not overload `StateAwaiting` or `PendingAsk`. Add aggregate methods for entering and resolving authorizing state rather than mutating fields directly. `PendingAsk`, `EvPermissionAsk`, approval verdicts, `ResumeApproval`, and policy learning remain permission-only.

`PendingMCPAuthorization` must durably bind:

- original effective `ToolCall`;
- opaque authorization ID;
- safe backend label;
- expiry;
- enough non-secret provenance to reject a mismatched resume.

The session's existing owner remains the ownership source. Do not accept an owner from client payload and do not duplicate mutable owner truth into the pending record unless the acceptance-plan review demonstrates a need.

Snapshot restore, event-source folding, Redis/jsonl/memory conformance, compaction pairing, stale-session reconciliation, retention, and delete/close paths must all explicitly handle the new state. An older binary encountering the new persisted state must fail closed, not coerce it to idle/awaiting/running.

On process restart, Runtime transactions and grants are gone. The first exclusive owner of a restored authorizing session records one `INTERRUPTED` synthetic result and returns it to an idle/recoverable state. It must not call `Connect` or `Execute` for the old action. Separately, broker-enabled loaded sessions must rebuild their stable broker wrappers from trusted operator configuration; absent reconstruction must fail loudly rather than use the shared/global MCP path.

### Service and client protocol

Use a separate MCP-authorization protocol over existing run transports:

- `mcp.authorization.required` event: session/run correlation, call ID if safe/needed, authorization ID, safe backend label, expiry; no URL.
- `mcp.authorization.resolved` event: terminal status only; no OAuth data.
- presentation lookup: returns a currently live URL only after service-side session authorization and exact pending-handle matching.
- recheck: takes opaque correlation, asks Runtime `Connect`, and resumes only on `ConnectionConnected`; a client cannot assert success.
- cancel/deny: resolves the pending call and cancels only the exact live transaction when possible; it must not route through permanent backend `Disconnect`.

Mecatui owns presentation only. It can open the URL and request recheck/cancel, but it cannot submit `allow_once`, `allow_always`, an authorization code, a token, or a success assertion. ACP and gRPC/HTTP projections must not confuse MCP authorization with permission asks.

Do not equate server process posture with run presentation capability. `mecak8s` is a headless composition root, yet its main session may be driven by an attached interactive mecatui client that can consume this protocol. Eligibility must come from a trusted per-run/client capability established by the wire handler—not from model input and not blindly from process-global `Config.Headless`/`Deps.Interactive`. Scheduled and detached runs have no such capability; child/parallel/team catalogs remain ineligible. The acceptance plan must pin both sides: a remotely driven main run can park, while an unattended run on the same server cannot.

Same-process and reconnect paths should converge on one service resume function and one engine continuation loop, following the existing awaiting-approval restart pattern without reusing its types or verdict semantics.

### Serialization

A broker wrapper's remote read-only hint must remain truthful, but broker calls must be dispatch-serialized in Stage 3 so two sibling calls cannot create competing browser flows. Do not casually set every wrapper `ReadOnly()==false`: that can alter plan-mode advertisement and other semantics. During acceptance-plan design, choose the smallest explicit serialization seam and pin:

- broker read-only tools remain semantically read-only;
- they do not overlap sibling broker calls;
- only one `PendingMCPAuthorization` can exist;
- ToolResults retain original call order.

If this requires a new optional engine/tool interface, treat it as an intentional public API addition and test that non-broker tools remain byte-compatible.

### Interaction with Stage 2 composition

Before claiming an end-to-end Stage 3 flow, close the Stage 2 composition gap with the minimum root-internal seam:

- a trusted composition path supplies the process-owned Runtime to `app.Build`/Service;
- every broker-enabled new or restored session receives its session-local wrappers;
- per-session close precedes Runtime close;
- a failed build/save rolls back broker resources;
- controls authorize the owning loaded session before calling Runtime;
- no command root needs Kind/Helm/sidecar packaging yet.

A prebuilt Runtime injection plus hermetic `app.Build` test is acceptable for Stage 3 if production construction is explicitly deferred to Stage 5. Do not claim the Kind/browser journey is deployed in that case.

## Suggested acceptance-plan scenarios

Use `/to-acceptance-plan` and let it refine task boundaries. A sensible scenario order is:

1. **Composition and rehydration prerequisite** — injected Runtime reaches `app.Build`, new/restored sessions mount broker wrappers, rollback and close ordering hold, shared fallback is impossible.
2. **Aggregate authorizing state** — legal transitions, private pending call, snapshots/event fold/store compatibility, restart interruption, pairing invariants.
3. **Typed dispatch interruption** — gate order, safe error interception, zero premature result/PostToolUse/failure accounting, headless bounded error.
4. **Serialized exactly-once continuation** — one pending action, recheck only from `Connected`, no permission/PreHook rerun, one protected send/PostHook/result.
5. **Control and wire surfaces** — required/resolved events, live presentation lookup, recheck/cancel, ownership checks, gRPC/HTTP/SSE/ACP/mecatui projections.
6. **Failure and lifecycle matrix** — deny, cancel, expiry, disconnect/reconnect, session close, process restart, duplicate/wrong correlation, compaction and retention.
7. **Aggregate evidence and docs** — hermetic real-Stage-2 Runtime vertical plus deterministic fakes, API baseline/changelog, ADR/resource inventory, architecture/usage/user-docs as applicable, generated `llms.txt`.

Do not blindly turn these seven scenarios into seven implementation tasks; the acceptance-plan adversary should split them by dependency and test ownership.

## Required evidence

At minimum pin these behaviors:

- Permission deny and PreToolUse block never call `Runtime.Connect`.
- PreToolUse mutation is exactly the call stored and later executed.
- The neutral control error never reaches diagnostics, ToolCallRecorder, PostToolUse, failure counters, or a model-visible ToolResult while pending.
- Presentation lookup for a wrong session, owner, backend, authorization ID, call, or expired transaction fails closed and reveals no existence detail.
- Recheck while pending does not resume; recheck after callback resumes exactly once; duplicate recheck cannot duplicate a call.
- Cancel/expiry/close racing callback has one linearized winner and always pairs history; cancellation does not make a later fresh authorization impossible.
- A remote interactive main run may park on a headless mecak8s process, while a scheduled/detached run on that same process cannot park or create an orphaned presentation flow.
- Client disconnect does not cancel a still-live broker attempt; reconnect can fetch presentation/recheck using authorized correlation.
- Restart never executes the stored call, even if a newly constructed Runtime happens to report a similarly named backend connected.
- A restored broker-enabled session does not lose broker tools or inherit global MCP authority.
- Broker tools serialize without changing unrelated read-parallel dispatch.
- Permission ask events, approval controls, learning, and UI remain unchanged.
- Secret canaries remain absent from event log, snapshot projections other than private call args, diagnostics, errors, wire messages, UI, prompts, and ToolResults.
- Stage 2 limits remain honest: one protected backend; disconnect/reconnect limitation; no durable credentials; no multi-replica claim.

The aggregate vertical should use the real Stage 2 Runtime in-process where it adds evidence. Unit tests should use narrow fakes for races and transition exhaustiveness. No test may contact a live OAuth/MCP/model service.

## Compatibility with the proposed mecatl identity trust domain

Stage 3 must stay compatible with, but must not implement, the design in `docs/agent-identity-model.md`, `docs/agent-identity-outbound.md`, and issue #478.

That design deliberately makes one mecatl deployment its own SPIFFE trust domain for **logical agent identities**. SPIRE/cloud identity attests the pod; mecatl's issuer projects the in-process definition/instance/delegation authority into short-lived JWT-SVID-shaped credentials. This is different from merely assigning the mecak8s pod a platform SPIFFE workload identity.

Preserve these seams now:

- Keep four axes distinct: session owner (accountability), user subject (whose authority is spent), agent actor/definition (who acts), and workload holder (which broker process holds the key). `PendingMCPAuthorization` is correlation and lifecycle state, not a substitute for any of them.
- Preserve Stage 2's broker-private resolved target. Future admission and credential lookup must consume the same one-time resolution; do not let presentation or resume re-resolve a model-controlled tool name to a different backend.
- Keep SVIDs, delegated access tokens, signing keys, bundle material, and holder proofs out of the pending snapshot, event log, model-visible values, and agent-loop address space. Resume should revalidate/re-mint ephemeral credentials from durable authority rather than persist them across the pause.
- Do not turn the current in-process `vmcpbroker.Runtime` into the issuer or SVID holder. Issue #478 requires startup-enforced incompatibility between reachable Bash and signing material, KMS-rooted/in-memory-only intermediates, binary-content SPIRE selectors, and rejection of ambient trust-domain-wide SVID grants. The outbound design further places the workload key in a separate-uid token broker. Stage 5's process/sidecar boundary is the likely place to satisfy that custody requirement.
- Keep client OAuth authorization and future agent token exchange separate. Stage 3 obtains or confirms the user's provider grant; the later outbound hop presents a sender-bound token where the user is subject, the agent is actor, and the broker workload is holder.
- Keep authorization correlation separate from audit correlation. The opaque authorization ID decides only the pending flow; a future `txn`/event-log correlation value must grant no authority.

Do not add trust-domain flags, signing, JWT claims, bundle publication, token exchange, or holder binding in this stage. The only Stage 3 requirement is to avoid an API or persisted-state choice that would force those values into the agent loop later.

## Deliberately deferred

Do not pull these into Stage 3:

- full ownerless-versus-authenticated behavior matrix beyond applying the service's existing session-owner checks;
- user-global credential sharing or private ToolHive user-keyed-read integration;
- agent/subagent/team credential inheritance or RFC 8693 delegation;
- second protected backend/reconnect support missing from ToolHive;
- durable or multi-replica broker transactions/credentials;
- production sidecar RPC/authentication and callback hosting;
- Helm/ConfigMap/Kind qualification or a real external provider journey;
- fixing ToolHive's residual `httprc` goroutines inside mecatl;
- another OAuth client/controller.

Those belong to canonical Stage 4 ownership and Stage 5 Kind qualification, or to an upstream ToolHive change.

## Verification and terminal condition

During planning and implementation:

```sh
task lint
task test
task docs
task api:check
go run ./cmd/mecademo
```

If Markdown changes, regenerate `llms.txt` through `task docs` or `task generate`; never hand-edit it. If the engine exported API changes, run `task api:update` and add the required compatibility changelog entry. Keep all tests offline.

The handover is complete when a self-contained `docs/acceptance/<stage3-name>.md` has passed the acceptance-plan advisory reviews and is ready for `/plan-orchestrate`. Implementation is complete only when that plan reaches its own aggregate gate and produces an honest Stage 3 result document. Do not commit, push, or open a PR unless explicitly requested.
