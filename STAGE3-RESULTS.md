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
from a non-holder to a holder. One protected backend is supported; protected-backend
reconnect is an explicit limitation. Runtime grants, transports, pending browser
transactions, refresh operations, and downstream tokens are process-local and reset
on restart; only the opaque enrollment identity and pending session continuation are
durable. The event log records the normal continuation, not OAuth material. ToolHive
owns upstream OAuth and its upstream HTTP client has no mecatl proxy, DNS-pinning, or
redirect-policy injection seam.

## ToolHive reuse review

The final Stage 3 mounting path reuses `EmbeddedAuthServer`, the ToolHive vMCP server
handler, incoming-auth middleware, aggregator, session factory, and `HandlerBundle.Mount`.
It adds no OAuth server or vMCP protocol implementation and no second listener or route
literals. The remaining limitation identified in `TOOLHIVE-REUSE-REVIEW.md` remains:
ToolHive has no public public-PKCE client registration lifecycle API, so the isolated
Fosite client registration stays necessary. Production sidecar, ingress/Helm/Kind
external-callback topology is deferred to Stage 5.
