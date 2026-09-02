# Finding: bundled workspace enrollment has no reconnect path for an existing session

## Summary

`ConnectWorkspaceServices` is gated to run only on a session with **zero recorded
messages** — it must precede the first prompt, by design. There is currently no
supported way to reconnect protected MCP services to a session that has already
exchanged at least one message. If the broker's in-memory grant/session state is
lost (process restart, pod eviction, `openBrokerSession` entry dropped) while a
session already has history, that session can never regain protected-service access;
only starting a brand-new session works around it.

## Where

`internal/adapter/server/workspace_enrollment.go`, `Service.ConnectWorkspaceServices`:

```go
if sess.State != session.StateIdle || sess.Conversation == nil || len(sess.Conversation.Messages) != 0 {
    return vmcpbroker.WorkspaceEnrollmentPresentation{}, fmt.Errorf("%w: workspace enrollment must precede the first prompt", ErrFailedPrecondition)
}
```

The doc comment on the method is explicit about the intent:

> ConnectWorkspaceServices starts or observes the one client-owned **pre-prompt**
> enrollment bundle.

## How it was hit

During the Stage 3 GitHub broker qualification test (kind cluster), Docker Desktop's
backend wedged and had to be force-restarted, which rebooted the whole Docker VM and
took the kind node container with it. Kubernetes state (pods, Redis-persisted
sessions) survived the reboot, but the vMCP broker Runtime's **process-local**
in-memory session/grant maps did not (this is `reset-by-design` per
`docs/adr/0027-cloud-native.md` List 2 — deliberately not persisted). A session that
already had prompts before the restart had no way to reconnect: `ConnectWorkspaceServices`
rejected it outright because `len(sess.Conversation.Messages) != 0`.

The client (`mecatui`) surfaces this only as a generic `"workspace enrollment failed"`
banner (`cmd/mecatui/ui/workspace_enrollment.go`) — the real
`ErrFailedPrecondition` reason is deliberately discarded before it reaches the UI or
any log, by design (avoids leaking internal state), which made this specific failure
mode hard to diagnose without adding temporary server-side logging.

## Why the current gate exists (steelman)

Restricting the bundle-connect action to a message-free session is a reasonable
safety property on its own: it guarantees the model never sees a partially-admitted
protected catalogue mid-conversation, and it keeps the "all-or-nothing" bundle
semantics simple (ADR 0281 / `docs/adr/0287-bundled-mcp-workspace-enrollment.md`).
The gap is specifically the **recovery** case: nothing distinguishes "this session
already has history because enrollment already succeeded and the conversation is
legitimately underway" from "the broker's process-local state was lost and this
session is now permanently stuck."

## Suggested directions (not yet designed)

1. Track whether the *session* (not just the broker Runtime) believes protected
   services were ever admitted (e.g. via the persisted `BrokerEnrollmentID`/
   `WorkspaceEnrollmentState` already on `session.Session`) and allow
   `ConnectWorkspaceServices` to re-run for a message-bearing session **only when**
   the persisted state says protected services were admitted before but the
   process-local Runtime has no matching live grant — i.e. a narrowly-scoped
   "recover after restart" branch, not a general relaxation of the pre-prompt gate.
2. Alternatively, give the user/model an explicit, differently-named recovery action
   ("reconnect workspace services after restart") distinct from the fresh-session
   `ConnectWorkspaceServices`, so the pre-prompt invariant stays intact for the
   original flow and the recovery path is a deliberate, auditable second door.
3. At minimum, surface a more actionable client-side message than
   `"workspace enrollment failed"` when the specific cause is
   `ErrFailedPrecondition` + non-empty conversation, e.g. "protected services were
   disconnected (likely a broker restart); start a new session to reconnect" —
   cheaper than a real fix and removes the diagnosis cost this finding required.

## Status

Not fixed. Recorded for follow-up; no code changed as part of this finding.
