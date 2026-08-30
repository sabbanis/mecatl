---
id: 05d-authorization-parking-completion-repair
title: Complete authorization parking gates, invalidation, refresh, and relays
blocked_by: [05c-authorization-parking-order-race-relay-repair]
status: done
branch: "plan-session-vmcp-authorization/05d-authorization-parking-completion-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Complete the still-missing Task 05 behavior before Task 06.

Create a genuinely shared post-PreToolUse tail. It is the only path from a successful normal call, guardrail approved call, and restarted/restored permission approval to broker authorization and execution. Preserve permission → PreToolUse → authorization → execute ordering. Test all three entry paths independently, including a real PreToolUse argument mutation and a block.

A `PauseForMCPAuthorization` failure must exactly cancel the obtained broker transaction before generating paired pending/deferred error results. A failed cancellation is fail-closed: do not abort/detach the aggregate in a way that permits the still-live handle to be reused; make the transaction unusable or retain/retry ownership until invalidation succeeds. Add explicit pause-failure/cancel-failure behavior tests.

Make `scopedGrantTokenSource.Token()` actively refresh expired credentials through the approved OAuth flow, atomically update the Runtime grant, and preserve type/expiry semantics before `oauth2.Transport` creates the header. Add an expiry/refresh integration test proving the actual transport sees the fresh token.

Make both HTTP SSE and gRPC relays intentionally consume `Run.Outcome()==RunOutcomeAuthorizationParked`, treat it as an expected nonterminal closure, deregister only that run, and record a distinct parked metric/outcome. Add actual gRPC and HTTP tests with assertions on metrics/state/wire events.

Replace all weak evidence listed in review with independent behavior assertions: actual Save completion before authorization-required event, three sibling ordered park behavior, concurrent execution serialization versus unrelated reads, table-driven unattended cases (ACP/scheduled/child/Parallel/Team/detached), recorder/PostToolUse/failure counter absence while pending, safe payload projection, and child draining/retraction.

Run full offline gates and commit. Do not start continuation callbacks/controls (Task 06).

## Acceptance criteria

- Repair R5.12: all allowed dispatch/resume paths use the one post-PreToolUse authorization tail.
  - verify: `TestInvariant_mcp_authorization_tail_covers_normal_guardrail_and_resume`
- Repair R5.13: no failed park/cancel/racing callback leaves a reusable broker transaction or grant.
  - verify: `TestInvariant_mcp_authorization_invalidation_is_fail_closed`
- Repair R5.14: expired scoped grants refresh in the transport before MCP request authentication.
  - verify: `TestInvariant_vmcp_scoped_token_source_refreshes_expired_grants`
- Repair R5.15: both relays explicitly report parked nonterminal closure and metric outcome.
  - verify: `TestMCPAuthorizationParkedRelayLifecycle`
- Repair R5.16: every Task 05 behavior is independently proven rather than alias-tested.
  - verify: `TestInvariant_mcp_authorization_parking_behavior_matrix`
