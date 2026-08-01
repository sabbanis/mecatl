# Credential binding for mecatl, from first principles

**Part 1 of 2.** What an ideal binding would look like in a pure mecatl deployment —
the properties and why. Deliberately no mechanism proposals, no claim names, no
changes to vMCP: part 2 surveys what seams exist, and only then does a shape get
argued for. The reason for that order is that `tsid` ended up where it is by
being a reasonable mechanism for per-session credential scoping that later found
itself inside delegated tokens, where its grant-shaped behaviour became a defect.

Sanity-checked against WIMSE (`draft-ietf-wimse-arch`, `-workload-creds`, `-wpt`);
corrections from that pass are marked inline.

---

## "Binding" is four different things

Most of the confusion lives here. These all get called binding and they do not
behave alike:

| | What it says |
|---|---|
| **Holder binding** | only whoever holds this key may use this token |
| **Context binding** | this token can read what is filed under session T |
| **Authority binding** | this token may read this repo |
| **Principal binding** | this is Alice's authority, exercised by the coding agent |

`tsid` is context binding.

> **WIMSE check:** this split is *ours*, not WIMSE's. `draft-ietf-wimse-arch` §4.3
> collapses context and authority into one word — presentation-restriction versus
> consumption-restriction. Principal binding appears only informally in §3.4.7 and
> §3.4.9 with no `sub`/`act` formalism. The four-way split is a refinement of loose
> spec language, and should not be presented as how WIMSE frames things.

## The test that separates them

**Does removing it increase what the holder can reach?**

```
remove the session pointer  →  the holder reaches LESS   →  it was GRANTING
remove the holder key       →  a stolen copy now works   →  it was LIMITING
```

So: **a binding should constrain, never grant.** Anything whose presence increases
reach is a key with the word "binding" written on it.

This reframes the problem. A session pointer inside a delegated token is not
breaking a rule written on a branch — it is the wrong kind of thing in the wrong
place. A key inside a document whose whole purpose is to say "this agent may do
*less* than the user can."

> **WIMSE check:** the one claim WIMSE unambiguously agrees with. §4.3's own framing
> is "constrain," and nowhere does WIMSE describe a binding as additive.

## What the agent does and does not hold

Getting this right matters, because it changes the threat rather than the
conclusion.

```
agent ──MCP call──► gateway
                      │
                      ├─ Cedar: may this actor make this call?   ← the only gate
                      │
                      └─ if allowed: load creds by tsid,
                         inject into the BACKEND request
                         the agent sees the MCP response, never the credential
```

The agent holds a token that authorizes MCP calls. **It never holds the user's
third-party credentials.** So the threat is not exfiltration — it is unauthorized
*use*, the confused-deputy shape.

What is bounded is the set of calls the gateway will make on the agent's behalf.
Cedar is the only thing bounding it, and the token's own narrowing plays no part at
that moment.

> **WIMSE check:** `draft-ietf-wimse-arch` §4.5 names this failure mode directly —
> *"issuers, relying parties, gateways, and workloads need to avoid treating
> successful authentication as implicit authorization."* The session pointer
> authenticates a session and is read as authorizing access to everything in it.

## An agent can never have a `tsid` — which is structural, not a lifetime issue

`tsid` is generated at `authorize.go:93` (`SessionID: rand.Text()`) at the start of
an authorization-code flow, and picked up at `callback.go:108` to key the stored
upstream tokens. So it is minted when **a human begins a browser login**.

Two independent reasons an agent never has one:

1. **There is no browser flow at the agent.** It arrives holding the user's access
   token plus its own credential, and never traverses authorize→callback. Nothing
   mints one for it.
2. **The exchange deliberately drops any inherited one.** Even where the user did log
   in via browser and their token carries `tsid` T, `handler.go:142-144` passes an
   empty session link — "No IDP session link for delegated tokens." So the delegated
   token comes out without it.

So this is not "the pointer may go stale mid-park." For an agent there is no pointer,
ever. Which makes the conflict sharper than the least-privilege argument, and maps
exactly onto the two bad options epic #5194 opens with:

| | `tsid` | actor | credential lookup |
|---|---|---|---|
| Forward the user's JWT verbatim | present | **lost** | works |
| Exchange for a delegated token | **dropped** | present | dead |

**You can have the actor or the credential lookup, not both.** The epic exists to get
the actor, which kills `tsid`-based credential injection for agents as a side effect —
and nothing in the epic says so.

The least-privilege argument above still holds, but it is secondary. The primary fact
is that the mechanism is unavailable on the path being built.

Two consequences:

- **`agent-identity-model.md`'s Scenario B is describing the wrong shape.** It walks
  `tsid` → `loadUpstreamTokens` → `upstream_inject`, which needs the
  forward-the-user's-JWT column while the surrounding design is the exchange column.
  For an agent, step 4 has no `tsid` to extract.
- **The credential-lookup key must be derivable from a delegated token,** and the only
  such thing is the user identity in `sub`. That makes the enterprise user-keyed
  decorator (`connector-gateway-as-storage.md`) not an alternative to `tsid` but the
  only shape in which agent-driven credential use is possible at all. And since `sub`
  cannot be dropped the way `tsid` can, it puts the entire weight on the narrowing
  being consulted at the read.

## What mecatl's own shape forces

Each derived from something true about the harness, not from what any gateway
happens to implement.

**Safe in hostile hands.** The component holding the credential is driven by a
language model reading untrusted input; prompt injection is the primary adversary in
the design's own threat model. So everything the credential can cause must already
be inside what that agent was permitted. This is the asymmetry that separates mecatl
from an ordinary OAuth client, where the client is software you wrote.

**A pointer must not widen.** Weaker than "no pointers," which is indefensible — a
pointer resolving to exactly the authority the token states is fine. What is unsafe
is a dereference unconstrained by the token's own claims. The requirement is that
the *read* consults the attenuation.

**The narrowing must be visible where the credential is used.** Whoever hands over a
real backend credential must be able to see and enforce what the requesting token
allowed. This is the structural defect: the credential layer consults the pointer,
never the scope, so every narrowing mecatl performs is invisible at the one moment
it matters.

> **WIMSE check:** filling a genuine gap rather than restating a closed one. WIMSE has
> no pointer-into-a-store construct, so this failure mode cannot occur to a WIT by
> construction. The nearest thing is §3.4.11 on AI intermediary chains — *"each hop
> MUST explicitly scope and re-bind the security context"* — but that is an obligation
> on the **minter**, not a validation rule on the **reader**.

**No key material below the pod.** Subagents are goroutines, so the binding is
claim-carried and holder binding exists at exactly one tier.

> **WIMSE check:** stronger than assumed. §2 defines a workload as "independently
> addressable and executable," so the floor is process-or-coarser, and SPIFFE inherits
> it. A goroutine is not a workload, an instance, or a hop. WIMSE is *silent*, not
> narrowly silent — the subagent tier is unavoidably harness-internal, which validates
> "subagents are not network entities" from the other direction.

**Survives rehydration.** Sessions park for a human approval and resume elsewhere, so
no binding to a connection, a process, or an in-memory secret. Must be reconstructible
from durable state plus what the pod can attest.

**Expressible with no user.** A scheduled fire has no human by construction, so the
principal slot must accept that without the binding degrading to unbounded.

**Absence fails closed.** A credential arriving with no binding should get the least,
not the most. Today's behaviour is right by accident rather than by check: the handler
passes an empty session link, so delegated tokens happen to reach nothing, and nothing
rejects one carrying both.

## Where this lands

Not a better pointer. And **not** "the credential is the authority" — that was
reaching past the requirement, and it conflated two credentials into one.

> **WIMSE check, the main correction.** A WIT is identity-only: `iss`/`sub`/`exp`/
> `jti`/`cnf`, no scope, no authorization claims. `-workload-creds` §7 is explicit that
> *"authorization decisions occur separately at the receiving application."* Authority
> lives in a different token from a separate exchange step. So "the credential is the
> authority" is not a purer WIT — it is an OAuth access token carrying
> `authorization_details`, authenticated by a WIT+WPT pair. A legitimate design, but it
> should be named as that. WPT maps cleanly onto holder binding: *"a signed JWT that
> demonstrates control of the private key corresponding to the public key in the WIT."*

Splitting identity from authority is an improvement, not a concession: the authority
credential can be self-describing without contaminating identity, and the coupling
then lands only on the authority vocabulary while the identity half stays standard.

So the settled statement:

> **Identity and authority are separate credentials. The identity credential carries
> no authority. The authority credential states what it permits rather than pointing
> at what it permits. Holder binding applies to the pair.**

And because the agent never holds the third-party credential, the operational form of
that is narrower and more achievable than an architectural change:

> **The narrowing must be expressed where the policy engine can read it, and absence
> of a policy must not be permissive.**

Three concrete things rather than a redesign:

1. The narrowing is readable where the decision is made
2. The decision consults it, rather than just matching an actor string
3. No policy configured means least access, not most

This also explains something previously read as a stylistic choice in
`agent-identity-model.md`: enforcement belongs at the gateway because that is the only
place that sees both the agent's claimed authority and the credential about to be used.

### Point 3 is currently violated, verified

Absence of policy is **fail-open**, not fail-closed. `BuildAuthzConfig`
(`pkg/vmcp/auth/factory/incoming.go:148-153`) returns nil when the authz config is
absent, that nil becomes `allowAllAdmission` (`pkg/vmcp/core/admission.go:79-81`), and
its `AllowToolCall` returns `(true, nil)` unconditionally (`:264-268`). The admission
seam is the only thing between an inbound call and credential injection
(`upstream_inject.go:61`). So a fresh deployment with credentials wired and no policy
written lets any authenticated caller invoke any advertised tool with that caller's
stored credentials injected.

There is no empty-policy middle state: zero-policy Cedar is rejected at config load
(`config/validator.go:204-206`) and the server refuses to start. So it is binary —
no authz block gives allow-all, one or more policies gives deny-if-no-permit.

Worth framing carefully: allow-all is a defensible default for an unconfigured proxy.
It becomes dangerous the moment a credential store is attached, and **nothing links
those two configuration decisions.** That is the gap, rather than the default itself.

(Distinct from the misconfigured-Cedar path, where a trust-only provider reaches
`resolveClaims`'s `!tokenFound` branch and denies everything. Misconfigured denies all;
absent allows all; disjoint code paths.)

### The fork this leaves, and it is the design decision

Everything above is compatible with two designs that differ on where the narrowing
lives.

**Design A — narrowing in policy.** The token carries identity and actor only. Policy
rules say what each agent definition may do. On allow, the gateway injects the
credential for that one call.

**Design B — narrowing in the token.** The token carries structured authority. The
reader subset-checks it against what the call needs.

| | A | B |
|---|---|---|
| Vocabulary coupling | **none** — policy is deployment config and already knows tool names | reader must understand our vocabulary and subset-check |
| Runtime attenuation | cannot express it; rules are static per definition | travels with each delegation |
| Cost | rules to write | claim shape plus subset-check logic in the reader |

**What decides it: whether mecatl's per-spawn narrowing is authority-shaped or
resource-shaped.** If a parent narrows a child in ways that change what it *may do*, A
cannot see it and B is required. If the narrowing is resource bounds, those never needed
to reach the gateway and A suffices.

What mecatl actually varies per spawn: the child's tool catalog comes from its `AgentDef`
or the default explorer set — definition-shaped. The per-call knobs are `MaxTurns`,
`MaxToolCalls`, `TimeoutMs` and read-only versus read-write — resource bounds plus one
authority-shaped bit.

So the authority set is close to definition-determined, which is what makes A viable, and
is also what makes per-definition cache keying work. Those line up rather than fighting,
which usually indicates the grain is right. The residual for A is the mutation flag: one
bit, authority-shaped, chosen per call — and a policy rule can key on it if it is in the
token.

**Expected landing: A with a small amount of B** — identity, actor, and the few
authority-shaped bits that genuinely vary per spawn, rather than a full structured
vocabulary. Much cheaper than this document's earlier direction, and it removes almost
all of the coupling named as the weakest joint.

Not settled here, because which design is *buildable* depends on seams part 2 has not
surveyed yet: whether policy can key on the actor plus a mutation bit, and whether the
credential read has any interface boundary or is a concrete call. A looks cheaper on
paper and might be the one with no seam.

## Tensions not resolvable from first principles

**Who may consult the attenuation.** If the credential holder must enforce mecatl's
narrowing, it must understand mecatl's authority vocabulary. That is a real coupling —
though see the fork below, which may reduce it to almost nothing.

> **WIMSE check:** WIMSE exports this rather than confronting it. §3.3 puts authorization
> decisions in a policy point explicitly out of scope; WIMSE carries authentication
> context to the PEP and stops. The worry is correctly identified as unsolved — and it is
> unsolved for everyone, not just here.

## What part 2 has to answer

Not a blank page — the properties eliminated most of the space. What is left:

1. **Which of Design A or B is buildable.** Can policy key on actor plus a mutation
   bit? Does the credential read have an interface boundary, or is it a concrete call?
2. **Whether the read can filter or only fetch.** Design B needs filtering; the
   enterprise user-keyed decorator needs checking for this specifically.
3. **Cache key and TTL.** Per-definition is forced; the TTL interacts with the
   parked-session lifetime.
4. **How absence is made to fail closed** — most likely by coupling the authz
   requirement to the presence of a credential store, since neither default is wrong
   on its own.

## Settled, for the record

- Binding must constrain, never grant. The removal test decides it.
- Holder binding stays; context binding goes.
- The agent never holds third-party credentials; the threat is unauthorized *use*.
- An agent can never have a `tsid`. The lookup key can only be the user identity.
- Therefore the read must filter, not merely fetch — this is what makes the only
  available key safe.
- **Two credentials, each doing one job.** The gateway should not have to mint a fresh
  token for every tool call, so the expensive one is shared: one per user, per kind of
  subagent, per set of permissions. But you also need to know which individual subagent
  did something, and to be able to cut that one off without cutting off the rest. So a
  second, cheap token rides each call and names the individual.

  *This replaces an earlier claim that one shared token was enough and the individual
  could ride along as a label nobody authorizes on. That was wrong: you cannot revoke a
  label. `draft-mcguinness-oauth-ai-agent-instance-00` was written against exactly this
  collapse, and requires revocation keyed on the individual actor. The two-token shape
  gets the sharing and the containment; they were never actually in tension.
  `draft-ietf-oauth-transaction-tokens-11` is the adopted mechanism for the cheap
  per-call half.*
- Identity and authority are separate credentials; the authority one states what it
  permits rather than pointing at it.
- Absence of policy currently fails open, and must not.
