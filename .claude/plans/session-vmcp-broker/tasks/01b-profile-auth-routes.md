---
id: 01b-profile-auth-routes
title: Compile broker authorization routes from strict profiles
blocked_by: [01-runtime-contract]
status: done
branch: "plan-session-vmcp-broker/01b-profile-auth-routes"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-broker
---

# Task brief

Repair the retained runtime contract before server or OAuth work resumes. `CompileProfiles` must derive immutable `Route.Protected` from each configured `permconfig.MCPServerProfile.Auth.Mode`, rather than trusting callers or manually constructed routes. `auth:none` routes remain executable. The one supported `auth:oauth` route becomes protected. `static_bearer`, unknown modes, duplicate profile names, or malformed/discovered-unconfigured backend combinations must fail explicitly; they must never quietly become anonymous. Keep `BackendID` broker-private and do not widen `engine/` or `engine/port`. Add focused offline tests in the vmcpbroker package. The later connection task owns the typed second-OAuth selection result, but this compiler must retain sufficient unambiguous profile mode information for that boundary.

## Acceptance criteria

- AC1.6: The model-facing call contains only the selected tool's declared arguments. `BackendID`, broker bearer material, ToolHive locators, and OAuth state are never tool arguments, tool descriptions, or tool results.
  - verify: `TestInvariant_vmcp_broker_route_is_not_model_input`
- AC2.7: Calling the protected tool before explicit connection returns a bounded authorization-required tool error, while an anonymous configured tool remains executable. Stage 2 neither parks nor replays the agent run.
  - verify: `TestSessionVMCPBroker_Scenario2_UnconnectedProtectedToolIsBounded`
