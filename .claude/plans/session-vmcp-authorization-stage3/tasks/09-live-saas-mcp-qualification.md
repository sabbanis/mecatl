---
id: 09-live-saas-mcp-qualification
title: Manual real-SaaS MCP qualification
blocked_by: [08-command-root-https-vertical-and-documentation, 13-toolhive-reuse-consolidation]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Perform the terminal human-operated qualification after the deterministic command-root proof is green. Mode A's already-recorded anonymous-backend evidence remains valid. The amended Mode B is blocked until Task 12 proves Scenario 11's client-owned enrollment controls and two-backend deterministic vertical; the prior GitHub run predates Scenario 11 and must not be reported as proof that bundled enrollment passed. This task is intentionally OUTSIDE `task test`: it makes real network requests, needs operator-provided credentials and a browser, and must never run automatically. The amended task is successful only when `STAGE3-RESULTS.md` records an honest PASS, FAIL, or BLOCKED result for Scenario 11 Mode B without altering the existing Mode A evidence.

Use one mecak8s replica for every active qualification run. Do not restart, roll, or scale it while an authorization is pending: broker transactions, grants, and transports are process-local. An active lease on a second service must fail closed, never route a recheck or continuation to the holder.

## Fresh Kind-cluster bootstrap

Create a new isolated Kind cluster from the **rebased** `origin/main` fixture at `deploy/mecak8s-kind/`; do not reuse a prior Stage 2/3 cluster. Use its dedicated cluster name/context/kubeconfig conventions. Begin in the fixture's mock-provider mode and prove chart rendering, image loading, trusted configuration mounting, one-replica readiness, `/healthz`, and `/readyz` before supplying any real-provider or SaaS secret.

Then layer only the required ToolHive/public-exposure components onto that known-good substrate:

1. Reuse the ToolHive operator/Redis/vMCP lifecycle sequencing from `deploy/mecak8s-vmcp/` where it applies; Yardstick and Keycloak are deterministic topology evidence, not substitutes for either SaaS mode.
2. Before creating public routes, inspect and delete stale ngrok endpoints for the intended reserved domains. Install Gateway API CRDs, the ngrok operator, and the explicit `ngrok` GatewayClass, then wait for the operator and Gateway resources to become healthy.
3. Publish the existing mecak8s **primary HTTP Service** through one public HTTPS hostname. Route `/v1/mcp/broker/...`, the exact callback path, authenticated application control endpoints, `/healthz`, and `/readyz` to that same Service. Do not add a second broker listener and do not derive callback authority from request headers.
4. The ToolHive demonstration's usual two-domain topology is not automatically this feature's topology: this broker derives its authorization/vMCP routes and exact callback from one canonical configured callback origin. Add a second domain only if current SaaS/OAuth-provider requirements demonstrably require it.

`NGROK_API_KEY`, `NGROK_AUTHTOKEN`, reserved-domain details, cloud endpoint identifiers, and all provider credentials are operator secrets. Supply them only through the operator environment/Secret mechanism; never commit, print, or include them in the qualification evidence.

## Shared prerequisites

Before either mode, obtain from the operator:

1. A fresh `deploy/mecak8s-kind/` cluster/namespace and one-replica mecak8s deployment whose mock-mode bootstrap has passed.
2. A public HTTPS hostname/path which routes to mecak8s's primary HTTP listener without rewriting the configured callback path.
3. OIDC caller identity for the mecatl API/control surface and an operator credential accepted by it. Mecak8s has no ownerless broker-control mode.
4. A dedicated low-privilege test identity and a harmless read-only operation for each backend.
5. A safe evidence location. Never store raw OAuth URLs, callback query strings, codes, states, verifiers, access/refresh tokens, client secrets, exact private tool arguments, or full unredacted event logs in the repository or result document.

Preflight through the public hostname:

- `/healthz` and `/readyz` return success;
- the exact configured callback path reaches the same mecak8s process;
- broker paths are reachable through the same primary listener;
- the deployment has exactly one ready replica;
- no legacy `--mcp-server` input or `MCP_<NAME>_TOKEN` configuration is mixed with broker mode.

## Mode A — public unauthenticated MCP documentation server

Use broker mode with one anonymous public documentation MCP backend and no `mcp.broker.callback_url`. Confirm the current official Streamable HTTP endpoint and tool vocabulary immediately before executing; do not rely on a stale hardcoded endpoint. The expected candidate is the official MCP documentation server currently represented by the existing acceptance configuration, but its availability and exact URL are external facts.

```yaml
mcp:
  mode: broker
  servers:
    - name: docs
      url: <current-official-MCP-documentation-streamable-http-url>
      auth:
        mode: none
```

Prompt the attached interactive client to invoke one discovered read-only documentation/search tool for a non-sensitive public fact. Record only the backend label, tool name, timestamp, sanitized result summary, session ID, and terminal status.

Acceptance:

- one broker-wrapped anonymous documentation tool call completes normally;
- no `mcp.authorization.required` event is emitted;
- no OAuth presentation or callback is attempted;
- any server-side/provider observation available shows one harmless request;
- no secret-shaped or private argument content appears in retained evidence.

Mode A validates the session-scoped wrapper/catalogue, real Streamable HTTP transport, public ingress, mecak8s command root, and ordinary completion. It does NOT prove protected authorization.

## Mode B — one-provider live qualification of Scenario 11

Only after Task 12 is green, use broker mode with exactly one OAuth-protected GitHub remote
MCP backend as a live one-provider qualification of Scenario 11. This does not qualify
ToolHive's multi-provider behavior; the deterministic two-backend proof belongs to Task 12.
GitHub is a supported generic OAuth2 target and need not provide OIDC discovery. This manual
journey requires exactly one ready mecak8s replica and a publicly reachable exact HTTPS
callback registered on the GitHub OAuth application; a loopback-only callback or
multi-replica rollout cannot qualify it. Retain Mode A's docs backend only if mixed anonymous
and protected catalogue behavior is useful. Do not claim the already-recorded prompt-triggered
GitHub authorization run passed this amended mode.

Before execution, the operator must provide or approve current official GitHub values:

- remote Streamable HTTP MCP endpoint (`https://api.githubcopilot.com/mcp/` at the time of qualification; confirm it remains current);
- generic OAuth2 authorization and token endpoints (`https://github.com/login/oauth/authorize` and `https://github.com/login/oauth/access_token`; confirm both remain current);
- registered client form (preregistered client or CIMD) and the exact allowed redirect URI;
- secret reference (never a secret value in YAML);
- least-privilege scope(s), organization/SSO consent conditions, and a harmless tool name;
- a dedicated low-privilege GitHub identity and disposable/test repository or other non-production target;
- any GitHub-side audit/request evidence available for the selected operation.

Configuration shape — confirm the public endpoints against current GitHub documentation,
then replace only the operator-specific callback, client ID, and least-privilege scopes:

```yaml
mcp:
  mode: broker
  broker:
    callback_url: https://<public-host>/<exact-callback-path>
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
              id: <registered-client-id>
              secret_env: MECATL_GITHUB_MCP_CLIENT_SECRET
          scopes: [<minimum-read-only-scope>]
          network: {}
```

Do not add `issuer`: generic OAuth2 uses the two explicit endpoints and performs no OIDC
discovery. Keep `network: {}` exactly empty. Additional/private origins and non-zero
redirect limits are rejected because ToolHive cannot enforce those controls on this
upstream path; qualification must not claim otherwise. Supply the referenced client secret
through the deployment Secret/environment only, never as YAML or retained evidence.

Run the exact sequence as the same authenticated owner:

1. Create a session through the attached mecatui or authenticated API and confirm prompt
   input is unavailable while protected enrollment is incomplete.
2. Invoke the client-owned **Connect workspace services** operation. Confirm it is separate
   from permission approval, creates no model-selected `ToolCall`, and retains only safe
   correlation data.
3. Fetch the live enrollment presentation as the same owner and open it in a controlled
   browser profile. Do not record the URL.
4. Complete provider consent. Confirm the browser reaches the exact configured callback
   route and receives the fixed success response; do not retain query material.
5. Recheck the same enrollment as the same owner until the complete one-provider bundle is
   connected. Confirm zero protected GitHub operations occurred before completion.
6. Confirm authenticated discovery succeeds, freezes the session catalogue, and only then
   enables prompt input.
7. Prompt one harmless read-only GitHub MCP tool call against the designated test target and
   confirm exactly one GitHub-side protected read operation.
8. Confirm duplicate, stale, and foreign-owner enrollment controls fail closed without
   changing the frozen catalogue or generating another protected operation.

Acceptance:

- real browser enrollment, public callback, and owner controls complete through mecak8s;
- authenticated discovery occurs only after the complete bundle connects and freezes the
  one-provider protected catalogue before prompting;
- one and only one harmless protected GitHub operation occurs after enrollment and discovery;
- no protected operation occurs before enrollment completes;
- duplicate, stale, and foreign-owner controls fail closed;
- safe events/UI/control responses/evidence contain no client secret, token, code, state,
  verifier, browser URL, private route ID, effective arguments, or user data;
- no grant or catalogue is replayed after pod restart; a fresh bundled enrollment is required.

## Evidence and failure classification

Preserve the existing sanitized Mode A result. Append a new sanitized Scenario 11 Mode B
result to `STAGE3-RESULTS.md` containing deployment revision, one-replica proof, public
hostname (if permitted by the operator), session ID, backend label, tool name, safe enrollment
correlation, timestamp, terminal status, and provider-side request-count evidence. State
whether the amended Mode B result is PASS, FAIL, or BLOCKED.

- **BLOCKED:** Task 12 is not green, or provider endpoint/client/redirect registration,
  public DNS/TLS/routing, OIDC caller identity, or operator credentials are unavailable.
- **FAIL — pre-enrollment:** configuration, ownership, or callback-reachability failure;
  zero protected request is expected.
- **FAIL — enrollment:** provider rejects consent/client/scope/callback, the bundled chain
  fails, or enrollment is cancelled/expired; start a fresh complete bundle.
- **FAIL — authenticated discovery:** enrollment connected but authenticated discovery,
  validation, or catalogue freezing failed; no partial protected catalogue is admitted.
- **FAIL — post-enrollment tool:** the catalogue froze but the ordinary GitHub MCP operation
  failed. Record it separately; do not rewrite it as an enrollment failure.
- **EXPECTED LIMITATION:** duplicate/stale/foreign controls fail closed, active non-holder
  lease rejection, or restart requiring fresh enrollment.

After both modes have an honest result, repeat the ToolHive authserver/vMCP reuse-and-deduplication review against the final Stage 3 diff. Compare it to `TOOLHIVE-REUSE-REVIEW.md`; record remaining upstream API/lifecycle limitations without suppression.
