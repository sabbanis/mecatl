# ADR 0248 — Bundled MCP workspace enrollment

- Status: Proposed
- Date: 2026-08-31
- Scope: pre-prompt user authorization and authenticated catalogue discovery for multiple protected MCP backends
- Supersedes: none
- Superseded by: none

## Context

Some protected remote MCP servers reject anonymous `initialize` and `tools/list`. Static operator catalogues are a compatibility fallback but make a user-delegated SaaS flow depend on operator bootstrap credentials. ToolHive v0.45.0 supports multiple configured upstreams but drives them as an ordered consent chain, not independent per-backend transactions.

## Decision

Keep anonymous backend discovery eager and unchanged. For configured protected backends without a reviewed static catalogue, a session begins in a client-owned pre-prompt workspace-enrollment flow. The client presents one **Connect workspace services** action. It is neither permission approval nor a model-selected tool call, so it reuses neither `PendingMCPAuthorization` nor `StateAuthorizing`. ToolHive completes the configured protected providers in deterministic bundled order. The broker performs authenticated discovery only after every required provider connects, validates and collision-checks the results, freezes one session-local multi-backend catalogue, then enables prompting.

The bundle is all-or-nothing: denial, cancellation, expiry, callback or backend failure, restart, process loss, malformed discovery, or a tool collision exposes no partial protected catalogue and requires a new bundle. A restart replays neither a prior grant nor a prior catalogue. One process/replica remains required. Independent backend connect/retry/cancel is deferred. Static protected `tools:` remains an optional curated fallback; the bootstrap-discovery CLI is deferred.

## Consequences

Users authorize their own workspace services without a bootstrap PAT or configuration rollout. Providers may open multiple consent pages. A restart requires re-enrollment. The catalogue cannot change during a session. ToolHive’s missing targeted `ConnectUpstream` API remains an upstream limitation.

## See also

- [ADR 0245](./0245-session-scoped-vmcp-broker.md)
- [ADR 0246](./0246-configured-resumable-mcp-authorization.md)
- [ADR 0247](./0247-broker-generic-oauth2-upstreams.md)
- [Stage 3 acceptance](../acceptance/session-vmcp-authorization.md)
