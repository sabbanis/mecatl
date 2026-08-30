---
id: 08-command-root-https-vertical-and-documentation
title: Command-root HTTPS vertical and final documentation
blocked_by:
  - 07b-configured-toolhive-broker-construction-and-handler-bundle
status: completed
branch: plan-session-vmcp-authorization/08-command-root-https-vertical-and-documentation
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/session-vmcp-authorization
---

# Task brief

Mount the complete broker handler bundle supplied by `app.Build` on each command root's existing primary HTTP mux and listener; start no second listener. Own route mounting and collision checks only: keep broker authorization, token, Streamable-HTTP vMCP, and exact callback routes separate from health, drain, metrics, API, and control routes. Apply the previously implemented caller-identity and loopback-only ownership policy.

Prove the command roots with loopback TLS: `mecated` and `mecak8s` must reach the mounted broker routes through HTTPS without calling Runtime callback methods directly. Complete the Stage 3 documentation, resource inventory, and evidence. After the config-driven end-to-end protected-flow proof is green, repeat the ToolHive authserver/vMCP reuse-and-deduplication review against the final Stage 3 diff; compare it with `TOOLHIVE-REUSE-REVIEW.md`, verify that the construction/mounting path has not reintroduced duplicated OAuth or vMCP protocol behavior, and record any remaining ToolHive API limitation honestly in `STAGE3-RESULTS.md`. Production sidecar exposure, ingress/Helm/Kind topology, and external callback deployment remain Stage 5.

## Acceptance criteria

- AC2.7: A remotely reachable broker control plane fails startup unless verified caller
  identity enables ownership enforcement. Ownerless broker controls are permitted only
  for an explicitly local/loopback single-user composition, never a network-reachable
  mecak8s deployment.
  - verify: `TestInvariant_remote_mcp_broker_requires_verified_ownership`
- AC8.6: Broker-mode deployment documentation and command diagnostics state the
  single-process/single-replica requirement. When two services share a store and lease,
  the non-holder fails closed with leased-elsewhere and never interrupts, rechecks, or
  executes while the original holder's lease is live; no transparent routing claim is
  made.
  - verify: `TestSessionMCPAuthorization_Scenario8_NonHolderFailsClosed`
- AC8.7: ADR 0027 inventories Runtime construction, session transports, pending
  transactions, the durable pending snapshot, lease ownership, and the expiry worker with
  explicit cleanup and restart decisions.
  - verify: inspection — cloud-native resource and rehydrate-fidelity ledgers require review
- AC10.2: A real mecak8s command-root test starts loopback TLS from a broker-mode settings
  file, reaches the mounted auth/callback/control handlers over HTTPS, and does not invoke
  Runtime callback methods directly from the test.
  - verify: `TestSessionMCPAuthorization_Scenario10_Mecak8sCommandRootVertical`
- AC10.3: `STAGE3-RESULTS.md` records deterministic and command-root evidence and the
  one-protected-backend, reconnect, process-local, single-replica, event-source, upstream
  egress, and ToolHive lifecycle limitations without suppression.
  - verify: inspection — result claims and known limitations require review
