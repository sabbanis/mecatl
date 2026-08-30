---
id: 09-live-saas-mcp-qualification
title: Manual real-SaaS MCP qualification
blocked_by: [08-command-root-https-vertical-and-documentation]
status: pending
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Perform the terminal human-operated qualification after the deterministic command-root proof is green. This task is intentionally OUTSIDE `task test`: it makes real network requests, needs operator-provided credentials and a browser, and must never run automatically. It is successful only when `STAGE3-RESULTS.md` records an honest PASS, FAIL, or BLOCKED result for both modes. Do not claim the Stage 3 broker works against SaaS until Mode B passes.

Use one mecak8s replica for every active qualification run. Do not restart, roll, or scale it while an authorization is pending: broker transactions, grants, and transports are process-local. An active lease on a second service must fail closed, never route a recheck or continuation to the holder.

## Shared prerequisites

Before either mode, obtain from the operator:

1. A target cluster/namespace and one-replica mecak8s deployment.
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

## Mode B — GitHub remote OAuth-protected MCP server

Use broker mode with exactly one OAuth-protected GitHub remote MCP backend. Retain Mode A's docs backend only if a mixed anonymous-plus-one-protected catalogue is useful; never configure a second protected backend.

Before execution, the operator must provide or approve current official GitHub values:

- remote Streamable HTTP MCP endpoint;
- OAuth/OIDC issuer/discovery compatibility;
- registered client form (preregistered client or CIMD) and the exact allowed redirect URI;
- secret reference (never a secret value in YAML);
- least-privilege scope(s), organization/SSO consent conditions, and a harmless tool name;
- a dedicated low-privilege GitHub identity and disposable/test repository or other non-production target;
- any GitHub-side audit/request evidence available for the selected operation.

Template only — replace placeholders from current official GitHub documentation:

```yaml
mcp:
  mode: broker
  broker:
    callback_url: https://<public-host>/<exact-callback-path>
  servers:
    - name: github
      url: <current-github-remote-mcp-streamable-http-url>
      auth:
        mode: oauth
        oauth:
          issuer: <current-github-oauth-or-oidc-issuer>
          client:
            mode: preregistered
            preregistered:
              id: <registered-client-id>
              secret_env: MECATL_GITHUB_MCP_CLIENT_SECRET
          scopes: [<minimum-read-only-scope>]
          network: {}
```

Run the exact sequence as the same authenticated owner:

1. Create a session through the attached mecatui or authenticated API.
2. Prompt a single harmless read-only GitHub MCP tool call against the designated test target.
3. Confirm the session parks with `mcp.authorization.required`, retaining only safe correlation data.
4. Confirm there is zero protected GitHub operation before authorization.
5. Fetch presentation as the same owner and open the URL in a controlled browser profile. Do not record the URL.
6. Complete provider consent. Confirm the browser reaches the exact configured callback route and receives the fixed success response; do not retain query material.
7. Recheck exactly the emitted authorization ID as the same owner.
8. Confirm a normal result/completed session and exactly one GitHub-side protected read operation.
9. Recheck again. It must return NotFound/404 and must not generate another protected operation.

Acceptance:

- real browser authorization, public callback, and service recheck complete through mecak8s;
- one and only one harmless protected GitHub operation occurs after the recheck;
- no protected operation occurs before callback/recheck;
- the duplicate continuation fails closed;
- safe events/UI/control responses/evidence contain no client secret, token, code, state, verifier, browser URL, private route ID, or effective arguments;
- no broker transaction is resumed after a pod restart; a restart is recorded as the expected interrupted limitation, not retried.

## Evidence and failure classification

Append a sanitized result for each mode to `STAGE3-RESULTS.md` containing deployment revision, one-replica proof, public hostname (if permitted by the operator), session ID, backend label, tool name, safe authorization ID, timestamp, terminal status, and provider-side request-count evidence. State whether a result is PASS, FAIL, or BLOCKED.

- **BLOCKED:** provider endpoint/client/redirect registration, public DNS/TLS/routing, OIDC caller identity, or operator credentials are unavailable.
- **FAIL — pre-authorization:** configuration, discovery, mounting, ownership, or callback-reachability failure; zero protected request is expected.
- **FAIL — authorization:** provider rejects consent/client/scope/callback; cancel or let the transaction expire, then start a fresh attempt.
- **FAIL — post-connected tool:** authorization resolved connected but the ordinary GitHub MCP operation failed. Record it separately; do not rewrite it as an authorization failure.
- **EXPECTED LIMITATION:** duplicate recheck NotFound/404, active non-holder lease rejection, or restart interruption.

After both modes have an honest result, repeat the ToolHive authserver/vMCP reuse-and-deduplication review against the final Stage 3 diff. Compare it to `TOOLHIVE-REUSE-REVIEW.md`; record remaining upstream API/lifecycle limitations without suppression.
