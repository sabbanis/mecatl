---
id: 06u-toolhive-callback-scope-compat
title: Align callback grammar with ToolHive OAuth responses
blocked_by: [06e-task06-service-verifier-repair]
status: done
branch: "plan-session-vmcp-authorization/06u-toolhive-callback-scope-compat"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Accept exactly one bounded nonempty code and state plus at most one bounded nonempty scope in callback query; reject all duplicate/malformed/oversized/empty/unexpected values with existing generic 400. Ignore scope completely: never Runtime/log/response/persist/authority. Keep Runtime.Callback(code,state). Resize raw query bound for 3 percent-encoded values. Update ADR0238, AC2.4/2.5, tests/generated docs. Add real ToolHive code/state/scope success and all requested negative/security tests. Run race vmcpbroker tests/generate/diff check.
