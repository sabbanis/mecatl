---
id: 06d-continuation-clock-owner-proof-repair
title: Repair continuation clock, timer ownership, and acceptance proofs
blocked_by: [06c-continuation-registration-runtime-expiry-repair]
status: done
branch: "plan-session-vmcp-authorization/06d-continuation-clock-owner-proof-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Final Task06 correction before Task07. Runtime transaction creation must use injected `r.now()`. Owner-enforced timer scheduling must use an internal load/registered state, not GetSession background caller context. Cancel/expiry continuation must prepare/register/start and repair registration failure. Stop expiry timer on lease loss. On lease loss do not mutate durable state after ownership is lost unless reacquired; otherwise local invalidation/new-holder restart repair. Correct ADR pointer-entry inventory. Add all missing named Task06 verifiers with real live Runtime authorization and Service/lease paths: owner before Runtime, inert pending, connected resume, cancel fresh attempt, mismatch fail closed, postclaim crash, lease retention, restart no old execute, new runtime no continuity. Strengthen expiry/single-winner/close tests.
