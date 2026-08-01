## A worked example, end to end

Alice asks her agent to review an open pull request. The agent spawns a
code-reviewer subagent, which needs to read the diff from GitHub. GitHub is
reached through vMCP, and vMCP holds Alice's GitHub credential.

Each hop below says what *should* happen and why, then what happens today and
what the difference costs. The threats sit with the hop they belong to, so the
whole thing can be argued against one step at a time rather than as a block.

The path is one spine. Where it genuinely forks, the fork is marked; two
parallel narratives are how a prerequisite gets stated in one and silently
assumed in the other.

---

### Hop 1 — Alice authenticates and the session records who owns it

**What should happen.** A human authenticates once, and the session records the
principal. The important part is that the principal is a **durable property of the
session**, not a property of the request that created it.

That distinction sounds pedantic and is not. Work can begin without a request:
a scheduled run starts itself, in-process, and never crosses a network edge. If the
edge is the only place a principal is assigned, that work has no owner by
construction — and no amount of issuer or key work reaches it, because it never
passes the point where identity is attached. So the stored owner is primary and the
edge is one of the things that writes it.

**The variant with no human.** A scheduled run has no user, and should not be given
one. It authenticates as itself, and the audit record says the schedule did this —
which is true. The alternative, a service-account user holding a stored long-lived
credential, reintroduces exactly the stored-secret problem the rest of this design
removes, and puts a false statement in the log.

> **Today.** There is no principal field on session creation at all, on either the
> session or team request. And `makeFireFunc` calls `CreateSessionWithProfile`
> in-process from a leader-elected goroutine, so a scheduled fire never reaches the
> interceptor that would assign one.
>
> **Delta.** A principal on session creation; an owner on the schedule; the fire path
> reads it rather than finding nothing.
>
> **Cost.** New, small, and entirely mecatl-side. Everything downstream depends on it.

**Threats at this hop.** A mis-binding edge — one that records Alice when the token
was Bob's — poisons every chain rooted at it, undetectably downstream.

Worth being careful about the mitigation, because the obvious one does not work.
Having the edge sign the binding, the store record it, and audit cross-check the two
does nothing against a *compromised* edge: it holds the signing key and writes
Bob-as-Alice consistently in both places, so the cross-check agrees with itself. What
bites is anchoring to evidence the edge cannot forge — persist the originating
assertion's issuer and identifier, so an auditor re-verifies against the identity
provider's own keys rather than against the component under suspicion.

---

### Hop 2 — the parent spawns a subagent and narrows its authority

**What should happen.** The child receives a strict subset of the parent's authority,
chosen by the parent at spawn, and cannot widen it. The child holds no key; its
identity is a claim the parent caused to be minted.

**Two kinds of narrowing, and only one of them matters here.** Some of what a parent
sets is *authority-shaped*: which tools the child has, whether it may mutate. Some is
*resource-shaped*: turn limits, tool-call ceilings, timeouts. The second kind bounds
what the child costs, not what it can reach, and never needs to leave the harness.
Only the first kind has to survive to the point where a credential is used.

**A narrowing nobody downstream can check is a convention, not a control.** mecatl's
existing containment is real and tested — the composed catalog, the deny-dominant
evaluator pinned to an audience — but it is enforced entirely inside the process. That
is enough to stop the harness from doing the wrong thing by accident. It is not enough
to let anyone else verify that it didn't.

> **Today.** The narrowing exists and works, in-process. Nothing carries the
> authority-shaped part outward.
>
> **Delta.** The authority-shaped part has to reach whatever decides at hops 5 and 6.
> How much travels in the credential versus how much a policy already knows from the
> definition is the open question below.
>
> **Cost.** Depends on that answer, which is why it is worth settling before building.

**Threats at this hop.** Prompt injection reaching the *parent* is strictly worse than
reaching a child, because the parent chooses the child's authority, mode and prompt.
Identity cannot prevent that — the attacker is driving the harness's own reasoning
from inside the pod.

But it is not true that identity does nothing here. A ceiling carried in the
credential bounds what a compromised parent can grant, which is the difference between
a bad turn and an unbounded one. Worth stating both ways: identity does not stop the
compromise, and it does bound the blast radius. Cutting against that, the harness
defenses this leans on are posture-conditional — guardrails demote to advisory at the
top of the posture ladder — so the containment is weakest exactly where the model is
trusted most.

---

### Hop 3 — the harness obtains a credential to call the gateway

**What should happen.** The harness presents something that says three things:
whose authority is being exercised, which agent is exercising it, and what that
agent may do. It obtains this once per distinct combination of those, not once
per call.

The subagent is not a party to this. It is a goroutine with no key, so the
harness presents on its behalf and the subagent's identity rides as a claim.
That is not a compromise — there is nothing below the pod that any attestor
could reach, so a per-subagent credential would be an assertion dressed as an
attestation.

**Two things must be true of the credential, and they are the same requirement
seen twice.** It has to be safe in the hands of a component driven by a language
model reading untrusted input, which is the harness's own primary adversary. And
everything it can cause must already be inside what the subagent was permitted.
Those coincide: a credential that can only cause permitted things is safe to hold
hostilely.

**Which is why nothing here may be a pointer.** A claim that dereferences to a
credential set is a key, not a constraint — remove it and the holder reaches
less, which is the test. The credential states its authority; it does not refer
to authority held elsewhere.

**Where SPIFFE fits, and it is narrower than it looks.** The harness has to
authenticate as a registered client to obtain the credential at all. An X.509-SVID
over mutual TLS does that with no static secret in the process environment, which
matters concretely: `envscrub` exists precisely because under posture `auto` or
`yolo` the model can read its own environment. Per-pod attestation comes with it.

But the identity that ends up in the credential is the client identity, so SPIFFE
earns its place through one specific consequence: **it is the only client
authentication method that makes the client identifier a SPIFFE URI.** Any other
method leaves it whatever was registered. If policy is ever to name agents by
SPIFFE ID, this is the mechanism that puts one there; if not, an ordinary
confidential client reaches the same credential.

> **Today.** No client that may use the exchange grant can be provisioned at all:
> registration hardcodes clients as public, permits only `authorization_code` and
> `refresh_token`, and there is no static-client config, so the path is reachable
> only through a test seam. Client authentication itself is not the obstacle —
> `client_secret_basic` works mechanically with no new code. SPIFFE client auth
> exists on a branch and is deliberately deferred in #5194.
>
> **Delta.** Provisioning: a static confidential client, or relaxed registration.
> Small, and it blocks everything downstream.
>
> **Cost.** A fix, not new design. SPIFFE is a separate, optional port.

**Threats at this hop.** An attacker who obtains the credential can act as the
agent for whatever it names — which is why it names as little as possible and
expires quickly. An attacker inside the process gets the same thing the model
gets, which is the argument for no static secret. And an attacker who can make
the harness request a credential naming a user it is not acting for defeats
everything downstream, which is what the consent check on the subject token
exists to stop.

---

### Hop 4 — the harness calls a tool

**What should happen.** The call carries the credential from hop 3 and nothing
else that matters. No side channel, no header the gateway reads for identity, no
out-of-band statement about which subagent is calling. Everything the gateway
decides on travels in the credential, because anything else is unverifiable at
the far end.

This is worth stating because it is the property that makes the subagent tier
safe. A subagent cannot forge its way into a stronger identity by manipulating a
header, because there is no header to manipulate — its identity was fixed when
the harness minted the credential, before the subagent ran.

> **Today.** The inbound path reads only `MCP-Protocol-Version` and `Accept`, and
> the identity struct has no header-populated field, so this already holds.
>
> **Delta.** None. Worth keeping when the outbound path stops baking a static
> header map into a client at dial time.

**Threats at this hop.** Prompt injection reaching the subagent is the expected
case, not the exceptional one. What it buys the attacker is bounded by what the
credential permits, which is why hop 3's narrowing is load-bearing and why
nothing here may widen it.

---

### Hop 5 — the gateway decides

**What should happen.** One gate, always in the path, that sees the whole
question: who is acting, for whom, on what, at which backend. It decides before
any credential is selected, and a refusal stops the call rather than degrading
it.

**One gate rather than several, for a reason that is not tidiness.** A check that
lives in each outbound path is a check that can be omitted from one of them, and
the omission is invisible until someone finds it. A single chokepoint can be
wrong, but it cannot be absent. This is the same property as "missing means
nothing" below, applied to code paths instead of configuration.

**What the decision needs to see.** The acting agent, so policy can be written
about agents rather than only about users. The operation, so read and write can
be distinguished. And the backend, because "may this agent read" and "may this
agent read *GitHub*" are different questions and only the second is useful when
the gateway fronts several backends holding different credentials.

**Absence must mean refusal.** A gateway with credentials attached and no policy
written should serve nothing. This is the one place where a sensible default for
a plain proxy becomes the wrong default: allow-all is reasonable when there is
nothing to hand out, and dangerous the moment there is.

> **Today.** Admission is already the single gate and already always in the path,
> which is the part that is right. It receives the acting agent as a nested claim
> and a read/write hint from the backend's own tool annotation. It does **not**
> receive the backend — that identifier exists on the tool but is not passed. And
> with no policy configured the gate is allow-all, so a deployment with
> credentials wired and no policy will serve any advertised tool to any
> authenticated caller.
>
> Two sharper edges. The read/write hint is whatever the backend declared, absent
> by default, with no fallback classifier — so a policy has to choose what an
> unannotated tool means. And pinning a primary upstream provider causes the
> issued token's claims to be discarded, so the acting agent silently disappears
> and a policy written about it stops matching rather than starting to fail.
>
> **Delta.** Pass the backend identifier. Make absence refuse when a credential
> store is attached. Stop discarding the issued token's claims. Choose the
> unannotated default.
>
> **Cost.** All fixes to an existing gate. No new component, no new interface.

**Threats at this hop.** This is where a confused deputy is caught or not. The
agent cannot read Alice's credentials, but it can ask the gateway to use them,
and the gate is the only thing standing between a request and that use. A gate
that cannot see the backend can be talked into using the wrong credential for a
call it was willing to allow. A gate that is absent can be talked into anything.

---

### Hop 6 — the gateway selects and uses a backend credential

**What should happen.** Two stages, and the order matters.

First, **which credentials are candidates.** The credential belongs to the user,
so this keys on the user. Not on a session, not on a login, not on anything that
can expire or be replaced while the user's authority is unchanged — those are
facts about a browser visit, and the question here is whose credential this is.

Second, **which one, if any, may be used for this call.** That takes the backend
being routed to and the decision from hop 5. The result is a single credential or
none.

**Why the first stage cannot key on a login session.** A pointer minted when a
human logged in through a browser describes an episode, not an entitlement. An
agent has no such episode — nothing mints one for it, and where a user's token
carried one, exchanging it for a delegated credential drops it. So a design that
looks up credentials by login session cannot serve an agent at all. This is not a
lifetime mismatch to be managed; there is nothing to manage.

The consequence runs the other way too, and it is the sharper half. **The
credential lookup needs the user, so the user has to be somewhere the lookup can
read.** If the credential names the acting agent as its subject, the user sits one
level in, and whatever holds it has to be legible at this hop. A design that puts
the user only in a structure declared unreadable has made the lookup impossible.

**Why the second stage cannot be skipped.** Keying on the user alone returns
everything the user has. That is the whole point of the second stage: the first
narrows to a person, the second narrows to a purpose. Without it, every delegated
credential reaches every credential its user owns, and the narrowing performed
when the subagent was spawned stops at the gateway's front door.

**And if anything is missing, nothing is used.** No decision, no backend
identifier, no user — no credential. Fail closed at the point of use, not only at
the gate.

> **Today.** The read keys on the login-session pointer and returns every
> credential filed under it. There is a real interface behind it that a filtering
> implementation could replace — but it runs in HTTP middleware before routing, so
> at that point there is no tool, no backend and no arguments. The code says so
> itself. Selection happens afterwards in the outbound strategies, by a provider
> name fixed in static configuration rather than derived from the call.
>
> The enterprise user-keyed decorator already replaces the login-session key with
> a user key, which is the first stage done. It sits below the same interface, so
> it sees no more of the call than the layer above it.
>
> **Delta.** Stage one is largely solved by the user-keyed direction. Stage two
> needs the decision from hop 5 to reach the point of selection — which is the
> real work, because that point currently runs before the gateway knows what is
> being called.
>
> **Cost.** Stage one: a port of work that exists. Stage two: new, and the
> substantive piece of this design.

**Threats at this hop.** An adversary who reaches stage one with the wrong user
gets that user's whole credential set, which is why the key has to be an
entitlement rather than an episode. An adversary who reaches stage two unchecked
gets the right user's whole set, which is the confused deputy again, one layer
lower. And a stored credential that is never checked against the identity that
stored it lets a chain rooted at one user reach another's — worth noting because
that check is declared in the code and never performed.

---

### Hop 7 — the backend serves the call

**What should happen.** The backend receives a credential it already understands, for
a call that has already been authorized, and verifies what it always verifies. It is
not asked to learn anything about agents, delegation, or this design.

That is a design goal rather than a limitation. A backend has no policy about mecatl's
subagents that it could meaningfully apply, and requiring it to understand our
vocabulary would make every integration a negotiation.

**So the honest statement about verifiability.** The delegation chain does not reach
here. Whatever the gateway minted or injected is what the backend sees, and nothing
the harness put in a claim survives that boundary. Any claim that a third party can
verify the chain has to be scoped to **the gateway**, not to the resource server.

That is the right place for it — the gateway is where both the claimed authority and
the credential about to be used are visible at once, and it is the only hop where a
refusal actually prevents anything. But it means the boundary should be stated
plainly rather than implied to extend further.

> **Today.** This already holds. The outbound strategies derive a credential from
> stored tokens or an exchange, and none of them read the inbound claims map.
>
> **Delta.** None. The deliverable here is accuracy in the doc, not a change in code.

**Threats at this hop.** The backend cannot distinguish the agent from the user, so
attribution at the backend is only as good as the gateway's audit record. That puts
the gateway inside the trust boundary for attribution — which is fine, and worth
saying, because "verifiable by anyone with the bundle" reads as though it were not.

---

### Hop 8 — the session parks, then resumes somewhere else

**What should happen.** The credential expires. The authority does not. On resume the
credential is re-derived, never wider than before.

**What gets re-proven, and by whom.** The pod proves itself, which it can. And where
there is a live caller, the authority should be derived from *that caller* rather than
read back out of storage — because a caller who just authenticated is a stronger
statement than a row that says they once did.

This covers more cases than it first appears. Approve-after-restart is reached from an
inbound request, so a human clicking approve is an authenticated caller. A resumed
subagent runs under a live parent turn. A background child is run-scoped with a live
parent. The only case with genuinely nobody present is the scheduled run from hop 1 —
which is exactly the case that has its own stored owner and its own no-user credential.

**What must not happen: authority read out of a row that anything can write.** If the
stored record is the authority, then whatever can write the store can grant authority,
and the identity layer is decoration on top of a database.

> **Today.** Sessions do park and resume on other pods, and the persisted labels have
> no integrity protection — the rehydration path trusts them verbatim, including the
> permission posture. So "attenuation is monotonic across resume" is one write away
> from being false. The store itself is currently unauthenticated.
>
> **Delta.** Two options, and they are not exclusive. Derive from the live caller
> where there is one, which covers nearly every path and costs almost nothing. Sign
> the chain at mint and verify before re-minting, which is needed for the one path
> where nobody is present.
>
> **Cost.** The live-caller path is nearly free. The signed path is real work, for one
> case — which is a much smaller thing to build than signing for all of them.

**Threats at this hop.** An adversary who can write the store but cannot sign is a
distinct and likelier adversary than one who has compromised a pod — a leaked database
credential against an unauthenticated store, rather than code execution. That
adversary is precisely who chain integrity defeats, and collapsing the two into "the
pod that can sign can impersonate anything" makes the mitigation look less valuable
than it is.

---

### What this leaves open, deliberately

Four things the walkthrough does not decide, because they are choices rather than
consequences.

**Where the user is carried.** The lookup needs it legible; which claim holds it is
a naming decision with a caching consequence, since it becomes part of the key.

**How much narrowing travels in the credential versus living in policy.** A
child's tool set is largely determined by its definition, which policy can name
directly. Only the parts that genuinely vary per spawn need to travel. Read-write
versus read-only is the clear case; whether anything else qualifies is worth
settling before committing to a structured authority claim.

**What an unannotated tool means.** No fallback classifier exists, so this is a
policy default someone has to choose rather than a fact to discover.

**Whether SPIFFE is on the critical path.** It is not required for any hop above.
It is required for exactly one thing: an agent identifier that a policy can name
as a SPIFFE ID. Whether that is worth the port is a judgement about where policy
is heading, not a technical gap.
