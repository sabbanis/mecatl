# ToolHive vMCP/auth-server reuse review

Review target: `main...acc/session-vmcp-broker`

## Verdict

The Stage 2 branch has a solid ToolHive integration proof, but the production `vmcpbroker.Runtime` reimplements too much downstream OAuth behavior. The mecatl-specific route projection and session correlation are justified; token acquisition, refresh, and authorization-failure detection should use existing OAuth/ToolHive seams.

## Findings

### High — protected calls can be replayed after an ambiguous result

`internal/adapter/vmcpbroker/runtime.go` (`brokerTransportUnauthorized`) classifies authorization failure by searching for `"unauthorized"` in Go error text and model-facing `ToolResult.Content`, then refreshes and repeats the MCP call.

A backend can return an error containing that word after performing a mutating operation, causing the operation to execute twice. This conflicts with Stage 3's exact-once continuation requirement.

**Recommendation:** install a session-scoped `oauth2.TokenSource` in the MCP HTTP transport so a current bearer is obtained before dispatch. Never infer authentication state from tool output and never automatically replay an ambiguously completed tool call.

### High — token expiry and type are discarded

`internal/adapter/vmcpbroker/runtime.go` (`downstreamGrant`, `exchangeDownstreamCode`, and `exchangeDownstreamRefresh`) retains only access- and refresh-token strings. It discards token type, expiry, and other standard response semantics, forcing reactive refresh after a failed MCP operation.

**Recommendation:** retain `oauth2.Token` and use `oauth2.Config.Exchange`, `oauth2.Config.TokenSource`, or `oauth2.ReuseTokenSourceWithExpiry`. Scope the source to the mecatl session lifecycle so `ForgetSession` cancels only that session's work.

### High — code exchange and refresh duplicate bounded implementations

`internal/adapter/vmcpbroker/runtime.go` (`exchangeDownstreamCode`, `refreshDownstreamGrant`, and `exchangeDownstreamRefresh`) manually constructs token requests, interprets status codes, decodes unbounded response bodies, preserves rotated refresh tokens, and coordinates concurrent refreshes.

Existing applicable APIs include:

- `golang.org/x/oauth2.Config.Exchange`;
- `golang.org/x/oauth2.Config.TokenSource`;
- ToolHive `oauthproto.NewFormRequest`;
- ToolHive `oauthproto.DoTokenRequest`;
- ToolHive `oauth.NewNonCachingRefresher`.

`oauthproto.DoTokenRequest` bounds token responses to 1 MiB and parses OAuth errors. For refresh, `x/oauth2.Config.TokenSource` is the better fit because it can capture a session lifecycle context; ToolHive's `NonCachingRefresher` performs refresh using `context.Background()`.

### Medium — OAuth endpoints are reconstructed from issuer

`internal/adapter/vmcpbroker/runtime.go` (`toolHiveAuthorizeEndpoint`, `toolHiveTokenEndpoint`) derives `{issuer}/oauth/authorize` and `{issuer}/oauth/token`. ToolHive supports a distinct `AuthorizationEndpointBaseURL`, and advertised discovery metadata is the authoritative contract.

**Recommendation:** have trusted composition pass the resolved authorization and token endpoints explicitly. Alternatively, consume ToolHive RFC 8414 metadata once its handler is reachable. Do not infer both solely from issuer.

### Medium — auth-server ownership belongs above Runtime

`internal/adapter/vmcpbroker/runtime.go` (`toolHiveClosers`) makes `Runtime.Close` close an injected `EmbeddedAuthServer`. The Stage 3 process bundle will own the vMCP server, Runtime/session transports, and embedded auth server.

**Recommendation:** make Runtime borrow the auth server and let the process bundle enforce shutdown ordering. `EmbeddedAuthServer.Close` already owns and closes its supplied storage, so storage must not be closed separately.

### Low — direct Fosite client construction is currently justified

`internal/adapter/vmcpbroker/runtime.go` (`NewToolHiveRuntime`) constructs `fosite.DefaultClient` and calls ToolHive `ClientRegistry.RegisterClient`. This is an abstraction leak, but ToolHive v0.45.0 has no equivalent public `RegisterPublicPKCEClient` lifecycle API. DCR and delegate clients have different semantics.

Keep this isolated for now. A useful upstream ToolHive API would register a public PKCE client and return an unregister/lease handle. Update the stale v0.40.0 comment: the branch uses ToolHive v0.45.0.

## Correct reuse already present

- ToolHive `EmbeddedAuthServer` is reused rather than implementing an authorization server.
- Integration tests exercise ToolHive incoming-auth middleware, aggregator, session factory, vMCP server, and upstream bearer injection.
- `internal/adapter/mcp.Connect` is reused for streaming-HTTP MCP transport.
- `CompileProfiles`, stable mecatl tool wrappers, session correlation, tombstones, and `ForgetSession` are justified mecatl-specific glue.
- Storage is not closed separately from `EmbeddedAuthServer`.
- Direct vMCP construction is test-only by the Stage 2 design; the final command-root task must compose `vmcpserver.Server.Handler` rather than reproduce ToolHive handlers.

## Recommended plan action

Add a focused prerequisite repair before protected-call continuation:

1. replace manual code exchange with `x/oauth2`;
2. retain complete `oauth2.Token` state;
3. install a session-scoped token source in the MCP HTTP transport;
4. remove string-based unauthorized detection and automatic call replay;
5. move embedded auth-server ownership to the process bundle;
6. pass authoritative OAuth endpoints from trusted composition.

The automatic replay issue must be resolved before the dispatch/continuation tasks claim exact-once protected-call behavior.
