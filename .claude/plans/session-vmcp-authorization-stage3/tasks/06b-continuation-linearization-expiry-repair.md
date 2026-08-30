---
id: 06b-continuation-linearization-expiry-repair
title: Repair continuation control linearization, expiry, and proof
blocked_by: [06-continuation-controls-races-and-lifecycle]
status: done
branch: "plan-session-vmcp-authorization/06b-continuation-linearization-expiry-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Task 06 correction before Task 07. Implement all reviewer findings: no authorizing mutation before lock+lease+reload; exact in-process runtime continuity rejects new prompt, restart-absent interrupts/pairs/saves. Recheck/cancel/presentation take run-entry exclusion, acquire lease, then reload/revalidate. Prepared continuation must register before start; postclaim preparation/registration failure repairs running aggregate and persists paired errors. Unify Runtime/Service expiry authority and injected clock; owner-enforced timer uses internal load, identity/generation-safe timers stop/remove on every resolution/close and never schedule after closure; use normal durable event relay/subscriber publishing. Cancel/expiry return continuation. Add visible safe tool card/result and correct per-run usage delta. Runtime errors aren't pending. Clean indexes and inventory exact timer map/goroutines in ADR0027 List1.

Add all exact Task06 verifier tests—including controls owner/order, pending/connected, exact once races, expiry, mismatch, crash, lease, restart/new runtime, close—and concrete lease/eventlog/owner timer tests. Do not start Task07 surfaces.

## Acceptance criteria

- Repair R6.1: controls have one durable lease-protected claim/save/register/start winner.
  - verify: `TestInvariant_mcp_authorization_resolution_single_winner`
- Repair R6.2: expiry/timers/events are exact, owner-safe, cleanup-safe, and durable.
  - verify: `TestSessionMCPAuthorization_Scenario7_ExpiryResolvesOnce`
- Repair R6.3: all Task06 lifecycle proofs exercise concrete service paths.
  - verify: `TestInvariant_authorizing_state_all_lifecycle_consumers_explicit`
