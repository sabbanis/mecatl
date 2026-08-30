---
id: 06v2-real-runtime-http-callback-and-ownership-repair
title: Repair real Runtime HTTP callback and ownership vertical
blocked_by: [06v-real-runtime-service-vertical]
status: done
branch: "plan-session-vmcp-authorization/06v2-real-runtime-http-callback-and-ownership-repair"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Repair the 06v stage0a vertical without touching Task07. Mount the real callback handler at loopback callback URL and follow the real ToolHive redirect over HTTP, asserting code/state/scope. Settings must contain actual loopback backend/issuer/callback and constructor consumes canonical declarations Profiles and CallbackURL to construct Runtime. Enable ownership enforcement owner/foreign testing. Assert redacted tool card, safe required event/no secrets, exactly-once PostToolUse/audit, ValidateToolPairing, second recheck no execute, timer removal, and resource shutdown ordering. Commit focused test/gates.
