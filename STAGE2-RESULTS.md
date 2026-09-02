# Session-scoped vMCP broker — Stage 2 results

**Status:** evidence record for the root-internal Stage 2 proof. It is not a claim that
an operator-facing broker is deployed.

## Result summary

| Evidence | Status | Result |
|---|---|---|
| Stable neutral routes and session-local wrappers | PASS (hermetic) | `Runtime.OpenSession` creates wrappers with private `BackendID` routes; the model-facing spec has no broker route or credential fields. |
| One protected ToolHive upstream flow | PASS (hermetic) | The in-process proof follows the embedded ToolHive `/oauth/authorize` flow, exchanges the returned downstream code at ToolHive `/oauth/token`, and calls a protected streaming-HTTP MCP backend with ToolHive's injected upstream credential. |
| Anonymous broker route | PASS (hermetic) | The standard streaming-HTTP wrapper proof covers an `auth:none` route. |
| Process/session teardown | PASS (hermetic) | `SessionTools.Close` rejects new calls, drains calls and its transport, then forgets its session; `Runtime.Close` closes session resources before shared closers. |
| Deployed composition path | BLOCKED | No `app.Build`, server control surface, or mecatui wiring constructs this Runtime. The proof is root-internal only. |
| Manual public documentation-server smoke | PASS (manual, v0.45.0) | `go run ./.scratch/vmcpbroker-ac54` composed a loopback embedded ToolHive authserver/vMCP gateway over `https://modelcontextprotocol.io/mcp`, initialized authenticated `/mcp`, listed three tools, and completed `docs_search_model_context_protocol`. It is a vMCP boundary proof; the Runtime control lifecycle is separately proven hermetically. |
| Residual ToolHive goroutine evidence | OBSERVED | The unfiltered post-close capture found seven `github.com/lestrrat-go/httprc/v3` goroutines after `vmcpServer.Stop` and `authServer.Close`; see the lifecycle finding below. No goleak exclusion was added. |

## Runtime and dependency surface

The runtime is `internal/adapter/vmcpbroker.Runtime`. It is root-internal: neither
`engine/` nor `engine/port` contains ToolHive, OAuth, Kubernetes, or broker types.
The public-in-package Stage 2 control operations are `OpenSession`, `Connect`,
`Disconnect`, `Callback`, `ForgetSession`, and `Close`. They are composition-private;
there is no wire endpoint and the model never supplies a backend ID.

The root module pins `github.com/stacklok/toolhive v0.45.0`. The implementation and
hermetic composition proof use these ToolHive APIs:

- `runner.NewEmbeddedAuthServerWithStorage`, `EmbeddedAuthServer.Handler`, and
  `EmbeddedAuthServer.Close` for the embedded authorization server;
- `storage.ClientRegistry.RegisterClient` for the broker's generated downstream
  public client;
- `factory.NewIncomingAuthMiddleware`, `vmcpserver.New`, `Server.Handler`, and
  `Server.Stop` for the vMCP boundary;
- `vmcp.NewImmutableRegistry`, `aggregator.NewDefaultAggregator`,
  `vmcpclient.NewHTTPBackendClient`, `vmcpauth.NewDefaultOutgoingAuthRegistry`, and
  `strategies.NewUpstreamInjectStrategy` for static backend routing and upstream-token
  injection.

ToolHive owns the upstream OAuth interaction through its v0.45.0 default upstream
HTTP client. The accepted integration surface exposes no mecatl injection seam for
that client. Consequently, this Stage 2 proof makes no claim that mecatl enforces a
no-proxy, DNS-pinned, or redirect-bounded policy for ToolHive's upstream OAuth
traffic.

## Explicit limitations

- The Runtime creates a generated public downstream client with
  `ClientRegistry.RegisterClient`. ToolHive v0.40.0's `storage.ClientRegistry` has no
  `RemoveClient` method, so that dynamic client registration cannot be removed
  independently; the embedded authserver owns and closes its storage. This is the DCR
  removal limitation, not a reason to add a private removal API or a second OAuth
  implementation.
- One protected backend is supported. ToolHive does not expose
  `ConnectUpstream(existingAuthSession, upstream)`, so a second protected backend and
  reconnect after `Disconnect` return `ErrUnsupportedCapability` rather than create a
  second authorization lineage.
- This path does not reuse direct-MCP `mcp.OAuthController`, the `mcp/oauthlogin`
  loopback runtime, `internal/app.LoginMCP`, Ozz lifecycle, the global MCP manager, or
  global `MCP_<NAME>_TOKEN` credentials. It uses the same ordinary streaming-HTTP MCP
  client wrapper shape, but owns a distinct broker/session credential boundary.
- Runtime/session bindings, transactions, grants, refresh state, transports, and
  tombstones are process-local. They are deliberately absent from snapshots and are
  reset on restart; there is no silent fallback to direct/global MCP.

## Manual smoke boundary

The public smoke target is `https://modelcontextprotocol.io/mcp` and runs outside
`task test`:

```sh
go run ./.scratch/vmcpbroker-ac54
```

On 2026-08-27, against ToolHive v0.45.0, the scratch-only loopback gateway
successfully initialized the remote backend through embedded vMCP, initialized
an authenticated local `/mcp` client, listed three documentation tools, and
called `docs_search_model_context_protocol`. Its redacted result is
`.scratch/vmcpbroker-ac54/result.json`.

This proves the real ToolHive vMCP boundary, not a shipped composition root or
the broker Runtime control lifecycle. The latter is covered by the hermetic
`TestSessionVMCPBroker_RuntimeOwnsEmbeddedVMCPVertical` proof. The scratch driver
is operator-run evidence only and is not part of `task test`.

## Post-close lifecycle finding

After the scratch smoke closed its vMCP server and embedded authserver, the
unfiltered capture at `.scratch/vmcpbroker-ac54/post-close-goroutines.txt` found
seven residual goroutines from `github.com/lestrrat-go/httprc/v3`: five
`worker.Run` workers, one `ctrlBackend.loop`, and one `Client.Start.func2`
waiter. Their common creation site is `httprc.(*Client).Start`. This is retained
as an upstream ToolHive-dependency finding; no goleak exclusion or suppression
was added.

## Stage 3 decision

**NO-GO for shipping Stage 3 conversation integration now.** The private Runtime,
hermetic lifecycle proofs, and public vMCP boundary smoke are available, but an
operator-accessible composition path remains absent. Stage 3 may proceed only after a
composition root can safely create the Runtime, reserve the canonical session before
`OpenSession`, and authorize the trusted control caller. It must then add parking and
exact original-call continuation around the existing private `Connect` primitive; it
must not add another OAuth client, credential lifecycle, or dynamic catalogue path.

## Related documents

- [ADR 0284 — Session-scoped vMCP broker](docs/adr/0284-session-scoped-vmcp-broker.md)
- [Session-scoped vMCP broker acceptance plan](docs/acceptance/session-vmcp-broker.md)
- [Architecture: extensibility](docs/architecture/extensibility.md)
