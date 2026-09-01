# Stage 3 vMCP broker results

## Evidence

- `TestInvariant_remote_mcp_broker_requires_verified_ownership` proves broker controls
  refuse startup without verified identity on a reachable listener. Only mecated's
  explicit loopback single-user composition may be ownerless; mecak8s never is.
- `TestSessionMCPAuthorization_Scenario8_NonHolderFailsClosed` proves a second service
  sharing store and lease receives `ErrSessionLeasedElsewhere` while the live holder
  retains the lease.
- `TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical` reaches mounted
  authorization, vMCP, and exact callback routes through the mecak8s primary loopback
  TLS listener. The test does not call `Runtime.Callback` directly.

## Limits

This is a single-process/single-replica broker proof. There is no transparent routing
from a non-holder to a holder. Bundled protected backends are admitted all-or-nothing;
independent protected-backend reconnect remains an explicit limitation. Runtime grants, transports, pending browser transactions, and refresh operations remain
process-local and reset on restart; retained ToolHive upstream-token rows are explicitly deleted
provider-by-provider on terminal refresh failure and backend disconnect, and session-wide after
wrapper transport/lifecycle drain on session forget and process close. Cleanup is bounded and
cancel-detached; failed deletion never preserves live in-memory session state and is reported only
as a fixed generic error while its private identity remains available for idempotent retry.
Only the opaque enrollment identity and pending session continuation are durable. The event log records the normal continuation, not OAuth material.
`engine/adapter/eventsource` cannot reconstruct an unresolved private broker
authorization: it returns `eventsource.ErrPrivateStateRequired`, so recovery requires
the authoritative session snapshot. ToolHive owns upstream OAuth and its upstream HTTP
client has no mecatl proxy, DNS-pinning, or redirect-policy injection seam.

## ToolHive reuse review

The final review found no additional safe consolidation through ToolHive v0.45.0's
public APIs. `NewToolHiveProcess` (`internal/adapter/vmcpbroker/runtime.go`) already
composes the exact ToolHive `EmbeddedAuthServer`, ordered `UpstreamRunConfig` list,
incoming-auth middleware, `InProcessService`, outgoing `UpstreamInject` strategy,
immutable registry, HTTP backend client, aggregator, session factory, and vMCP server
handler. `QueryAuthenticatedCapabilities` retains provider-scoped
`Aggregator.QueryCapabilities`; authenticated results are the sole protected catalogue source,
while optional static `auth.oauth.tools` remains configuration-only compatibility data.
`IDPTokenStorage` is retained only through its provider-scoped and session-wide deletion
methods for terminal refresh, disconnect, forget, and shutdown cleanup.
`QueryAllCapabilities` is documented as continuing after
backend failures and cannot satisfy fail-closed atomic catalogue admission.

The earlier Stage 2 duplication findings are resolved. `exchangeDownstreamCode` and
`exchangeDownstreamRefresh` use `x/oauth2` and retain complete token state;
`scopedGrantTokenSource` refreshes before dispatch, so no tool-result authorization
classifier or ambiguous MCP-call replay remains. This is the downstream public-PKCE
client of ToolHive's embedded server; ToolHive remains the sole upstream OAuth,
consent-chain, credential-storage/refresh, and bearer-injection authority.

The mecatl-owned residuals are necessary boundaries: `newProtectedToolHiveConstruction`
and `toolHiveProviderName` provide collision-checked private provider mapping and
`UpstreamInject.ProviderName` binding; `Service.ConnectWorkspaceServices`
(`internal/adapter/server/workspace_enrollment.go`) enforces owner admission before Runtime
provides canonical parent-session correlation;
`freezeProtectedCatalogue` (`internal/adapter/vmcpbroker/workspace_enrollment.go`) stages
and validates every provider result before one session-local freeze; and `Runtime.Close`
preserves session-drain, vMCP, authserver, then context shutdown ordering. ToolHive still
has no targeted `ConnectUpstream`, public PKCE-client registration lease/removal API,
upstream OAuth HTTP-client injection seam, fail-closed all-backend capability query, or
aggregate lifecycle owner for this in-process graph. Its residual `httprc` goroutines
still have no goleak suppression in mecatl.

The deterministic Scenario 11 proof is the offline two-protected-backend TLS fixture
`TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical`; it is not a live GitHub
qualification. The Task 09 Mode B run below used one protected backend and a static
catalogue and remains separate evidence. Production sidecar and ingress/Helm/Kind
external-callback topology remain Stage 5. Full API/symbol evidence is in
`TOOLHIVE-REUSE-REVIEW.md`.

## Qualification run — 2026-08-30

### Public-ingress preflight

- **PASS:** A fresh single-replica Kind deployment was exposed through an ngrok Gateway
  to the existing mecak8s primary HTTPS listener. The Gateway and its ngrok-managed
  domain reached `Accepted=True`, `Programmed=True`, and `Ready=True`; public
  `/healthz` and `/readyz` each returned `200`.
- **PASS:** The ngrok upstream was explicitly configured as HTTPS for the existing
  TLS-enabled HTTP Service. No second mecak8s listener was introduced.
- **PASS:** The public Model Context Protocol documentation server accepted a
  Streamable HTTP `initialize` request and identified itself as `Model Context Protocol`
  using protocol version `2025-06-18`. This check retained no session material.

### Mode A — public documentation MCP

**PASS (2026-08-30T20:47:41Z):** An OIDC owner-bound session was created through the
public ngrok route. With a real provider configured through the fixture Secret, the
broker completed exactly one harmless call to
`mcp__docs__search_model_context_protocol`; its tool result was non-error and the
session ended normally (`end_turn`). No `mcp.authorization.required` event, OAuth
presentation, or callback occurred. Retained evidence is limited to the session ID,
backend label, tool name, terminal status, and sanitized result length; it excludes the
prompt arguments, result text, bearer token, and provider credential.

### Mode B — GitHub OAuth-protected MCP

**PASS (2026-08-31T10:32Z):** A single-replica `mecak8s-mecak8s` deployment (Helm
revision 7, image `ko.local/mecak8s:dev`) exposed through the same public ngrok
route completed the full Mode B journey against GitHub's real remote MCP server
(`https://api.githubcopilot.com/mcp/`) using generic OAuth2 (ADR 0247) with an
operator-declared static tool catalogue (`permconfig.MCPOAuthProfile.Tools`) for
`get_me` (`read:user`).

- Session `48a9a5ae01584379c0da41a47b0f7d04` (OIDC owner-bound, real provider).
- The first `mcp__github__get_me` call parked with `mcp.authorization.required`
  (authorization ID `yxlt-Tclih9VRS40ZHCAv-RlzDjqnhomPOwpj1ondCo`) and recorded
  **zero** GitHub-side operations; its transaction expired before browser
  consent completed (config-fix delay) and its recheck correctly failed closed
  with a transcript-recorded `is_error` tool result (`"MCP authorization
  expired"`) — no GitHub contact.
- A fresh call (authorization ID `AQyOt9ZMcym2YxXyiZUv_v52B9tFPNEzo7SdWccmyf0`)
  completed real GitHub browser consent through the public ngrok callback, and
  one recheck resolved it (`status: connected`) and returned exactly **one**
  successful protected GitHub read (the authenticated user's public profile).
- The duplicate recheck returned `404`/`session not found` and added no further
  transcript entries — the backend-visible request count stayed at one.
- Session transcript confirms totals across both attempts: exactly one `is_error`
  expired result, exactly one successful GitHub-backed result, zero others.

**Two pre-existing bugs surfaced and fixed during this run** (unrelated to the
broker's OAuth2/session-authorization logic itself):

1. `discoverRoutes` (`internal/adapter/vmcpbroker/runtime.go`) previously attempted
   a live, anonymous `initialize` against every configured backend, including protected
   ones. The historical qualification used an operator-declared static catalogue to bypass
   that startup failure. The shipped repair now keeps protected startup discovery disabled
   and admits only post-consent, provider-scoped authenticated `QueryCapabilities` results;
   static `auth.oauth.tools` remains accepted configuration but cannot enter or override the
   protected Runtime catalogue.
2. The GitHub App callback path documented in the original task handover
   (`/v1/mcp/authorization/callback`) collided with mecak8s's own reserved
   `/v1/` route prefix (`cmd/mecak8s/serve.go`'s `ValidateCallbackPath` call),
   crashing broker construction. The operator-facing `callback_url` was moved
   to `/mcp/authorization/callback`. Separately, the actual upstream-facing
   GitHub redirect URI is a *different*, non-configurable, always-mounted path
   (`/v1/mcp/broker/oauth/callback`, derived in `newUpstreamRunConfig`) — the
   handover's instruction to register `callback_url`'s value with GitHub was
   itself incorrect; the GitHub App must register the fixed upstream path
   instead. Both values are now correct and documented in
   `.scratch/task09/GITHUB-OAUTH2-TEST-HANDOVER.md`.
3. (Fixture-only, not mecatl) `deploy/mecak8s-kind/keycloak.yaml`'s `mecatui-kind`
   client was missing `offline_access` from its optional client scopes, and its
   fixture users (`alice`/`bob`) had no `realmRoles` granting it — both fixed.

## Related documents

- [Session vMCP authorization acceptance](docs/acceptance/session-vmcp-authorization.md)
- [ADR 0247 — Broker-only explicit generic OAuth2 upstreams](docs/adr/0247-broker-generic-oauth2-upstreams.md)
