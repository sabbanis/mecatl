# ADR 0226 — Authority attenuation on current main

- Status: Accepted
- Date: 2026-08-12
- Scope: session-owned local capability maxima, persisted provenance, environment compatibility, managed definitions, delegation, and peer forks
- Supersedes: ADR 0105
- Superseded by: —

## Context

Caller identity and caller separation establish who may access an object. They do not establish what an admitted session may make the local harness do. A root created while a catalog is restricted must not receive a later-published tool merely because it resumes, rebuilds, forks, or delegates. Conversely, an owner must be able to begin explicitly new work from old context in a future, separately authorized API.

Current main persists sessions and environments, derives child engines through several delegation paths, supports dynamic catalog material, and can fold durable events. The authority model must bind those paths without treating a workspace path as an authority credential or acquiring runtime resources before deriving the final bound.

## Decision

1. A bound root persists one canonical versioned authority maximum and safe provenance. It describes local harness capabilities and execution posture only: no paths, credentials, headers, runners, catalogs, or raw identity claims.
2. Every child derives by intersection: parent maximum, local operator-managed definition ceiling when present, call execution tightening, and transient operator revocation. A revocation is rechecked before disclosure, hydration, and dispatch; it does not promise to cancel an already executing tool. Derived authority never widens.
3. Owner and parent-lineage authorization occur before parsing a child or fork source’s authority so malformed foreign handles are not an oracle.
4. A run rebuild, resumed child, dynamic tool publication, or progressive ToolSearch exposes only the current catalog intersected with the saved maximum and live revocations. An excluded or unrecognized capability is denied by default. Enforcement applies to advertised specs, lookup, hydration, and dispatch.
5. `EnvironmentRef` and workspace select an environment. Authority limits compatible kind and execution posture, but does not authenticate a filesystem location. Pure control-plane resolution may occur before derivation; providers, environments, runners, MCP managers, registry entries, and other runtime resources may not.
6. Only a local operator-managed definition can supply a definition ceiling. Generic remote drivers retain remote provenance and cannot become managed through project trust.
7. Direct server-created teams are process-bound, non-resumable, and zero-capability in v1. Subagent, Parallel, and Team-tool paths all derive before child construction.
8. `Service.ForkSession` is a peer branch of the same bounded work and copies the source maximum and safe provenance. A future API that intentionally creates a new root from old history is distinct and receives an explicitly newly authorized root snapshot.
9. Pre-feature records are explicitly legacy during rollout. Claimed-v1 missing or invalid metadata fails closed. Supported application paths, not hostile direct store writers or stale-write races, are the guarantee; CAS and integrity protection are deferred.

## Consequences

- Bound sessions do not automatically gain newly published tools; explicit future reauthorization is required for that workflow.
- The capability descriptor and any engine/public persistence changes require compatibility review, API snapshots, and changelog treatment.
- Event-only reconstruction requires explicit authority provenance from its host because existing event history has no implicit creation event.
- External credentials, downstream authorization, resource/action scopes below tool-name granularity, trusted remote managed definitions, durable direct teams, and snapshot tamper resistance remain out of scope.

## Verification

The executable contract is [the authority attenuation reconciliation acceptance plan](../acceptance/authority-attenuation-reconciliation.md). It pins root persistence, run-entry intersection, pre-acquisition derivation, catalog/dispatch enforcement, managed-definition provenance, all delegation paths, peer forks, event reconstruction, and ownership-before-parsing order.
