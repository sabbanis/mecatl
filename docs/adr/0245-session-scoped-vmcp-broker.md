# ADR 0245 — Session-scoped vMCP broker for protected MCP backends

- Status: Proposed
- Date: 2026-08-26
- Scope: root-internal ToolHive/vMCP composition, per-session MCP tools, and broker-owned upstream credential lifecycle
- Supersedes: none
- Superseded by: none

## Context

Mecatl's current operator MCP profiles and `OAuthController` own one
process-global manager and credential lifecycle. That is appropriate for an
operator-authorized static backend, but cannot safely represent one ToolHive
upstream credential lineage per mecatl session. A global manager would expose
one session's upstream access to another session, and a static process header
cannot rotate independently for each session.

The existing per-session client-MCP path already establishes the relevant
lifecycle boundary: composition creates a session-owned MCP manager, mounts its
tools through the shared catalogue assembly path, and closes it when the session
ends. ToolHive supplies an embedded authserver and vMCP path that can inject
upstream credentials into configured MCP backends, but it must be composed under
that same session boundary without leaking ToolHive types into the engine.

The first vertical needs a GitHub-like OAuth backend and anonymous backends. The
engine must be able to choose an ordinary tool such as
`mcp__github__list_issues` before an upstream credential exists; it must not be
asked to select a backend, manage browser OAuth, or handle bearer credentials.

## Decision

- Add one root-internal `internal/adapter/vmcpbroker.Runtime` that owns the
  immutable ToolHive authserver/vMCP composition, decorated broker storage,
  backend registry, login transactions, and shared shutdown.
- Keep a configured vMCP tool catalogue stable for the Runtime lifetime. A
  session's executable wrappers retain a broker-private tool-name-to-`BackendID`
  route. Connecting a backend changes execution authority, never the model-visible
  tool set. A fully-qualified broker/global MCP tool-name collision is rejected
  before mounting an ambiguous wrapper; global precedence must never bypass
  session-scoped broker authority.
- Let composition call `OpenSession(sessionID)` only after the server has minted
  and reserved the canonical mecatl session ID. It returns concrete session-local
  tools and close lifecycle. The short-lived broker bearer remains inside that
  session transport; it is not a general Runtime result, a model value, event,
  snapshot field, or tool argument.
- Keep `Connect(sessionID, backendID)` and `Disconnect(sessionID, backendID)` as
  backend-specific composition-private control operations in Stage 2. The
  hermetic vertical drives them directly; no public wire/UI surface is added.
  Any later public control surface must first authorize ownership of the parent
  session before reaching Runtime. A later internal authorization handler uses
  the same operations. The model selects ordinary tools and never supplies a
  `BackendID`.
- Support exactly one OAuth-protected backend plus any number of `auth:none`
  backends. A second OAuth backend fails explicitly until ToolHive exposes a
  targeted `ConnectUpstream(existingAuthSession, upstream)` operation.
- Reuse ToolHive and `x/oauth2` for protocol behavior. Do not reuse or modify the
  global direct-MCP `OAuthController`, Ozz lifecycle, loopback login runtime, or
  `LoginMCP`; those have different ownership and authority semantics. Broker OAuth
  uses an explicit no-proxy, exact-origin, DNS-pinned, redirect-bounded profile;
  credential-bearing OAuth traffic is permitted only to its configured issuer,
  except explicit loopback test fixtures.
- Call `ForgetSession(sessionID)` after the session-local tools have drained and
  closed. It cancels pending work and removes the broker's bindings and
  credentials for that session. `Runtime.Close` runs only after all session
  close folds complete. On process restart, broker-enabled session reattachment
  either re-derives the stable configured tools with in-memory grants reset, or
  fails loudly; it never silently falls back to the shared engine.
- Treat pre-authorization discovery of the stable protected tool catalogue as a
  required integration proof. If public ToolHive behavior cannot expose that
  catalogue and return a bounded missing-authorization execution result, stop
  this capability rather than introduce dynamic catalogue churn or another OAuth
  implementation.

## Consequences

The engine continues to use ordinary `tool.Tool` wrappers and remains free of
ToolHive/OAuth types. The current shared global MCP manager remains untouched.
A per-session broker client can refresh its own short-lived bearer without
putting a token in `Config.MCPServers` or a static process header.

The new runtime introduces a long-lived shared resource plus session-derived
resources, so it needs explicit construction rollback, session close ordering,
process shutdown, token/callback race tests, and an ADR 0027 inventory update
when implementation adds the resources. Stage 2 initially requires an explicit
connection action and returns a bounded authorization-required tool error when a
protected tool is used without a grant. Parking and exact-call retry are deferred
until Stage 3.

The architecture depends on ToolHive's public pre-authorization tool discovery
and missing-credential behavior. A negative result blocks the capability rather
than being hidden behind an optimistic interface. ToolHive residual goroutines
remain an upstream lifecycle finding and must be reported without test
exclusions.

## See also

- [Session-scoped vMCP broker acceptance plan](../acceptance/session-vmcp-broker.md)
- [ADR 0001 — ACP adapter](./0001-acp-adapter.md) — per-session streaming-HTTP MCP lifecycle
- [ADR 0016 — multi-provider](./0016-multi-provider.md) — the per-session engine/catalogue factory and shared-manager ownership
- [ADR 0020 — diagnostics](./0020-diagnostics.md) — diagnostics boundary
- [ADR 0027 — cloud-native](./0027-cloud-native.md) — resource inventory and rehydrate-fidelity ledger
- [ADR 0220 — adapter-local MCP OAuth controller](./0220-mcp-oauth-controller.md) — separate direct-MCP OAuth ownership
