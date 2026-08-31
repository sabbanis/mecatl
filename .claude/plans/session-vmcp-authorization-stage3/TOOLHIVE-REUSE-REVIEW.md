# ToolHive v0.45.0 vMCP/auth-server reuse review

Review target: `acc/session-vmcp-authorization` after the deterministic bundled
workspace-enrollment vertical.

## Verdict

No further safe consolidation is available through ToolHive v0.45.0's public APIs.
The earlier Stage 2 duplication findings have been resolved: mecatl no longer performs
manual upstream token requests, infers authorization failure from tool output, or replays
an ambiguously completed MCP call. The final path composes ToolHive's authserver, incoming
and outgoing auth, vMCP server, backend client, aggregator, registry, session factory, and
upstream-token service directly. The remaining mecatl code enforces session ownership,
private routing, all-or-nothing catalogue admission, and lifecycle requirements that the
public ToolHive API does not provide.

## Exact ToolHive APIs reused

`internal/adapter/vmcpbroker/runtime.go` (`NewToolHiveProcess`) uses:

- `runner.NewEmbeddedAuthServerWithStorage` and `EmbeddedAuthServer.Handler`,
  `KeyProvider`, `IDPTokenStorage`, `UpstreamTokenRefresher`, and `Close` for the one
  process-owned authorization-server authority;
- one ordered `[]authserver.UpstreamRunConfig`, containing the real
  `OIDCUpstreamRunConfig` or `OAuth2UpstreamRunConfig` for every protected profile;
- `upstreamtoken.NewInProcessService` and `GetValidTokens` for provider-scoped access to
  ToolHive's stored/refreshed upstream credentials;
- `factory.NewIncomingAuthMiddleware` for incoming vMCP authentication and auth metadata;
- `vmcpauth.NewDefaultOutgoingAuthRegistry` with
  `strategies.NewUpstreamInjectStrategy` for backend bearer injection;
- `vmcpclient.NewHTTPBackendClient`, `aggregator.NewConflictResolver`, and
  `aggregator.NewDefaultAggregator` for real backend capability requests and routing;
- `vmcp.NewImmutableRegistry` for the configured backend registry;
- `vmcpsession.NewSessionFactory` and `vmcpserver.New`, followed by `Server.Handler`, for
  the single embedded Streamable HTTP vMCP server.

`internal/adapter/vmcpbroker/runtime.go` (`QueryAuthenticatedCapabilities`) deliberately
retains the provider-scoped `aggregator.Aggregator.QueryCapabilities(ctx, backend)` API.
ToolHive documents `QueryAllCapabilities` as gracefully continuing after backend failures,
so it cannot implement bundle-wide fail-closed admission.

## Resolved findings from the Stage 2 review

- `internal/adapter/vmcpbroker/runtime.go` (`exchangeDownstreamCode`,
  `exchangeDownstreamRefresh`) uses `oauth2.Config.Exchange` and
  `oauth2.Config.TokenSource`; complete `oauth2.Token` state, including type and expiry,
  is retained in `downstreamGrant`.
- `internal/adapter/vmcpbroker/runtime.go` (`scopedGrantTokenSource`) supplies a
  session-scoped token source to the MCP HTTP transport. Refresh occurs before dispatch;
  there is no string-based unauthorized classifier and no automatic replay of a completed
  MCP operation.
- `internal/adapter/vmcpbroker/runtime.go` (`validatedToolHiveRuntimeConfig`) receives and
  validates trusted authorization and token endpoints rather than reconstructing them
  from an upstream issuer.
- `internal/adapter/vmcpbroker/runtime.go` (`installToolHiveProcessClosers`,
  `Runtime.Close`) keeps ownership above the borrowed Runtime components and shuts down
  session transports, vMCP, the embedded authserver (which owns storage), then the shared
  auth context.

These `x/oauth2` calls are the downstream public-PKCE client of ToolHive's embedded
server, not a second upstream OAuth implementation. ToolHive remains the sole owner of
the ordered upstream consent chain, upstream exchange/refresh, storage, and bearer
injection.

## Mecatl-owned residuals that cannot be delegated

- `internal/adapter/vmcpbroker/runtime.go` (`newProtectedToolHiveConstruction`,
  `toolHiveProviderName`) preserves operator profile order, maps profile names to
  collision-checked private DNS-label provider keys, and binds each backend's
  `UpstreamInject.ProviderName`. ToolHive accepts provider names but does not map mecatl
  profile identities or enforce their secrecy boundary.
- `internal/adapter/vmcpbroker/runtime.go` (`NewToolHiveRuntime`) directly registers one
  generated Fosite public PKCE client. ToolHive v0.45.0 exposes no public
  register/unregister lifecycle API for this client shape; DCR and delegate-client APIs
  have different authority semantics. `ClientRegistry` also has no public removal method,
  so `toolHiveClosers` only uses an optional remover when an implementation supplies one.
- `internal/adapter/server/workspace_enrollment.go` (`Service.ConnectWorkspaceServices`)
  enforces verified ownership before broker state is consulted;
  `internal/adapter/vmcpbroker/runtime.go` (`Connect`, `OpenSession`, `ForgetSession`)
  admits only canonical parent sessions, rejects delegation-child IDs, correlates opaque
  browser state, and scopes cancellation/tombstones to one mecatl session. ToolHive has no
  matching mecatl owner/session admission API.
- `internal/adapter/vmcpbroker/workspace_enrollment.go` (`ConnectWorkspaceServices`) starts
  the one ToolHive ordered chain through its first upstream. There is still no public
  targeted `ConnectUpstream(existingAuthSession, upstream)` API, so independent backend
  connect/reconnect is neither emulated nor exposed.
- `internal/adapter/vmcpbroker/runtime.go` (`QueryAuthenticatedCapabilities`) constructs a
  ToolHive identity containing exactly one private provider token, invokes
  `QueryCapabilities`, then projects only neutral tool definitions. This adapter-private
  bridge is necessary to keep provider keys, auth-session IDs, and tokens out of engine
  tools, events, snapshots, arguments, and results.
- `internal/adapter/vmcpbroker/workspace_enrollment.go` (`freezeProtectedCatalogue`) stages
  every provider-scoped result, validates backend identity/name/schema/UTF-8/size,
  collision-checks the whole set against anonymous and protected tools, and mutates the
  session catalogue only after all candidates pass. ToolHive's aggregate convenience path
  is partial-tolerant and does not provide mecatl's atomic, session-local freeze.
- `internal/adapter/vmcpbroker/runtime.go` (`Runtime.Close`) retains explicit shutdown
  ordering because the ToolHive components are individually constructed public APIs; no
  public aggregate owner exposes the required mecatl session-drain-before-process-close
  lifecycle.

## Remaining upstream limitations

1. No targeted `ConnectUpstream` operation for an existing auth session; bundled consent
   remains ordered and independent reconnect remains unsupported.
2. No public PKCE-client registration lease/unregister API.
3. No upstream OAuth HTTP-client injection seam, so mecatl cannot apply its proxy,
   DNS-pinning, private/additional-origin, or redirect policy inside ToolHive. Unsupported
   policy is rejected at configuration instead of accepted inertly.
4. `QueryAllCapabilities` is explicitly partial-tolerant; all-or-nothing enrollment must
   continue to call `QueryCapabilities` once per backend and stage results in mecatl.
5. No public aggregate constructor owns the exact embedded authserver/incoming-auth/vMCP/
   registry/backend-client/aggregator/session-factory graph and shutdown order required by
   this in-process composition.
6. ToolHive's residual `httprc` goroutines remain an upstream lifecycle finding. Mecatl
   carries no goleak exclusion.

The deterministic two-protected-backend proof is
`internal/adapter/vmcpbroker/bundled_vertical_test.go`
(`TestBundledWorkspaceEnrollment_Scenario11_TwoBackendVertical`). It is an offline TLS
fixture, not a live GitHub Scenario 11 qualification. The earlier Task 09 Mode B run used
one protected backend and a static catalogue and remains separate evidence.
