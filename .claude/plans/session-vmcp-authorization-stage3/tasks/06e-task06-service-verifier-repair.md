---
id: 06e-task06-service-verifier-repair
title: Complete Task 06 Service-level acceptance proofs
blocked_by: [06d-continuation-clock-owner-proof-repair]
status: done
branch: "plan-session-vmcp-authorization/06e-task06-service-verifier-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Add all missing named Task 06 Service-level verifiers using real Service, Runtime, store, lease, and lifecycle paths—not aliases or direct-engine substitutes. Fix production only when a real path exposes a defect. Do not add Task 07 wire/UI or Task 08 command-root work.

Required verifier names:
- TestInvariant_mcp_presentation_owner_checked_before_runtime
- TestSessionMCPAuthorization_Scenario7_PendingRecheckIsInert
- TestSessionMCPAuthorization_Scenario7_ConnectedRecheckResumes
- TestSessionMCPAuthorization_Scenario7_CancelAllowsFreshAttempt
- TestSessionMCPAuthorization_Scenario7_MismatchedControlsFailClosed
- TestSessionMCPAuthorization_Scenario7_PostClaimCrashNeverRetries
- TestSessionMCPAuthorization_Scenario8_ParkRetainsLease
- TestInvariant_restarted_authorization_never_executes_old_call
- TestSessionMCPAuthorization_Scenario8_NewRuntimeIsNotContinuity

Exercise real owner-before-runtime, pending/connected/cancel, postclaim crash, lease retention, restart/noncontinuity and timer/event-log/subscriber/race paths exactly as the task request specifies. Run all named tests uncached plus engine agent/session/tool and adapter server/vmcpbroker/app race suites and git diff --check.
