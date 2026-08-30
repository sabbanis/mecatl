---
id: 06c-continuation-registration-runtime-expiry-repair
title: Repair continuation registration, runtime cancellation, and expiry ownership
blocked_by: [06b-continuation-linearization-expiry-repair]
status: done
branch: "plan-session-vmcp-authorization/06c-continuation-registration-runtime-expiry-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Repair Task 06 before Task 07. Implement prepared/start-gated continuation Run so the sequence is claim → required save → prepare → register (which can fail if Service closed) → release start; postclaim preparation/registration failure abandons/pairs/saves. Runtime callback exchange has a cancellation context invoked by exact cancel/expiry/close before token exchange and grant install. Use a shared injected clock and one Service expiry authority; runtime status lookup must not destructively remove durable correlation. Owner-safe timer scheduling uses internal state/run, pointer identity entries remove on all resolution/lease loss/close and do not leak generation keys. Close mutates durable state only after held/acquired lease; expired cancel reports expiry. Recheck continuation emits safe protected tool card/results. Runtime Close clears authorization handles. Add the named AC7/AC8 Service-level verifiers and real connected-runtime/lease/event paths listed in review; update ADR inventory only to actual behavior.
