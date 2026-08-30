---
id: 05b-authorization-parking-correctness-repair
title: Repair authorization parking correctness and proof
blocked_by: [05-dispatch-parking-eligibility-serialization]
status: done
branch: "plan-session-vmcp-authorization/05b-authorization-parking-correctness-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Repair Task 05 before continuation controls. Task 06 remains blocked. Replace alias acceptance tests with independent behavior proofs; do not begin Task 06 or add callback presentation controls.

Make a trusted run-scoped presentation capability, wired only by authorized gRPC/HTTP interactive main-run handlers. Decide eligibility after PreToolUse but before `AuthorizationRequester.RequestAuthorization`; ineligible ACP, scheduled, detached/background, child, Parallel, Team, and other unattended runs must create zero Runtime transactions and receive paired ordinary errors. An attached interactive remote main run remains eligible on a process-headless mecak8s server.

Factor a single post-PreToolUse tail used by ordinary dispatch, guardrail approval, and restarted permission-approval resolution. It must perform eligibility, request authorization, and execute in the correct order. Require a non-nil Store before parking; a nil/failed save is a required-save failure. Cancellation/invalidation of the exact transaction must succeed using detached context where needed. On pause/save failure synthesize and emit ordered redacted results for the pending call and every deferred sibling before recording them.

Only protected wrappers implement `AuthorizationRequester`; anonymous wrappers retain ordinary tool-card arguments. All broker wrappers return `DispatchSerial() == true` while preserving real `ReadOnly()` behavior through permission and plan-mode paths. Add a safe authorization-required event payload with only authorization ID, safe backend label, call correlation, and expiry—no args, browser URL, code/state/token, or locators.

Implement relay handling for `authorization_parked`: expected closure, no fabricated result, deregister only the Run, retain nonterminal authorizing state, and record parked metrics. Parked runs must drain/retract run-scoped children without `EvResult` or session termination. Correct Run outcome zero/active semantics and contracts for parked closure, and accurately document `save` versus `saveRequired`.

Resolve the prerequisite ToolHive review in `TOOLHIVE-REUSE-REVIEW.md`: do not infer unauthorized from model-facing text or automatically replay an ambiguously completed protected call. Use a session-scoped token source with complete token expiry/type semantics; do not duplicate unbounded manual exchange/refresh behavior; use authoritative trusted OAuth endpoints; Runtime borrows rather than closes the embedded auth server.

Run docs/generation after Markdown/API changes.

## Acceptance criteria

- Repair R5.1: Eligibility is trusted and run-scoped, decided before any broker authorization transaction; ineligible runs create none while an authorized remote interactive main run can park on headless process composition.
  - verify: `TestInvariant_unattended_runs_never_park_for_mcp_authorization`
- Repair R5.2: The shared post-PreToolUse path covers normal, guardrail-approved, and restored-permission calls; gates precede authorization and execution with exact mutated calls.
  - verify: `TestSessionMCPAuthorization_Scenario5_GatesPrecedeConnect`
- Repair R5.3: Required durability/invalidation and all ordered synthesized result events preserve pairing on pause/save/nil-store failure.
  - verify: `TestSessionMCPAuthorization_Scenario5_SaveFailureCancelsTransaction`
- Repair R5.4: Protected-only redaction, all-broker serialization, and unmodified ordinary read-only semantics are proven under dispatch, permission, and plan mode.
  - verify: `TestSessionMCPAuthorization_Scenario6_BrokerCallsSerialize`
- Repair R5.5: Parked outcome/event payload/relay/child-drain behavior is correct and accurately documented.
  - verify: `TestSessionMCPAuthorization_Scenario5_ParkedRunOutcome`
- Repair R5.6: Protected calls have no model-text-driven unauthorized replay and use the scoped OAuth token lifecycle.
  - verify: `TestInvariant_protected_broker_call_is_never_automatically_replayed`
