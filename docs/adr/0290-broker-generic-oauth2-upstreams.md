# ADR 0290 — Broker-only explicit generic OAuth2 upstreams

- Status: Proposed
- Date: 2026-08-31
- Scope: operator MCP broker upstream selection and generic OAuth2 interoperability
- Supersedes: none
- Superseded by: none

## Context

The session-scoped MCP broker originally treated every protected upstream as OIDC: an
operator supplied an issuer and ToolHive discovered the authorization and token endpoints.
That remains the preferable default because discovery binds the protocol endpoints to one
issuer and avoids duplicating provider metadata in configuration.

GitHub's remote MCP service is the motivating interoperability case. GitHub exposes the
OAuth authorization-code endpoints needed by this broker, but does not expose the OIDC
issuer/discovery contract assumed by the original broker configuration. Treating that
service as incompatible would make the manual SaaS qualification test the wrong protocol
rather than the feature users need.

ToolHive owns the broker's upstream OAuth client and does not expose an HTTP-client seam
through which mecatl can enforce the direct MCP client's additional-origin, private-origin,
DNS-pinning, proxy, or redirect controls. Configuration must not imply that those controls
are active merely because their vocabulary already exists on the shared OAuth profile.

## Decision

Keep OIDC as the broker default. An omitted `auth.oauth.upstream`, or an explicit
`upstream.mode: oidc`, uses the existing exact issuer and OIDC discovery behavior.

Add an explicit broker-only generic OAuth2 variant:

```yaml
mcp:
  mode: broker
  broker:
    callback_url: https://agent.example/v1/mcp/authorization/callback
  servers:
    - name: github
      url: https://api.githubcopilot.com/mcp/
      auth:
        mode: oauth
        oauth:
          upstream:
            mode: oauth2
            oauth2:
              authorization_endpoint: https://github.com/login/oauth/authorize
              token_endpoint: https://github.com/login/oauth/access_token
          client:
            mode: preregistered
            preregistered:
              id: mecatl-github-mcp
              secret_env: MECATL_GITHUB_MCP_CLIENT_SECRET
          scopes: [repo]
          network: {}
```

Both endpoints are required, canonical exact HTTPS URLs without userinfo, query, or
fragment. Generic OAuth2 forbids `issuer`; it does not perform OIDC discovery. Client
credentials continue to use the existing preregistered-client `secret_env` reference (or
another already-supported client declaration). Client secret values never belong in YAML.
No new secret source or secret-value field is introduced.

The selector is accepted only after `mcp.mode` resolves to `broker`. Global/direct MCP
rejects any `upstream` selector and retains its existing OIDC profile, credential store,
login, and transport behavior byte-for-byte. Anonymous broker backends, callback routing,
continuation, and credential custody are unchanged.

For explicit OAuth2, require `network: {}` and reject non-empty `additional_origins`,
non-empty `private_origins`, or non-zero `max_redirects`. Those controls cannot be enforced
on ToolHive's upstream OAuth client, so startup fails rather than accepting inert policy or
claiming enforcement. The configured authorization and token URLs are nevertheless exact
trusted HTTPS endpoints. This is an honest narrower posture, not parity with the hardened
direct MCP OAuth transport.

The broker still permits at most one protected backend. Runtime transactions, grants, and
transports remain process-local, so the supported deployment remains one protected lineage
in one broker process/replica; restart or routing to another replica cannot continue an
active authorization.

## Consequences

GitHub remote MCP and other non-OIDC OAuth 2.0 providers can use the session broker without
weakening or changing the default OIDC route. Operators must register the broker's exact
public HTTPS callback and maintain exact provider endpoints explicitly; endpoint rotation
is therefore a configuration update rather than a discovery result.

Generic OAuth2 does not gain the direct MCP client's additional-origin, private-network,
DNS-pinning, proxy, or redirect guarantees. Configurations asking for the ToolHive-
unenforceable controls fail closed. The one-protected-backend and process-local limits
remain visible deployment constraints rather than being hidden by the broader protocol
compatibility.

## See also

- [ADR 0288](./0288-session-scoped-vmcp-broker.md)
- [ADR 0289](./0289-configured-resumable-mcp-authorization.md)
- [Session vMCP authorization acceptance](../acceptance/session-vmcp-authorization.md)
- [Architecture: session-scoped vMCP broker](../architecture.md#session-scoped-vmcp-broker-stage-3-command-root-proof)
- [Extensibility: MCP](../architecture/extensibility.md)
