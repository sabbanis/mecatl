---
id: 05c-authorization-parking-order-race-relay-repair
title: Repair authorization parking order, races, and relays
blocked_by: [05b-authorization-parking-correctness-repair]
status: done
branch: "plan-session-vmcp-authorization/05c-authorization-parking-order-race-relay-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Task 05 remains incomplete. Fix the following reviewer-confirmed correctness gaps before Task 06; do not implement continuation controls.

Restore one post-gate tail with the exact order **permission → PreToolUse → broker authorization → execute**. It must be shared by normal dispatch, a guardrail-approval allow, and persisted/restarted permission approval (including hook-originated pending calls). Role-bearing engines reject before any request even if a presentation flag is accidentally present. Test permission deny, pre-hook block, pre-hook mutation followed by authorization and execution, guardrail approval, and restarted awaiting approval independently.

Once a transaction exists, every parking failure must invalidate it exactly and fail closed. `PauseForMCPAuthorization` failure cancels it and emits/records ordered paired pending/deferred errors. Save failure may not claim success if cancellation fails. Make callback exchange and exact cancellation linearizable: only one claimant can win; a cancellation racing callback cannot later install a grant.

Implement actual HTTP and gRPC parked-run relay behavior: expected no-terminal-result closure, deregister that Run only, retain authorizing session, and record parked completion metrics/outcome separately. Add executable relay coverage.

Finish token-source integration: the session-scoped `oauth2.TokenSource` must drive the MCP HTTP transport rather than a static Bearer header, validate token type as empty or `Bearer` before applying the scheme, and preserve expiry/refresh semantics. Do not infer authorization from model-facing errors or replay protected calls.

Treat `BackendID` as private: expose a safe configured display label rather than it in authorization-required payload. Correct `Run.Events` and save/saveRequired comments.

Replace shallow/alias evidence with independently failing behavior tests: post-hook/recorder/failure counter pending effects; two+ call ordered parking; observed Save-before-event ordering; concurrent broker serialization and concurrent unrelated reads; all unattended paths (scheduled, ACP, child, Parallel, Team, detached); safe payload proto projection/no-leak; child-drain/retraction. Use offline tests. Run generation, API updates, full gates, and commit.

## Acceptance criteria

- Repair R5.7: every entry path maintains permission → PreToolUse → authorization → execute and role eligibility precedes transaction creation.
  - verify: `TestInvariant_mcp_authorization_gate_order_all_entry_paths`
- Repair R5.8: failed parking and racing callbacks cannot leave a usable uncorrelated authorization/grant.
  - verify: `TestInvariant_mcp_authorization_transaction_has_one_linearized_terminal_owner`
- Repair R5.9: parked HTTP/gRPC relays close correctly without a fabricated terminal result and record the parked outcome.
  - verify: `TestMCPAuthorizationParkedRelayLifecycle`
- Repair R5.10: session-scoped OAuth token source owns transport authorization and validates scheme semantics.
  - verify: `TestInvariant_vmcp_transport_uses_scoped_bearer_token_source`
- Repair R5.11: authorization event payload is safe and all Task 05 named proofs exercise their actual behavior.
  - verify: `TestInvariant_mcp_authorization_required_payload_has_no_private_or_secret_data`
