# ADR 0105 — In-process authority attenuation

- Status: Proposed
- Date: 2026-08-12
- Scope: root and delegated agent authority, persisted child resume, and agent-definition identity
- Supersedes: —
- Superseded by: —

## Context

Caller identity and caller separation answer a necessary but different question: who may
access a persisted session. They do not bound what an agent in that session may cause to
happen. `session.Principal` deliberately carries no authority, scopes, credentials, or
claims. Today a model can select a named definition, writable mode, or resume path whose
current configuration exposes a broader child capability than the parent held.

The authority is local to the harness in this phase. It is not an OAuth token, a credential
issuer, a workload identity, or an external gateway protocol. SPIFFE/SPIRE can attest the
pod or broker process, but cannot attest an individual goroutine or session inside the
process. The local invariant must therefore exist before an outbound broker can project it
into a verifiable artifact.

## Decision

1. **Keep the identity axes separate.** Owner answers who may access a persisted
   session; authority answers what a particular run may cause; actor/definition answers
   which agent is acting; workload identity answers which pod or broker process is
   authenticated. Caller separation enforces ownership. This ADR enforces authority and
   binds it to a resolved definition identity. None substitutes for another.

2. **Add `governance.Authority` as the session-free, immutable authority value.** It
   provides canonical serialization, validation, `Intersect`, and `Contains`. v1 has a
   deliberately small vocabulary: canonical exact `tool.ToolSpec.Name` values, permitted
   named definition identities, maximum remaining delegation depth, and immutable
   execution profile constraints (including file-system/direct-write eligibility). A v1
   tool permission is all-or-nothing: it does not parse Bash arguments or create a new
   action-family/resource grammar. Every tool registered in a root or child catalog,
   including dynamic MCP tools and delegation tools, must map to one canonical name;
   unknown, missing, or differently classified names are excluded and denied. Empty,
   none, unrestricted, malformed, and unknown are distinct states; validation and
   intersection fail closed rather than broadening. It contains no rules, policy
   pointers, catalogs, OIDC claim maps, tokens, credentials, headers, raw claims, or
   path locators. `session` persists the value without importing `governance`; the
   inert `session.Authority` placeholder is replaced or superseded through an explicit
   engine API compatibility change.

3. **Bind a compatibility root authority at session creation.** v1 snapshots the
   already-effective root capability surface: the composed catalog, admitted definition
   identities, delegation limit, and immutable execution profile. It preserves today's
   operator configuration and does not require a per-caller/tenant policy merely to run
   mecatl. `Principal` remains ownership/attribution and is not an authority source. The
   snapshot round-trips `sessnap` and survives completed, cancelled, and failed recovery.
   Until #374 adds snapshot integrity, this protects normal application-level paths, not
   a malicious store writer. A future enforced deployment may derive
   `operator ceiling ∩ caller/tenant grant`; that is not implemented or implied by v1.
   A pre-v1 child snapshot with no stored authority resumes only through the documented
   legacy compatibility path; it is not retroactively represented as an attenuated child
   and is outside v1's persisted-child non-widening guarantee. Every newly created v1
   child carries a bound before it can run.

4. **Derive every child through one algebra before child capability is acquired.**

   ```text
   child = parent ∩ resolved definition ceiling ∩ call tightening
   ```

   No term may union with, replace, or widen an earlier term. A model-supplied name,
   catalog request, mode/profile, or delegation request can only narrow. Conversation
   history is never an authority source. The derived authority is captured before a
   background child detaches or a workspace forks, is attached to the child session,
   filters the child catalog, and is checked by dispatch before the existing
   deny-dominant permission evaluator. The evaluator remains a second gate: authority
   answers whether a capability can be held; permission policy answers whether this
   invocation may proceed.

5. **Resume from the persisted bound and live tightening only.**

   ```text
   resumed = persisted child authority
           ∩ current operator denies/revocations
           ∩ non-bypassable platform invariants
   ```

   Resume never reconstructs authority from a current definition, ambient catalog, or
   resuming request. A changed definition may affect a newly created child only through
   a new compatible root snapshot; it cannot strengthen a stored child. Revocations are
   live, non-persisted narrowing inputs: the stored child record remains its original
   immutable maximum, so removing a revocation later does not make a stale save or
   temporary runtime value a new grant. Missing, malformed, or legacy authority follows
   the conservative compatibility behavior. Resume does not upgrade immutable profile
   constraints.

6. **Make definition identity operator-first.** `internal/app` assembles a distinct
   operator definition source/tier and resolves names with operator > explicitly
   configured non-operator > admitted project > user. A lower-tier duplicate of an
   operator-owned name is rejected/hidden with a diagnostic, not selected by source
   order. The one resolved identity and its definition ceiling feed both authority
   derivation and child construction.

7. **Persist only safe, canonical bounds and make them observable without disclosure.**
   The child snapshot stores the canonical authority value and resolved definition
   identity, never secrets or locators. A concise derived-authority summary may appear
   in offline demonstrations/event traces; normal permission denial remains the
   model-visible execution result. Credentials, headers, raw claims, and future
   delegation tokens never enter events, model-facing results, snapshots, or demos.

## Consequences

Composition snapshots the existing root capability surface rather than adding a
caller/tenant-grant resolver. `engine/governance` gains a stable, tested algebra; and
session snapshots gain a durable bound. The child builders must use a derived runtime
authority rather than trusting a shared/prebuilt engine or catalog. This is an intentional
exported-engine API change, so `engine/api/*.txt` and `engine/CHANGELOG.md` must be
updated.

This does not introduce a general authorization-details vocabulary, copy
`governance.Rule` into a session, issue credentials, or claim that an external service
can distinguish parent and child. #374 later adds integrity protection for the same
snapshot fields; a future outbound broker/workload-identity feature can project this
local decision into a sender-bound, target-bound artifact.

## See also

- [Issue #371](https://github.com/stacklok/mecatl/issues/371)
- [ADR 0100 — Caller identity](./0100-caller-identity-threading.md)
- [ADR 0102 — Caller ownership enforcement](./0102-caller-ownership-enforcement.md)
- [Agent identity: outbound hop](../agent-identity-outbound.md)
- [Agent identity model](../agent-identity-model.md)
- [ADR 0002 — Documentation lifecycle](./0002-documentation-lifecycle.md)
