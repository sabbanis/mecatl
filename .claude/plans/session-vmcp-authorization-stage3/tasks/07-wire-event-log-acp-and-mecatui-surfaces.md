---
id: 07-wire-event-log-acp-and-mecatui-surfaces
title: Wire, event-log, ACP, and mecatui surfaces
blocked_by: [06u-toolhive-callback-scope-compat]
status: done
branch: "plan-session-vmcp-authorization/07-wire-event-log-acp-and-mecatui-surfaces"
worktree: "/Users/jakub/devel/mecatl/.worktrees/session-mcp-broker-stage3"
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Expose the separate MCP-authorization protocol through durable event, gRPC, HTTP/SSE, ACP, and mecatui surfaces. It is presentation, recheck, and cancellation—not a permission verdict. Preserve private effective arguments and existing permission behavior.

## Acceptance criteria

- AC9.1: `mcp.authorization.required` carries only safe session/run correlation as needed,
  call ID, authorization ID, backend label, expiry, and status `pending`; `resolved` uses
  exactly `connected`, `cancelled`, `expired`, `interrupted`, `failed`, or `closed`.
  Neither contains a URL, arguments, code, verifier, token, `tsid`, or secret. A protected
  tool failure after connected remains an ordinary ToolResult/Run failure and does not
  rewrite authorization status.
  - verify: `TestInvariant_mcp_authorization_events_are_safe_correlation_only`
- AC9.2: The exact effective arguments occur only in the authoritative snapshot/model
  history and trusted audit storage. Client transcript/session projections redact the
  pending protected call just like its tool card, and arguments are absent from event
  logs, diagnostics, control responses, proto/SSE, ACP, and mecatui.
  - verify: `TestInvariant_pending_mcp_arguments_are_snapshot_private`
- AC9.3: The durable event grammar is ordered by authorization ID: `required` opens a
  marker and `resolved` closes it. `eventsource.Fold` returns
  `eventsource.ErrPrivateStateRequired` whenever any broker-authorized call requires the
  snapshot-only effective call; malformed order, duplicate/mismatched IDs, unresolved
  end-of-stream, or a resolution without its request fail closed rather than returning an
  executable Session.
  - verify: `TestSessionMCPAuthorization_Scenario9_EventFoldRequiresPrivateState`
- AC9.4: Authorization event records use `eventlog-json/2`; new readers accept the v1/v2
  read set and write v2 for the new protocol, while old v1-only readers reject at the
  format boundary. Authorizing snapshot state likewise rejects in an old restore switch
  before overwrite or execution.
  - verify: `TestSessionMCPAuthorization_Scenario9_MixedVersionFailsClosed`
- AC9.5: gRPC exposes unary `GetMCPAuthorizationPresentation` and server-streaming
  `RecheckMCPAuthorization`/`CancelMCPAuthorization`; HTTP exposes the exact counterparts
  `GET /v1/sessions/{id}/mcp-authorizations/{authorization_id}/presentation`,
  `POST ...:recheck`, and `POST ...:cancel`, with recheck/cancel responses relayed as SSE.
  Requests carry only session and authorization IDs. Unknown, foreign, mismatched,
  expired, or resolved targets map to gRPC NotFound / HTTP 404; malformed requests map to
  InvalidArgument / 400; a pending recheck emits the safe current required status then
  closes, while a winning recheck/cancel streams resolved and continuation events.
  - verify: `TestSessionMCPAuthorization_Scenario9_WireControlParity`
- AC9.6: Mecatui renders a distinct authorization state with only Open Browser, Recheck,
  and Cancel; it never renders permission Allow/Always/Deny controls for this state.
  - verify: `TestInvariant_mecatui_mcp_authorization_is_not_permission_approval`
- AC9.7: Reconnect replays safe status, fetches current authorization state, does not
  auto-open a replayed URL, and subscribes to the continuation events idempotently by
  authorization ID.
  - verify: `TestSessionMCPAuthorization_Scenario9_MecatuiReconnect`
- AC9.8: Existing permission ask events, approval controls, policy learning, approval UI,
  and awaiting restart behavior remain unchanged.
  - verify: `TestSessionMCPAuthorization_Scenario9_PermissionRegression`
- AC9.9: ACP handles authorizing state explicitly but remains presentation-ineligible; it
  receives ordinary paired errors rather than partial browser controls or no-result EOF.
  - verify: `TestSessionMCPAuthorization_Scenario9_ACPIsExplicitlyIneligible`
