# ADR 0248 — Bundled MCP workspace enrollment

- Status: Proposed
- Date: 2026-08-31
- Scope: pre-prompt user authorization and authenticated catalogue discovery for multiple protected MCP backends
- Supersedes: none
- Superseded by: none

## Context

Some protected remote MCP servers reject anonymous `initialize` and `tools/list`. Static operator catalogues can remain parseable as compatibility/comparison data, but they cannot establish what an authenticated user can actually access. ToolHive v0.45.0 supports multiple configured upstreams but drives them as an ordered consent chain, not independent per-backend transactions.

## Decision

Keep anonymous backend discovery eager and unchanged. Configured protected backends are never anonymously discovered at startup and static `auth.oauth.tools` values do not enter `Process` or `Runtime` catalogue construction. A session begins in a client-owned pre-prompt workspace-enrollment flow. The client presents one **Connect workspace services** action. It is neither permission approval nor a model-selected tool call, so it reuses neither `PendingMCPAuthorization` nor `StateAuthorizing`.

The broker builds one ToolHive `authserver.UpstreamRunConfig` per protected profile in deterministic configured order. The first protected provider is ToolHive's bundle identity anchor. Each profile maps to a collision-checked adapter-private DNS-label provider key used by its backend's `UpstreamInject.ProviderName`; private keys and credentials never change or enter the model-visible tool namespace. One process-owned cancelable context bounds incoming-auth/JWKS work and is cancelled only after vMCP and authserver shutdown.

After every required provider connects, the broker calls provider-scoped authenticated `QueryCapabilities(ctx, backend)` separately for each backend and never uses partial-tolerant `QueryAllCapabilities`. Those authenticated results are the sole admitted protected definitions. It stages, validates, and collision-checks every definition before atomically freezing one session-local multi-backend catalogue. Before prompt input becomes available, the session aggregate admits those exact frozen tool names into its durable capability set; enrollment cannot widen filesystem, direct-write, delegation-depth, provenance, or definition-identity authority.

The bundle is all-or-nothing: denial, cancellation, expiry, callback, refresh, or backend failure, restart, process loss, malformed discovery, or a tool collision exposes no partial protected catalogue and requires a new bundle. A restart replays neither a prior grant nor a prior catalogue. One process/replica remains required. Independent backend connect/retry/cancel is deferred. Static protected `tools:` remains accepted configuration-only compatibility/comparison data and can neither admit nor override a protected definition; the bootstrap-discovery CLI is deferred.

## Consequences

Users authorize their own workspace services without a bootstrap PAT or configuration rollout. Providers may open multiple consent pages. A restart requires re-enrollment. The catalogue cannot change during a session. ToolHive’s missing targeted `ConnectUpstream` API remains an upstream limitation.

## See also

- [ADR 0245](./0245-session-scoped-vmcp-broker.md)
- [ADR 0246](./0246-configured-resumable-mcp-authorization.md)
- [ADR 0247](./0247-broker-generic-oauth2-upstreams.md)
- [Stage 3 acceptance](../acceptance/session-vmcp-authorization.md)
