---
id: 10a-toolhive-bundled-upstream-construction-repair
title: ToolHive bundled upstream construction repair
blocked_by: [10-bundled-workspace-enrollment-domain-and-toolhive-chain]
status: done
branch: "plan-session-vmcp-authorization/10a-toolhive-bundled-upstream-construction-repair"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

Repair Task 10 against ToolHive v0.45.0's existing bundled multi-upstream capability. Current
mecatl construction still routes protected profiles through eager `discoverRoutes` and retains
singleton `oauthBackend` assumptions, so a GitHub-like backend that rejects anonymous
`initialize`/`tools/list` cannot start.

Implement only broker-process/runtime construction:

1. Build one real ToolHive `authserver.UpstreamRunConfig` for every configured protected
   profile in stable configured order. ToolHive's first protected upstream is the bundle
   identity anchor; document and test that order.
2. Map every profile name to a stable, collision-checked, adapter-private DNS-label ToolHive
   provider key. Mecatl names may contain underscores or uppercase. Preserve model-visible
   tool namespaces and never project the private mapping.
3. Set each vMCP backend's `UpstreamInject.ProviderName` to its matching private provider key,
   so backend A can never receive backend B's credential.
4. Preserve eager anonymous discovery. Never construct an MCP manager or call anonymous
   discovery for a protected profile during build/start; Task 11 admits only authenticated
   provider-scoped discovery after bundled consent.
5. Keep static `auth.oauth.tools` optional and parseable as a compatibility/comparison artifact,
   but do not copy it into protected `Process`/`Runtime` catalogue construction. Do not implement
   the bootstrap-discovery CLI.
6. Add one process-owned cancelable context for ToolHive incoming-auth/JWKS work. Close order
   is vMCP server stop, authserver close, then auth-context cancel. Prove bounded lifecycle
   without a goleak exclusion.
7. Keep one process/replica and existing secret boundaries.

Do not add Service controls, aggregate enrollment state, authenticated
`QueryCapabilities`, catalogue admission/rebuilding, mecatui UI, or live SaaS behavior. Use
only ToolHive v0.45.0 public APIs. Do not create one authserver/vMCP authority per backend and
do not emulate independent `ConnectUpstream` behavior.

- AC11.3: Every configured protected profile produces one ToolHive
  `authserver.UpstreamRunConfig` in stable configured order, with the first protected provider
  documented and tested as the bundle identity anchor.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_MultiUpstreamConstruction`
- AC11.4: Every profile maps to a collision-checked adapter-private DNS-label ToolHive
  provider key, and each backend's `UpstreamInject.ProviderName` selects only its matching
  credential while model-visible namespaces remain unchanged.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ProviderNameMapping`
- AC11.5: Broker startup performs no anonymous `initialize` or `tools/list` against any
  protected backend; a protected upstream that rejects anonymous access cannot prevent process
  startup, and no static protected candidate enters the Runtime catalogue.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_ProtectedStartupSkipsAnonymousDiscovery`
- AC11.6: ToolHive incoming-auth/JWKS work uses one process-owned cancelable context; process
  close stops vMCP, closes authserver, then cancels that context without a goleak exclusion.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AuthContextStopsOnProcessClose`
- AC11.7: Anonymous backends retain eager startup discovery and executable routes unchanged
  while protected routes remain deferred until bundled enrollment succeeds.
  - verify: `TestBundledWorkspaceEnrollment_Scenario11_AnonymousCompatibility`
