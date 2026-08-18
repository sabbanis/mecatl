# Subagent MCP authority attenuation with Cedar and ToolHive vMCP

*Status: research note / working draft. This is not a design record under
[ADR 0002](adr/0002-documentation-lifecycle.md). It explores one open question from
[`docs/agent-identity-model.md`](agent-identity-model.md) and
[`docs/agent-identity-outbound.md`](agent-identity-outbound.md): how we can prove that a
subagent's MCP authority is no wider than its parent's. Any committed direction needs a
new ADR.*

So, an agent can call a set of MCP tools and then spawns a subagent. We want the child to
see fewer tools, use a different identity, and carry less authority. Giving it a smaller
catalog looks like the obvious answer.

However, a smaller catalog is not an authorization boundary. The
child might still hold the parent's bearer token, invoke a hidden tool directly, or carry
a Cedar policy with fewer statements that accidentally authorizes more.

This note works through that problem systematically. It covers what mecatl, ToolHive, and
brood-box already provide, what “subset” can mean for a Cedar policy, what Cedar can prove
today, and the design that appears safest for mecatl's agent identity model.

## The short version

Embedding ToolHive vMCP in mecatl is feasible. Brood-box already constructs vMCP as a Go
library, obtains its HTTP handler, mounts it in-process, and gives its guest a Streamable
HTTP MCP endpoint. Mecatl can use the same shape while keeping its existing official MCP
Go SDK client and its no-stdio rule.

Safe delegation needs more than passing a child policy to vMCP. The useful invariant is:

```text
EffectiveChildAuthority =
    CurrentParentAuthority
    ∩ IssuerApprovedChildAttenuation
    ∩ ManagedCeiling
```

The system should enforce that intersection on every normalized MCP operation. Filtered
tool discovery is useful, but it is UX and defense in depth. A direct call must go through
the same authorization boundary.

Cedar's symbolic tooling can check semantic policy implication for a supported,
schema-bound fragment. That is promising, especially because it can produce a concrete
counterexample. It should be an admission-time proof, not the only runtime boundary.

The safest first version is smaller and more boring:

1. Use operator-defined, finite authority profiles.
2. Derive the child grant by intersection, never from child-authored policy text.
3. Mint a distinct short-lived child credential.
4. Give the child its own MCP manager and vMCP session.
5. Check the live parent ceiling and the child grant on every operation.
6. Deny protocol operations and request fields that the authority model does not cover.
7. Add richer Cedar implication checking later, without removing the live parent check.

## What are we trying to constrain?

Before talking about Cedar, we need to say what “MCP authority” includes. It might mean
any combination of:

- which MCP server the child can reach;
- which operation it can perform, such as `tools/call` or `resources/read`;
- which tool, prompt, or resource it can address;
- which canonical resource URI or backend integration the request resolves to;
- which tool arguments or argument ranges are acceptable;
- which downstream provider credential vMCP may select;
- whether this child may delegate any of that authority again;
- how long the grant remains valid.

A policy that constrains only tool names does not constrain a tool that accepts an
arbitrary repository, URL, namespace, or shell command as input. Likewise, a policy that
constrains a resource URI but ignores aliases and URI normalization may compare one value
and execute another.

The first design task is therefore a protocol and resource inventory. Every operation we
cannot normalize and express in the authority model must be denied for an attenuated
child. Guessing is how an apparently narrow policy becomes a confused deputy.

## What exists in mecatl today?

Mecatl already has several pieces we can build on.

Inbound OIDC claims become a `Principal` in `engine/session/principal.go`
(`PrincipalFromClaims`). Identity comparison uses the exact issuer and subject pair through
`SameIdentity`. Child sessions inherit the parent session owner in
`engine/agent/subagent.go` (`parentCaps.inheritOwner`). That gives us accountability and
object ownership, but it does not yet give the child a distinct downstream capability
identity.

The MCP client is already streaming-HTTP-only. `internal/adapter/mcp/mcp.go`
(`Server.dial`) constructs the official SDK's `StreamableClientTransport`. We do not need a
new transport or a stdio bridge to embed vMCP.

Agent definitions can select MCP servers through `engine/tool/agentsource.go`
(`AgentMCPServer`). `internal/app/agentdefs.go` (`defMCPTools`) handles two cases:

- a reference reuses tools from an existing MCP manager;
- an inline endpoint creates a separate scoped manager with its own URL and headers.

The distinction matters. A reference can narrow which servers appear in a specialist's
catalog, but it reuses the existing downstream connection and credential. It does not make
the child a different principal. An inline endpoint can carry a different credential and
has the right lifecycle shape, but nothing currently derives that credential from the
parent-child relationship.

The current `tools` and `disallowedTools` filters also run before MCP tools are appended.
They do not select individual tools within one selected MCP server. A catalog change may
be useful later, but authorization still belongs at the call boundary.

So, the smallest current integration seam is a named specialist with an inline Streamable
HTTP MCP endpoint and a separately minted credential.

## What does brood-box prove?

The local `../brood-box` checkout provides a concrete vMCP embedding example.
`internal/infra/mcp/provider.go` (`VMCPProvider.Services`) constructs the ToolHive managers,
backend discovery, router and session factories, creates the vMCP server, and obtains its
HTTP handler. `internal/infra/vm/runner.go` mounts that handler into the VM-facing gateway.
`VMCPProvider.Close` owns shutdown.

There is no vMCP subprocess and no stdio MCP server. The guest receives a Streamable HTTP
endpoint at `/mcp`.

That answers one practical question: yes, vMCP works as a library with a caller-owned HTTP
lifecycle.

Brood-box does not answer the attenuation question. Its built-in profiles form a small,
audited order:

```text
observe < safe-tools < full-access
```

That is useful prior art for a finite authority lattice. Its custom-policy mode has no
general proof that a supplied policy is narrower than another policy, and restricted modes
can represent callers as the same ToolHive anonymous client. So, this is an embedding
precedent, not a per-subagent identity precedent.

## What does ToolHive expose?

Mecatl currently pins ToolHive `v0.40.0`. The relevant library surfaces are:

- [`pkg/vmcp/core`](https://github.com/stacklok/toolhive/tree/v0.40.0/pkg/vmcp/core),
  which exposes the vMCP core and identity-explicit operations;
- [`pkg/vmcp/server`](https://github.com/stacklok/toolhive/tree/v0.40.0/pkg/vmcp/server),
  which exposes construction, an HTTP handler, listener startup, and shutdown;
- [`pkg/authz/authorizers/cedar`](https://github.com/stacklok/toolhive/tree/v0.40.0/pkg/authz/authorizers/cedar),
  which maps authenticated requests into Cedar decisions;
- the [vMCP library architecture](https://github.com/stacklok/toolhive/blob/v0.40.0/docs/arch/vmcp-library.md).

The effective path is:

```text
HTTP authentication
  → ToolHive identity
  → vMCP admission
  → Cedar authorization
  → filtered discovery or direct-operation gate
  → backend MCP session
```

ToolHive maps MCP concepts into Cedar actions and resources. Examples include a tool call as
`Action::"call_tool"` over `Tool::<name>`, and a resource read as
`Action::"read_resource"` over `Resource::<uri>`.

A few details are load-bearing for subagent identity:

- vMCP session binding distinguishes issuer and subject;
- Cedar principal construction primarily uses `sub`;
- a delegation actor in `act` does not automatically become the Cedar principal;
- policies must therefore constrain issuer and actor explicitly, or the issuer must mint a
  distinct child subject;
- complex tool arguments are not generally projected as fully structured Cedar values;
  many become presence attributes;
- authorization is created with the vMCP core and is not exposed as a supported per-session
  policy parameter;
- tools, prompts, and resources are represented, but we still need a complete inventory for
  batches, sampling, elicitation, tasks, and future MCP methods.

There are two realistic deployment shapes:

1. Create a separate vMCP core/server for each policy or security domain.
2. Share one vMCP and use one policy set conditioned on trusted child and grant claims.

The first is easier to reason about but can multiply listeners, goroutines, backend
sessions, caches, and health monitors. The second has a smaller resource footprint but
makes claim mapping, cache keys, and shared-policy correctness much more important.

## So... what does “subset” mean?

There are three different answers, and mixing them is dangerous.

### A syntactic subset

The child policy contains fewer policy statements, copies only parent policy IDs, or has a
smaller normalized syntax tree.

This is easy to test. It does not prove less authority.

```cedar
permit(principal, action, resource);

forbid(
    principal,
    action == Action::"write",
    resource
);
```

Delete the `forbid` and the resulting policy set is syntactically smaller. It can now allow
writes.

The direction depends on the policy effect:

- removing a permit normally narrows authority;
- removing a forbid can widen authority;
- adding a condition to a permit normally narrows authority;
- adding a condition to a forbid can widen the final authorization set.

Syntactic restriction is still useful for provenance and a deliberately constrained policy
constructor. It cannot be the security proof.

### A scope subset

We can project authority into an application-owned vocabulary and define containment for
each field:

```text
servers       finite set
operations    finite set
tools         finite set
resources     canonical IDs or a formally defined prefix tree
arguments     typed ranges or exact values
expiry        earlier than or equal to the parent
max depth     less than the parent depth
```

This is feasible when the algebra is explicit. Exact set intersection is easy. A numeric
range is manageable. Canonical path containment can work if we define normalization once.
Arbitrary regular expressions, unrelated globs, or policy snippets bring us back to a much
harder implication problem.

The important implementation rule is constructive derivation:

```text
child = intersect(parent, managedCeiling, requestedNarrowing)
```

The issuer should not accept a claimed child scope and merely compare strings afterward.

### A semantic authorization subset

The actual non-escalation property is:

```text
For every admitted request and entity store:
    if the child policy allows it,
    then the parent policy allows it.
```

Written more compactly:

```text
∀ request, entities:
    Allow(child, request, entities)
      ⇒ Allow(parent, request, entities)
```

A counterexample is any request for which:

```text
Allow(child) ∧ ¬Allow(parent)
```

This is the property we mean when we say that the child cannot do more than the parent. It
also shows why action names alone are insufficient. Cedar decisions depend on principal,
action, resource, context, entity attributes, tags, ancestry, schema, templates,
extensions, and evaluator behavior.

## How Cedar decides

Cedar returns Allow only when at least one permit applies and no forbid applies. Otherwise it
returns Deny. The official semantics are documented in
[Cedar authorization](https://docs.cedarpolicy.com/auth/authorization.html).

This creates several traps for policy comparison:

- a policy set containing only forbids authorizes nothing because of default deny;
- deleting a forbid can widen authority;
- a comparison between individual matching policies is not the same as comparing final
  authorization decisions;
- a policy that errors is skipped by Cedar's decision calculation and reported in the
  diagnostics.

That last point matters. If a child restriction is expressed as a forbid that errors on a
missing attribute, it may fail to restrict anything. ToolHive's adapter currently treats
Cedar evaluation diagnostics as an error and denies, which is safer, but an admission proof
and runtime evaluator still need the same semantics.

Strict validation is necessary. It catches schema and type mistakes. It is not a
containment proof. See [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html).

## Can Cedar prove implication?

Yes, for the fragment supported by Cedar's symbolic compiler.

The official Cedar repository includes `cedar-policy-symcc`, which compiles policy behavior
into symbolic constraints and asks an SMT solver whether one authorization set implies
another. Its API includes `check_implies(child, parent)`:

- [`check_implies` implementation](https://github.com/cedar-policy/cedar/blob/f2594b486f40fb53dbebd683ae09bd2942a0ff6a/cedar-policy-symcc/src/lib.rs#L758-L825)
- [implication query construction](https://github.com/cedar-policy/cedar/blob/f2594b486f40fb53dbebd683ae09bd2942a0ff6a/cedar-policy-symcc/src/symcc/verifier.rs#L183-L192)
- [solver-result handling](https://github.com/cedar-policy/cedar/blob/f2594b486f40fb53dbebd683ae09bd2942a0ff6a/cedar-policy-symcc/src/symcc.rs#L100-L136)
- [Cedar Lean model](https://github.com/cedar-policy/cedar-spec/blob/a3f2accb100fa49ac1347c1c436fa57eb32bd464/cedar-lean/README.md)

The proof is relative to a Cedar `RequestEnv`: one concrete action, one applicable principal
type, one applicable resource type, and that action's context type. A whole-schema proof must
enumerate every request environment and prove the implication in every cell:

- [`RequestEnv`](https://github.com/cedar-policy/cedar/blob/f2594b486f40fb53dbebd683ae09bd2942a0ff6a/cedar-policy/src/api.rs#L3341-L3405)
- [`Schema::request_envs`](https://github.com/cedar-policy/cedar/blob/f2594b486f40fb53dbebd683ae09bd2942a0ff6a/cedar-policy/src/api.rs#L2100-L2106)

Checking one representative action, principal, or current entity snapshot proves only that
case.

### What is outside the proof?

Current symbolic tooling is experimental and intentionally rejects unsupported constructs.
Templates and linked policies need to be prohibited or fully materialized before proof.
Unsupported extensions, partial-expression unknowns, solver `unknown`, compilation errors,
and timeouts must all fail closed.

A successful proof is also versioned evidence, not an eternal fact. It becomes stale when we
change any decision input:

- parent or child policy;
- schema or action applicability;
- action groups;
- entity hierarchy and tag declarations;
- context types;
- templates or template links;
- Cedar extensions;
- Cedar, SymCC, or solver version;
- principal, resource, and argument normalization;
- MCP tool naming or conflict-renaming behavior.

The installed grant therefore needs to bind the hashes or versions of those inputs. A change
must trigger reproof or revocation.

## What did Lucas Kaldstrom's work find?

Lucas Kaldstrom's [`luxas/research`](https://github.com/luxas/research) repository includes
research around Cedar, symbolic reasoning, and policy ordering. The
[`upbound/kubernetes-cedar-authorizer`](https://github.com/upbound/kubernetes-cedar-authorizer)
project applies the same implication approach to Kubernetes authorization.

Its symbolic evaluator builds a policy representing the objects selected by a Kubernetes
selector, then asks whether that policy implies the authorization policy. A counterexample
means the selector would include something the caller is not allowed to access:

- [`selector_conditions_are_authorized`](https://github.com/upbound/kubernetes-cedar-authorizer/blob/c1ce0f60ea3656989adb64a3f57475fe7d131fff/src/cedar_authorizer/symcc.rs#L65-L175)
- [admitted policy invariants](https://github.com/upbound/kubernetes-cedar-authorizer/blob/c1ce0f60ea3656989adb64a3f57475fe7d131fff/src/cedar_authorizer/kube_invariants/policyset.rs)

The project is explicit that it is experimental. It restricts the admitted policy fragment
rather than pretending every Cedar construct is supported. That is the right lesson for us:
semantic implication is real, but production safety starts by defining what we refuse to
analyze.

## How do other delegation systems handle this?

Most systems do not compare two arbitrary general-purpose policies every time a child is
created. They make attenuation structural.

[OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) lets an
authorization server accept subject and actor tokens, then decide which narrower token to
issue. [OAuth resource indicators](https://datatracker.ietf.org/doc/html/rfc8707) bind the
result to an intended service. [DPoP](https://datatracker.ietf.org/doc/html/rfc9449) can bind
a token to a key so a stolen bearer is less useful.

[Macaroons](https://www.ndss-symposium.org/wp-content/uploads/2017/09/04_3_1.pdf) let a
holder append caveats without removing the issuer's caveats. [Biscuit](https://www.biscuitsec.org/)
uses append-only signed authorization blocks. The
[zcap specification](https://w3c-ccg.github.io/zcap-spec/#delegating-capabilities) models a
similar chain of attenuated capabilities.

The common idea is simple: a child can add restrictions, but it cannot erase restrictions
from an earlier hop. That is a better starting point for mecatl than arbitrary child-authored
Cedar.

## The identity model we need

A naive implication check can compare the child policy and parent policy using the same
request principal. That breaks down when the policies intentionally name different actors.
The child request contains `Child::reviewer`, while the parent policy names `Agent::main`.
The parent may deny only because it is looking at a different identity.

We need a trusted relation between:

- the user whose authority is being spent;
- the parent grant being delegated;
- the logical child actor;
- the workload or broker holding the credential;
- the vMCP audience.

A useful runtime decision is:

```text
parentGrantAllows(parentGrantID, operation)
AND
childGrantAllows(childActor, operation)
```

The parent check uses a trusted, immutable grant handle. The child cannot assert its parent
through model-controlled MCP arguments or Cedar context.

The child credential should contain or reference:

```text
issuer
user subject
child actor or instance
parent grant ID and generation
vMCP audience
expiry
maximum delegation depth
sender confirmation, where available
```

SPIRE can attest the pod or process. It cannot attest one goroutine among many subagents.
Mecatl's issuer has to create the logical child identity, while a separate broker can keep
signing keys and provider credentials outside the model-facing loop's address space.

## A staged design

### Stage 0: inventory and normalize

List every MCP operation and nested execution path. Define stable server, operation, tool,
resource, and backend identifiers. Specify URI, path, alias, and argument normalization once.
Deny unknown methods and unmodeled request forms.

This includes checking composite tools. If an optimizer or code-mode tool can call another
tool internally, the inner call must re-enter the same authorization boundary.

### Stage 1: fixed specialist profiles

Support trusted, operator-authored profiles only. A profile is a typed finite authority
value, not arbitrary Cedar text.

For example:

```text
Authority {
    servers
    operations
    tools
    resources
    argument constraints
    mayDelegate
    maxDepth
    expiry
}
```

At spawn time:

```text
child = parent ∩ definition ∩ requested tightening ∩ managed ceiling
```

If any requested capability is not contained, refuse child creation. Do not silently omit the
secure MCP configuration and continue with an unexpected catalog.

### Stage 2: separate credential and manager

After authority derivation succeeds, mint a short-lived credential for the child and create a
separate inline MCP manager. Point it at an embedded vMCP loopback Streamable HTTP endpoint.

Never place the parent bearer, broker signing key, or backend credential in the child prompt,
environment, agent definition, snapshot, event log, diagnostics, or tool result.

### Stage 3: live parent intersection

Authorize each operation only when both the current parent grant and installed child grant
allow it.

This closes an important lifecycle hole. If the parent grant is narrowed or revoked after the
child starts, the child narrows immediately. We do not need to trust an old implication proof
or wait for its token to expire.

Cache keys need every decision input, including issuer, subject, actor, audience, parent grant
and generation, child ID, normalized operation, policy and schema versions, and expiry.

### Stage 4: restricted Cedar templates

If finite profiles become too limiting, introduce an issuer-owned template layer. Parameters
must map to the same typed attenuation algebra. Fully materialize and strictly validate the
result before installation.

Keep custom extensions, arbitrary entity mutation, and child-authored context out of the
first template version.

### Stage 5: semantic implication admission

Only then accept richer Cedar policy sets. The admission service must:

1. Materialize every template-linked policy.
2. Validate both policy sets against one pinned strict schema.
3. Reject unsupported types, extensions, and unknown expressions.
4. Prove important forbids cannot error.
5. Enumerate every schema request environment.
6. Run `check_implies(child, parent)` for each environment.
7. Reject a counterexample, timeout, solver unknown, compilation error, or unsupported
   construct.
8. Store a useful counterexample when admission fails.
9. Bind the proof to all policy, schema, evaluator, solver, extension, and normalization
   versions.
10. Reprove or revoke on change.

Keep the runtime parent conjunction. The proof lets us accept a richer child policy; it should
not become the one thing standing between a stale child and widened authority.

## Design options and trade-offs

| Option | What it buys us | What can go wrong |
|---|---|---|
| Fixed named specialist | Small integration, easy audit, fits current agent definitions | Static policy class, potentially many profiles |
| Shared vMCP with claim-conditioned policy | Reuses caches, sessions, and server resources | One policy has a larger blast radius; claim and cache correctness become critical |
| One vMCP per child or policy | Strong policy and lifecycle isolation | Listener, goroutine, cache, health-monitor, and backend-session cost |
| Live parent gate plus child scope | Monotonic by construction; immediate revocation | Requires a trusted two-gate seam and stable grant identity |
| SymCC admission proof | Richer policies and concrete counterexamples | Experimental solver path, unsupported constructs, proof staleness |
| Reuse the parent MCP manager | No new resources | No distinct credential or authority. This is not attenuation |
| Wrap ToolHive core directly as mecatl tools | Avoids loopback HTTP | Duplicates MCP session behavior and violates the intended Streamable HTTP seam |

The recommended first combination is fixed specialist profiles plus the live parent gate.
Move to a shared claim-conditioned vMCP if per-policy server cost becomes a real problem. Add
SymCC as admission control once the identity and request model are stable enough to prove.

## Failure modes worth pinning down now

A few bugs are particularly easy to ship:

1. The child receives a new MCP session but the same parent bearer.
2. Discovery hides a tool while a direct `tools/call` still reaches it.
3. A smaller child policy drops a parent forbid.
4. The child supplies its own `act`, issuer, parent ID, or grant ID.
5. Two issuers use the same `sub` and collapse into one Cedar principal.
6. A policy constrains a nested argument that ToolHive exposes only as “present”.
7. A new MCP method is routed before admission knows about it.
8. Tool aliases or conflict-renamed names differ between proof and execution.
9. A policy, schema, template, or extension changes after proof.
10. A solver timeout or unsupported construct is treated as success.
11. A cache omits actor or parent generation from its key.
12. A resumed child remints authority from current defaults instead of its persisted ceiling.
13. A parent revocation leaves a long-lived child session usable.
14. A credential is read from storage before authorization resolves one target.
15. Secure child setup fails and the system falls back to a broader or shared catalog.
16. Per-child vMCP instances are not closed on timeout, cancellation, failure, or resume.

## What should we test?

The central property test is:

```text
effectiveChildAllows(request)
    ⇒ currentParentAllows(request)
```

Generate requests across actions, resources, contexts, entity stores, identities, and policy
generations. Include parent forbids, child permits, default deny, missing attributes, entity
ancestry, action groups, and changed schemas.

The integration test should use a real loopback Streamable HTTP vMCP with an offline fake MCP
backend:

1. The backend advertises tools A and B.
2. The parent can list and call both.
3. The child lists only A.
4. A direct child call to B returns a generic denial.
5. The backend's B counter remains zero.
6. A succeeds.
7. No stdio transport or subprocess is used.

Repeat that test for prompts and resources. Add explicit denial cases for batches, sampling,
elicitation, tasks, unknown methods, and composite inner calls.

Identity tests should cover wrong issuer, same subject from a different issuer, wrong audience,
wrong parent grant, wrong child ID, expiry, revocation, cross-session replay, and forged actor
claims.

Cedar fixtures should include:

- deleting a parent forbid widens authority;
- an added child forbid narrows authority;
- an erroring forbid cannot be trusted;
- a policy set containing only forbids authorizes nothing;
- context or MFA conditions produce a counterexample;
- entity ancestry changes a decision;
- template policies are either completely materialized or rejected;
- unsupported extensions and solver unknown fail closed;
- every `RequestEnv` is enumerated;
- a proof/runtime version mismatch refuses installation;
- every symbolic counterexample replays against the exact runtime evaluator.

Lifecycle tests should prove bounded vMCP instances, complete cleanup, no global-manager closure
from child shutdown, revocation during a running child, authority-preserving restart and resume,
and no credential leakage into model-visible or durable data.

## Open questions

We still need explicit answers for these before an acceptance plan:

1. Is the first grant scoped to servers and tools only, or do we require resource and argument
   constraints immediately?
2. Which MCP protocol methods are in the initial protected universe?
3. Should a child have its own `sub`, or should the user remain `sub` while the child appears in
   `act`?
4. Is isolation per child instance, session, named specialist, tenant, or policy hash?
5. Does a running child observe parent revocation immediately, or at the next operation?
6. How is a grant generation persisted and reattached after restart?
7. Are Cedar templates prohibited initially or fully materialized?
8. Which Cedar extensions are in the supported proof fragment?
9. Can ToolHive's request model express every argument constraint we need?
10. How will shared vMCP caches include all authority-changing claims and versions?
11. What resource budget is acceptable for one vMCP server per child or policy class?
12. Where do token signing keys live, and do we require proof-of-possession?
13. What audit record links issuance, child use, parent grant, resolved target, and revocation
    without storing credentials or unnecessary tool arguments?

## Conclusion

So... can we ensure that a subagent's Cedar policy is a subset of its parent's? Yes, if we
mean semantic authorization-set inclusion, pin the schema and evaluator model, stay inside the
supported symbolic fragment, and fail closed whenever the verifier cannot prove it.

But that should not be our first or only control.

The first version should make attenuation structural. Mecatl derives a typed child grant by
intersection, mints a distinct credential, gives the child a separate Streamable HTTP MCP
session, and keeps the parent's current authority as an independent ceiling at every call.
ToolHive vMCP is a good place to enforce the downstream decision, and brood-box shows us how
to embed it without a subprocess.

Once that identity and request model is stable, Cedar SymCC gives us a credible path to richer
policies with machine-checked implication and concrete counterexamples. That is where the
formal work becomes useful rather than decorative.
