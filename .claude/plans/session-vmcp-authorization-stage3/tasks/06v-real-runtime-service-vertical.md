---
id: 06v-real-runtime-service-vertical
title: Prove the real Runtime through direct Service controls
blocked_by: [06u-toolhive-callback-scope-compat]
status: done
branch: "plan-session-vmcp-authorization/06v-real-runtime-service-vertical"
worktree: ".claude/worktrees/session-vmcp-authorization-06v"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

After 06e, add hermetic `internal/adapter/mcp/stage0a/session_authorization_service_vertical_test.go` with `TestSessionMCPAuthorization_RealRuntimeServiceVertical`. Use an external test package so the documented ToolHive process-lifetime `httprc` goroutine residual stays at the real-ToolHive integration boundary; do not add goleak exclusions. Use real settings/Resolver.OperatorMCP/canonical authority loader/app.Build/VMCPBrokerConstructor/ToolHive EmbeddedAuthServer/incoming auth/registry/aggregator/session factory/vMCP Handler/local HTTP MCP backend/local OAuth fixture/mockllm/direct Service controls. Drive protected call → durable park → owner presentation → browser HTTP callback → connected recheck → lease claim/save/prepare/register/start → exact MCP execution → posthook/audit/result/model final. Prove all stated 06d boundary/security assertions. No Task07 proto/HTTP/gRPC/UI or Task08 command root.
