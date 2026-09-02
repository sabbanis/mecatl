---
id: 01-mcp-authority-configuration
title: Canonical MCP authority configuration
blocked_by: []
status: done
branch: ""
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Implement the canonical, strict, operator-tier-only MCP authority configuration described by Scenario 1 of `docs/acceptance/session-vmcp-authorization.md`, ADR 0289, and the broker-only generic OAuth2 extension in ADR 0290. Keep the existing profile resolver as the sole parser. Introduce a typed mutually-exclusive result that selects either the established global manager path or broker declarations, and thread explicit command-root defaults without constructing both paths. Implement the broker callback URL validation and reject unsupported/inert configurations. Preserve legacy global behavior, including rejecting legacy flag/token input and the broker-only upstream selector in global mode. OIDC remains the broker default; explicit generic OAuth2 requires exact HTTPS authorization/token endpoints and rejects ToolHive-unenforceable additional/private origin and redirect controls. Add the required configuration and migration documentation only when the behavior is complete. Do not construct the Runtime or handlers: that is task 02.

## Acceptance criteria

- AC1.1: An omitted `mcp.mode` resolves to `broker` in `mecak8s` and `global` in `mecated` and embedded `mecatui`; `mecatequi` rejects explicit broker mode as an unsupported unattended root. Programmatic composition receives an explicit root default, and an explicit supported-root mode overrides it.
  - verify: `TestSessionMCPAuthorization_Scenario1_RootModeDefaults`
- AC1.2: Global mode preserves byte-compatible `none`, `static_bearer`, OAuth credential, and `mecated mcp login` behavior, and constructs no broker Runtime.
  - verify: `TestSessionMCPAuthorization_Scenario1_GlobalModeCompatibility`
- AC1.3: Broker mode consumes the whole server list exclusively, accepts anonymous profiles plus at most one OAuth profile, rejects `static_bearer`, and never constructs a global MCP manager or direct `OAuthController` for those profiles.
  - verify: `TestSessionMCPAuthorization_Scenario1_BrokerModeIsExclusive`
- AC1.4: Broker OAuth defaults to OIDC discovery. A broker-only generic OAuth2 selector requires exact HTTPS authorization/token endpoints and forbids `issuer`; global/direct MCP rejects the selector and remains unchanged. Broker OAuth reuses client, scopes, refresh intent, and network-policy vocabulary only where the Runtime can apply it. Explicit OAuth2 rejects non-empty additional/private origins and non-zero redirect limits because ToolHive cannot enforce them. Global credential identity/source fields (`profile`, `principal`, and `credentials`) are rejected in broker mode and remain required in global OAuth mode. Configuration and docs make no unsupported egress-enforcement claim.
  - verify: `TestSessionMCPAuthorization_Scenario1_ModeSpecificOAuthSchema`
- AC1.5: `mcp.broker.callback_url` is required exactly when broker mode has an OAuth backend, must be an absolute HTTPS URL without userinfo/query/fragment, and is rejected as inert configuration in global mode. No URL is derived from `Host` or forwarded headers.
  - verify: `TestInvariant_mcp_broker_callback_url_is_trusted_configuration`
- AC1.6: Project-tier `mcp:` remains ignored with a value-free warning; explicit operator files retain whole-block precedence over conventional user settings.
  - verify: `TestSessionMCPAuthorization_Scenario1_OperatorTierOnly`
- AC1.7: Legacy `--mcp-server`/`MCP_<NAME>_TOKEN` stays global-only and conflicts with broker mode instead of overriding, appending to, or dual-mounting broker profiles.
  - verify: `TestSessionMCPAuthorization_Scenario1_LegacyGlobalConflict`
- AC1.8: The generated settings skeleton, configuration reference, usage guide, and user documentation show the root defaults, callback condition, single protected backend limit, and the explicit `mcp.mode: global` migration for existing mecak8s deployments.
  - verify: inspection — generated configuration and migration prose require a documentation review
- AC1.9: The canonical loader parses one lossless strict MCP syntax value, resolves the root default, then applies exactly one global-or-broker validation pass. Its typed result cannot carry both global server configs and broker declarations; programmatic `MCPServers`, injected Runtime, legacy flags, and acquired lifecycle resources obey the same exclusivity and rollback rules.
  - verify: `TestInvariant_mcp_authority_mode_is_single_construction_branch`
