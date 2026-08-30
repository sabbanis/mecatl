---
id: 06-continuation-controls-races-and-lifecycle
title: Continuation controls, races, and lifecycle
blocked_by: [05h-authorization-parking-proof-and-failure-cleanup]
status: done
branch: "plan-session-vmcp-authorization/06-continuation-controls-races-and-lifecycle"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Implement owner-authorized presentation, recheck, cancellation, expiry, exactly-once continuation, and restart/close lifecycle behavior over the authorizing aggregate. Do not add gRPC/HTTP/ACP/mecatui projections; task 07 owns those. Keep callback completion broker-owned and never retry an old protected action after restart.

## Acceptance criteria

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
