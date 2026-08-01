# Agent identity, part 2: the outbound hop

*Status: strawman / working draft. Speculative scoping, not a design record under
[ADR 0002](adr/0002-documentation-lifecycle.md). Companion to
[`docs/agent-identity-model.md`](agent-identity-model.md), which this takes as its
premise and does not restate. Same tier as
[`docs/scoped-resource-grants.md`](scoped-resource-grants.md).*

## The flow at a glance

```mermaid
sequenceDiagram
    autonumber
    actor Alice
    participant M as mecatl pod<br/>(holds an X.509-SVID)
    participant S as code-reviewer subagent<br/>(goroutine in that pod)
    participant AS as vMCP authorization server
    participant G as vMCP gateway
    participant B as GitHub

    Alice->>M: OIDC access token + "review PR #42"
    Note over M: store owner on the session:<br/>iss + sub from the validated token

    M->>S: spawn with a reduced tool set<br/>(Read, Grep; no Write; one repo)

    rect rgba(128,128,128,0.08)
    Note over M,AS: once per (user, agent definition, tool set, audience)
    M->>AS: POST /token over mTLS, client cert = the SVID<br/>grant_type=token-exchange<br/>subject_token=Alice's access token
    AS-->>M: JWT: sub=Alice, act.sub=the SVID's SPIFFE ID,<br/>scope narrowed, aud=the gateway
    end

    S-->>M: needs the diff for PR #42
    M->>G: MCP tools/call github.read_file<br/>Authorization: Bearer <that JWT><br/>X-Correlation-Id: <child session id>:<call id>

    Note over G: Cedar evaluates:<br/>principal from sub, claim_act.sub,<br/>Tool::github.read_file, readOnlyHint,<br/>and the backend the call routes to
    alt Cedar denies, or no policy is configured at all
        G--xM: refuse before any credential is touched
    end

    Note over G: resolve the credential:<br/>1. Alice's stored credentials are the candidates<br/>2. the GitHub one, because that is where this call routes<br/>   and Cedar allowed a read against it
    G->>B: GET /repos/.../pulls/42 with Alice's GitHub token
    B-->>G: the diff
    G-->>M: tool result
    M-->>S: the diff
```

Two boxes in that diagram are where the design does real work, and they ask different
questions. Cedar asks whether this call is allowed. The credential resolution asks which
of Alice's stored credentials, if any, this particular call justifies using.

Today neither can do its job, for the same underlying reason: **the information each
needs arrives after the point where it runs.** Cedar is never told which backend the call
routes to, even though the tool object carries that identifier. And the credentials are
loaded in HTTP authentication middleware, before the JSON-RPC body is parsed — so at that
moment there is no tool name, no arguments and no backend, and the code loads every
credential Alice has and lets a later step index into the map.

| Hop | What changes |
|---|---|
| 1 · authenticate | The session stores who owns it. A scheduled run is not started by an incoming request, so it has no user to read; it stores an owner at creation instead. |
| 2 · spawn | Which tools the child may call has to be known outside mecatl. How many turns it may take does not, and should not leave. |
| 3 · get credential | One JWT, reused across sibling subagents, obtained by exchanging Alice's token. The pod authenticates with its SVID rather than a secret. |
| 4 · call | Already correct: the JWT decides everything, and the correlation header is only ever logged. |
| 5 · gate | Give Cedar the backend identifier. Refuse when credentials are configured but no policy is. |
| 6 · select | Key the lookup on Alice rather than on a login session, then narrow to one credential using the backend and Cedar's answer. **The substantive piece.** |
| 7 · backend | No change. GitHub sees an ordinary GitHub token and learns nothing about agents. |
| 8 · park/resume | On resume, mint from whoever is asking now rather than from a stored row. |

---

## What this decides

[`agent-identity-model.md`](agent-identity-model.md) models identity from the user down
to the subagent and stops at the boundary. This doc covers what happens at that boundary
and beyond it: how the harness reaches a tool, what a gateway decides, and how a user's
stored third-party credential gets used without handing the agent more than it was
given.

It also lists what has to change, in which repository, in what order. A design that says
what should happen without saying what to build is not actionable.

**What it takes as given.** The three-tier model, subagents not being network entities,
mecatl as its own issuer, and the parkable-credential lifecycle. Those are settled in the
companion doc.

**How to read the annotations.** Each step says what should happen and why. A quoted
block then says what happens today and what the difference costs. Those blocks are a cost
signal, never a constraint: mecatl, vMCP and ToolHive are built by the same team, and two
branches already exist because someone decided a change was needed. A missing interface
is a thing to build.

---

## Vocabulary

Several words in this area cover more than one thing, and the ambiguity does real damage —
"binding" alone covers four distinct mechanisms with opposite properties. Definitions used
consistently below.

**Binding** — four things share this word.
*Holder binding*: only whoever holds this key may use this credential.
*Context binding*: this credential can read what is filed under some session.
*Authority binding*: this credential may perform these operations.
*Principal binding*: this is Alice's authority, exercised by some agent.
The test that separates them: does removing it increase what the holder can reach? Remove
a session pointer and the holder reaches less, so it grants. Remove a holder key and a
stolen copy works, so it constrains. **A binding should constrain, never grant.**

**Principal** — the party whose authority is being exercised. Either a user or a client,
never both, and code that consumes one has to handle each.

**Actor** — the party exercising it. In a delegated credential these are different, which
is what distinguishes delegation from impersonation.

**Owner** — who is recorded as responsible for a session or a schedule. Usually the
principal, but not always: a scheduled run is owned by whoever created it and acts as
itself.

**Authority** — what a credential permits: which tools, which operations, which resources.
Distinct from **limits**, which bound what a run costs — turns, tool calls, timeouts.
Authority may need to travel outside the process; limits never do.

**Definition and instance** — a definition is a kind of agent, named in configuration and
stable enough for a policy to reference. An instance is one running occurrence, ephemeral
and unnamed in advance. Policy keys on definitions. Audit records instances.

**Workload** — in the WIMSE sense, something independently addressable and executable. A
mecatl pod is one. A subagent is not, which is the reason it has an identity but no key.

**Attenuation** — issuing a credential strictly weaker than the one it derives from. Not
the same as *revocation*, which withdraws one already issued.

**Credential and capability** — a credential states what its holder may do. A capability
*is* the permission: holding it is sufficient. A pointer into a credential store is a
capability wearing a credential's clothes, which is why one inside a delegated credential
defeats the delegation.

---

## The properties this is built on

One test, then what it rules out.

**A binding should constrain, never grant.** The test is whether removing it increases
what the holder can reach. Take away a session pointer and the holder reaches less, so
the pointer grants. Take away a holder key and a stolen copy becomes usable, so the key
constrains. Anything that increases reach is a key with the word "binding" on it.

From that, and from what mecatl is:

- **The credential must be safe in hostile hands.** The thing holding it is driven by a
  language model reading untrusted input. Everything it can cause must already be
  permitted.
- **A pointer must not widen.** A reference is fine if following it is limited by what
  the token says. It is unsafe when the read ignores the token's own limits.
- **The limits must be visible where the credential is used.** Otherwise every narrowing
  the harness performs stops at its own edge.
- **A subagent gets an identity but not a key.** mecatl is its own trust domain and can
  issue a subagent an identity; what it cannot do is give it a key, because subagents are
  goroutines sharing one process and cannot hold anything separately from each other. So
  a subagent identity is real inside mecatl's domain and unattestable outside it. Nothing
  external should be asked to verify it, and the pod is where proof of possession lives.
- **It survives rehydration.** Sessions park for hours and resume elsewhere.
- **It works with no user.** A scheduled run has none.
- **Missing means nothing.** A credential with no limits attached gets the least access,
  not the most.

Two more that came out of the standards rather than from mecatl:

- **One credential says who you are; a different one says what you may do.** Don't fold
  the second into the first. Who-you-are is long-lived and presented to everything;
  what-you-may-do changes per call and per resource, so putting it in the identity
  credential means reissuing that credential every time permissions change, and handing
  every recipient a list of permissions most of them have no business seeing. WIMSE keeps
  them apart for this reason — its identity token carries issuer, subject, expiry and a
  key binding, and nothing about authorization.
- **Sharing a credential and attributing an action are both required, and they do not
  conflict.** One credential can be reused across concurrent siblings while a logged
  correlation value still says which one acted. See hop 3.

---

## A worked example

Alice asks her agent to review an open pull request. The agent spawns a code-reviewer
subagent, which needs the diff from GitHub. GitHub is reached through vMCP, and vMCP
holds Alice's GitHub credential.

One path, eight steps. Where it genuinely forks, the fork is marked. Two parallel
narratives are how a prerequisite gets stated in one and silently assumed in the other.

---

### Hop 1 — Alice authenticates and the session records who owns it

**What should happen.** Alice authenticates once, and the session stores who owns it. The
owner is a property of the session, not of the request that created it.

That distinction matters because some work has no request behind it. A scheduled run
starts itself, from a timer inside the process, so there is no inbound HTTP request whose
token could be read. If reading an inbound token is the only way an owner ever gets set,
scheduled work has no owner at all, and no amount of key or issuer machinery fixes that,
because the work never passes the place where identity is attached.

**A scheduled run has an owner, but does not act as that owner.** Alice creates the
schedule and is recorded as its owner. When it fires at 3am, it authenticates as itself,
using its own client credentials, and the audit record says the schedule did this — which
is true, where "Alice did this at 3am" is not.

**And it fails if it needs a credential it cannot get.** A run authenticating as itself
has no user in its token, so it cannot reach anything requiring one of Alice's stored
credentials. That is the right outcome. The alternatives are all worse: storing a
long-lived token for Alice reintroduces exactly what this design removes, and having the
authorization server accept mecatl's word that this is Alice replaces an attested identity
with an asserted one. So the run fails, visibly, with a reason. A scheduled job that needs
Alice's GitHub token is a job that needs Alice, and the honest answer is to say so rather
than to manufacture her.

> **Today.** Session creation has no owner field, on either the session or the team
> request. `makeFireFunc` calls `CreateSessionWithProfile` in-process from a
> leader-elected goroutine, so a scheduled fire never reaches the interceptor that would
> assign one.
>
> **Change.** An owner on session creation; an owner on the schedule; the fire path reads
> it. New, small, mecatl-side. Everything downstream needs it.

**What an attacker gets.** If whatever validates the inbound token records the wrong user,
every credential minted under that session is minted for the wrong person, and nothing
downstream can tell.

The obvious defence does not work. If that component signs its binding and the store
records it and audit compares the two, a compromised component holds the signing key and
writes the same wrong answer in both places, so the comparison agrees with itself. What
works is anchoring to something it cannot forge: keep the issuer and identifier of the
original assertion from the identity provider, so an auditor re-checks against the
provider rather than against the component under suspicion.

---

### Hop 2 — the parent spawns a subagent and narrows what it may do

**What should happen.** The child gets a strict subset of the parent's authority, chosen
at spawn, and cannot widen it. It holds no key. Its identity is a claim the parent caused
to be minted.

**Only some of the narrowing needs to leave the harness.** Which tools the child may call,
and whether it may write, determine what it can reach outside the process — so a gateway
deciding whether to use Alice's GitHub token needs to know them. How many turns it may
take, how many tool calls, how long before it times out: those bound what it costs and
have no bearing on any decision made elsewhere. They stay inside.

Keeping them apart matters in both directions. A limit that should have travelled and
didn't means the gateway allows something the parent forbade. A limit that travels
needlessly ends up as a claim in a credential, where it is one more thing to version and
one more thing a policy might accidentally depend on.

**Narrowing that nobody outside can check is a convention.** mecatl's containment is real
and tested — the composed catalog, the deny-dominant evaluator pinned to an audience —
but it runs entirely inside the process. That stops the harness doing the wrong thing by
accident. It does not let anyone else confirm it didn't.

> **Today.** The narrowing works, in-process. Nothing carries the reach-changing part
> outward.
>
> **Change.** That part has to reach whatever decides at hops 5 and 6. How much travels
> in a credential and how much a policy already knows is open — see the end.

**What an attacker gets.** Prompt injection at the *parent* is worse than at a child,
because the parent picks the child's tools, mode and prompt. Identity cannot prevent
that; the attacker is driving the harness's own reasoning from inside the pod.

It does bound it. A ceiling carried in the credential limits what a compromised parent
can hand out, which is the difference between a bad turn and an unbounded one. Cutting
the other way, the harness defences this leans on are posture-conditional — guardrails
drop to advisory at the top of the posture ladder — so containment is weakest where the
model is trusted most.

---

### Hop 3 — the harness gets credentials to call the gateway

**What should happen.** One credential, shared, plus a correlation value on each call.

**The credential** says whose authority is being used, which kind of agent is using it,
and what that kind may do. It is obtained once per distinct combination of those and
reused. Eight concurrent code-reviewer subagents working for Alice share one, because
minting per call puts a network round trip in front of every tool use and there is no
token cache in the gateway's proxy path today.

**The correlation value** names the individual subagent and the specific call. It is not
a credential and is not signed. Both sides log it, and joining the two logs answers
"which subagent did this".

**Why not a second credential for the individual.** Because a subagent never holds one.
The harness holds the credential and makes calls on behalf of its children, so there is
no per-subagent token that could be stolen, replayed, or revoked. Containing a misbehaving
subagent is cancelling a goroutine the parent already owns, not revoking a token.

A signed second credential would only be worth it if the gateway needed to *authorize* on
the individual instance, and it cannot usefully: instances are ephemeral and unnamed in
advance, so no policy could reference one. The harness is also the only thing that could
forge the value, and it is already trusted to name the actor in the shared credential —
so signing it adds nothing.

> Recorded because this went back and forth. An earlier version of this analysis proposed
> two credentials, on the strength of `draft-mcguinness-oauth-ai-agent-instance` requiring
> per-instance revocation. That draft is written for agents as independent processes
> holding their own credentials. Our subagents hold nothing, so the requirement does not
> transfer. If the gateway ever needs to attribute without reading our logs, the
> second-credential shape is available and `draft-ietf-oauth-transaction-tokens` is the
> mechanism — but that is a credential on every call to save a log join.

**The subagent is not a party to this exchange, because a subagent is not a workload.**
WIMSE defines a workload as independently addressable and executable. A goroutine is
neither: it shares an address, a process and a memory space with its siblings, and nothing
outside can distinguish one from another. So no attestor can attest it, and asking an
external authorization server to accept a per-subagent credential would mean asking it to
accept an assertion in place of an attestation.

That is why the pod obtains the credential and the subagent's identity travels as a claim
inside it. mecatl issues that identity — it is a real identity in mecatl's own trust
domain — and no key sits below the pod, because there is nothing below the pod that could
hold one privately.

Worth knowing the standards are moving away from this shape rather than toward it. The
newest agent-specific drafts raise the floor: one requires every agent to generate its own
keypair at instantiation with no provision for agents lacking private keys, another
defines an agent as a workload in the WIMSE sense. So the sub-workload tier is ours to
handle permanently, and we should not plan on a standard growing into it.

**Nothing here may be a pointer.** A claim that dereferences to a credential set is a key
by the test above. These credentials state their authority rather than referring to
authority held elsewhere.

**Where SPIFFE fits.** The harness must authenticate as a registered client to get the
shared credential. An X.509-SVID over mutual TLS does that with no static secret in the
process environment, which matters concretely — `envscrub` exists because under posture
`auto` or `yolo` the model can read its own environment. Per-pod attestation comes with
it.

**Client authentication and the policy subject are one decision, not two.** The identity
that lands in the credential is the client identity, so authenticating with an SVID makes
`client_id` a SPIFFE URI, which flows into the actor claim, which is what policy reads.
Choosing the authentication method chooses the policy subject.

That is a reason to prefer it rather than a cost. A definition name is a local string that
means whatever the config says; a SPIFFE ID is namespaced and structured. In a
single-tenant deployment the difference is cosmetic. In the multi-tenant one this design
targets, it is not.

The objection to a SPIFFE-shaped policy subject is that an SVID path encodes the
deployment, so a trust-domain rename rewrites every rule. That is largely avoidable, and
avoiding it is a path-design decision worth making early: **put the agent definition in
its own path segment** so a rule can match the suffix and never name the trust domain.

**None of this is required.** An ordinary confidential client reaches the same credential
and the design runs. What SVID authentication buys is three things at once — no secret for
the model to read, per-pod attestation instead of "whoever holds the secret", and a
namespaced policy subject for free — using a registered mechanism rather than an invented
one, so it works against any authorization server that implements it.

> **Today.** No client that may use the exchange grant can be provisioned at all:
> registration hardcodes clients as public, permits only `authorization_code` and
> `refresh_token`, and there is no static-client config, so the path is reachable only
> through a test seam. Client authentication is not the obstacle —
> `client_secret_basic` works with no new code. SPIFFE client auth exists on the
> `spiffe-authserver` branch and is deliberately deferred in
> [#5194](https://github.com/stacklok/toolhive/issues/5194), which extracted the
> OAuth-only path first.
>
> **Change.** Provisioning: a static confidential client, or relaxed registration. Small,
> and it blocks everything after it.

**What an attacker gets.** Whoever holds the shared credential can act as that kind of
agent for whatever it names, which is the argument for it naming little and expiring
fast. An attacker inside the process gets what the model gets, which is the argument
against a static secret. An attacker who can make the harness request a credential naming
a user it is not acting for defeats everything downstream, which is what the consent
check on the subject token is for.

---

### Hop 4 — the harness calls a tool

**What should happen.** The call carries the credential and the correlation value, and
nothing else that matters. No header the gateway reads for identity. Everything *decided
on* travels in the credential, because anything else cannot be verified at the far end;
the correlation value is logged, never authorized on, which is why it does not need to
be.

This is what makes the subagent tier safe. A subagent cannot talk its way into a stronger
identity by manipulating a header, because there is no header to manipulate. Its identity
was fixed when the harness minted the credential, before it ran.

> **Today.** The inbound path reads only `MCP-Protocol-Version` and `Accept`, and the
> identity struct has no header-populated field, so this already holds. Worth keeping
> when the outbound path stops baking a static header map into a client at dial time.

**What an attacker gets.** Prompt injection reaching the subagent is expected, not
exceptional. What it buys is bounded by what the credentials permit, which is why hop 3's
narrowing carries the weight.

---

### Hop 5 — the gateway decides

**What should happen.** One gate, always in the path, that sees the whole question: who
is acting, for whom, on what, at which backend. It decides before any credential is
selected, and refusing stops the call.

**One gate rather than several.** A check that lives in each outbound path can be left
out of one of them, and the omission is invisible until someone finds it. A single gate
can be wrong, but it cannot be absent.

**What the decision needs to see.** The acting agent, so policy can be written about
agents and not only users. The operation, so reading and writing differ. And the backend,
because "may this agent read" and "may this agent read GitHub" are different questions,
and only the second is useful when one gateway fronts several backends holding different
credentials.

**Missing must mean refusal.** A gateway with credentials attached and no policy written
should serve nothing. Allow-all is a reasonable default for a proxy with nothing to hand
out, and the wrong one the moment there is something.

> **Today.** Admission is already the single gate and already always in the path. It
> receives the acting agent as a nested claim and a read/write hint from the backend's
> own tool annotation. It does not receive the backend — that identifier exists on the
> tool and is not passed. With no policy configured the gate is allow-all, so a
> deployment with credentials wired and no policy serves any advertised tool to any
> authenticated caller.
>
> Two sharper edges. The read/write hint is whatever the backend declared, absent by
> default, with no fallback, so a policy has to decide what an unannotated tool means.
> And pinning a primary upstream provider causes the issued token's claims to be
> discarded, so the acting agent disappears and a policy written about it stops matching
> rather than starting to fail.
>
> **Change.** Pass the backend identifier. Make absence refuse when a credential store is
> attached. Stop discarding the issued token's claims. Choose the unannotated default.
> All fixes to an existing gate; no new component.

**What an attacker gets.** This is where a confused deputy is caught or not. The agent
cannot read Alice's credentials, but it can ask the gateway to use them, and the gate is
the only thing between the request and that use. A gate that cannot see the backend can
be talked into using the wrong credential for a call it was willing to allow. A gate that
is absent can be talked into anything.

One rule worth taking verbatim from `draft-hartman-credential-broker-4-agents-00`: *"The
PDP MUST NOT evaluate justification text for approval decisions."* Agent-authored prose
must never influence the decision. In an agent deployment that is the entire
prompt-injection surface, not a refinement.

---

### Hop 6 — the gateway picks a credential and uses it

**What should happen.** Two stages, in order.

**First, which credentials are candidates.** The credential belongs to the user, so this
keys on the user. Not on a session, not on a login — those describe a browser visit, and
the question here is whose credential this is.

**Second, which one may be used for this call.** That takes the backend being routed to
and the decision from hop 5. The result is one credential or none.

**Why the first stage cannot key on a login session.** A pointer minted when a human
logged in through a browser describes an episode, not an entitlement. An agent has no
such episode: nothing mints one for it, and where a user's token carried one, exchanging
it for a delegated credential drops it. So a design that looks up credentials by login
session cannot serve an agent. There is nothing to manage here, nothing to keep fresh.

**And the user has to be somewhere the lookup can read.** If the credential names the
acting agent as its subject, the user sits one level in. Whatever holds it has to be
legible at this hop. A design that puts the user only in a structure declared unreadable
has made the lookup impossible.

**Why the second stage cannot be skipped.** Keying on the user alone returns everything
the user has. The first stage narrows to a person; the second narrows to a purpose.
Without it, every delegated credential reaches every credential its user owns, and the
narrowing from hop 2 stops at the gateway's front door.

**Missing anything means nothing is used.** No decision, no backend, no user — no
credential.

> **Today, and this is worth spelling out because it is the design's central problem.**
>
> The HTTP request arrives. Authentication middleware runs, validates the token, takes the
> login-session pointer out of it, and loads **every** credential stored under that
> pointer into a map on the identity: Alice's GitHub token, her Slack token, her AWS
> credentials, everything she has connected. This happens *before* the JSON-RPC body is
> parsed, so nothing at that point knows the call is `github.read_file`, or that it routes
> to the GitHub backend, or what its arguments are. The code says as much: a per-backend
> check would need routing context this layer does not have.
>
> Later, after routing, the outbound strategy for the GitHub backend reads the GitHub
> entry out of that map, using a provider name written in static configuration.
>
> So the credential is chosen by config authored before the request existed, and the
> request itself contributes nothing to the choice. There is a real interface at the load
> point that a filtering implementation could replace, but filtering there can only key on
> the token — which is why the enterprise user-keyed decorator, which sits below that same
> interface, is stage one and cannot be stage two.
>
> **What this costs, concretely.** A subagent narrowed to read-only on one repository can
> trigger `slack.post_message`, and nothing in the credential path objects, because by the
> time anyone knows the call is Slack the Slack token is already loaded and the only
> remaining question is which key to read from the map. The narrowing exists; nothing
> downstream consults it. Separately, every request pulls the user's entire credential set
> into memory whether or not the call needs any of it.
>
> **Change.** Stage one is largely a port of work that already exists. Stage two means the
> credential fetch has to happen somewhere that knows the tool and the backend, and has
> Cedar's answer in hand. Two shapes: move the load after routing, or split it — keep a
> cheap identity resolution early and defer the fetch to where the outbound strategy runs.
> Neither is much code. Both cross a layer boundary that exists for a good reason, since
> authentication middleware is where authentication belongs, which is why this is the
> substantive piece rather than a patch.

**The ordering is not an open question. We are the outlier.**

Every comparable system fetches a credential against a target it already knows. RFC 8693
settles it in the request grammar rather than in advice: a token-exchange request carries
`resource`, `audience` and `scope`, so the downstream call has to be known before the
downstream credential can be minted. Vault has no map to index at all — its policy check
and its credential production are one operation against one named path. AWS's agent
gateway configures outbound auth per target and fetches one credential per invocation
against a named provider. CyberArk's secretless broker selects a provider from the
connection. The MCP gateway `agentgateway` authorises per tool and target.

So "load everything the user has, then index by static config" is not a design anyone
argued for. It is a consequence of the fetch sitting in authentication middleware, which
is a reasonable place for authentication and the wrong place for this.

**Envoy states our exact failure mode as a security bug.** Its external authorization
filter runs after route matching precisely so the decision sees the resolved target, and
its documentation warns that a later filter clearing the route cache is a
privilege-escalation vector — because the decision was then made about a different target
than the one served. Same shape as ours: **the decision and the fetch have to see the same
target, resolved once.** That is the argument to make, and it comes from a Tier-1
implementation rather than from us.

**The hazard has a classical name.** Preloading every credential and letting a later stage
index into the map is ambient authority, and the failure is a confused deputy — the later
stage never had to prove entitlement to what it reaches. AWS says the same thing about its
own gateway in plainer terms: the execution role's permissions are the upper bound of what
any authorized caller can exercise through it. What nobody appears to have written up is
this specific pattern — a multi-user gateway preloading one user's whole third-party
credential set per request. That framing is ours to make, grounded in the general
principle.

**What is genuinely unspecified is the containment algorithm, not the ordering.** RFC 9396
says there is no standard way to compare two authorization detail requests and puts it out
of scope; the drafts that approach credential selection hand the remainder to an
unspecified policy point. That only matters if we carry authority in the credential. With
narrowing in policy, the ordering fix is the whole job.

**No good name exists for the target.** "Just-in-time credential issuance" and "credential
broker" are the closest established terms; "late binding" and "deferred credential
resolution" are not established in this space and would have to be defined anyway. Use
*just-in-time, target-scoped credential resolution*, or borrow RFC 8693's framing
directly.

One calibration point worth keeping: `agentgateway` authorises on tool name and target but
does **not** expose tool arguments to its policy language. If this design wants arguments
in the decision, that is ahead of shipped MCP prior art rather than behind it — which is a
reason to be careful, not a reason to be pleased.

**One friction worth naming.** The actor-profile draft permits reading an inner chain
entry as an authorization input, but a resource server's default is the outermost actor.
Our authorization-relevant identity is the user, which sits inner. So traversal is
allowed and is not what a conformant reader does first — an argument for carrying the
user where the reader already looks, rather than relying on it walking the chain.

**What an attacker gets.** Reaching stage one as the wrong user gets that user's whole
credential set, which is why the key has to be an entitlement rather than an episode.
Reaching stage two unchecked gets the right user's whole set, which is the confused
deputy one layer lower. And a stored credential never checked against the identity that
stored it lets a chain rooted at one user reach another's — worth naming because that
check is declared in the code and never performed.

---

### Hop 7 — the backend serves the call

**What should happen.** The backend gets a credential it already understands, for a call
already authorized, and verifies what it always verifies. It learns nothing about agents
or delegation.

That is a goal, not a shortfall. A backend has no policy about mecatl's subagents it
could apply, and making it understand our vocabulary would turn every integration into a
negotiation.

**The chain does not reach here.** Whatever the gateway minted or injected is what the
backend sees. RFC 8693 §2.1 is explicit that an exchange *"is a one-time event and does
not create a tight linkage between the input and output tokens"*, so a backend cannot
walk it back. Any claim that a third party can verify the chain has to be scoped to **the
gateway**, not the resource server.

That is the right place — the gateway is where the claimed authority and the credential
about to be used are both visible, and the only hop where refusing prevents anything. But
the boundary should be stated rather than implied to extend further.

> **Today.** This already holds. The outbound strategies derive a credential from stored
> tokens or an exchange, and none read the inbound claims. No change; the deliverable is
> accuracy.

**What an attacker gets.** The backend cannot tell the agent from the user, so attribution
there is only as good as the gateway's audit record. That puts the gateway inside the
trust boundary for attribution, which is fine and worth saying, because "verifiable by
anyone with the bundle" reads as though it were not.

---

### Hop 8 — the session parks, then resumes somewhere else

**What should happen.** The credential expires. The authority does not. On resume the
credential is re-derived, never wider than before.

**Where there is a live caller, derive from that caller.** Someone who just authenticated
is a stronger statement than a row saying they once did. This covers more cases than it
seems: approve-after-restart comes from an inbound request, so a human clicking approve
is authenticated; a resumed subagent runs under a live parent turn; a background child is
run-scoped with a live parent. The only case with nobody present is the scheduled run
from hop 1 — which already has its own stored owner and its own no-user credential.

**Authority must not be read out of a row that anything can write.** If the stored record
is the authority, whatever can write the store can grant authority, and the identity
layer is decoration on a database.

> **Today.** Sessions park and resume on other pods, and the persisted labels have no
> integrity protection — rehydration trusts them verbatim, including the permission
> posture. So monotonic attenuation across resume is one write away from false, and the
> store is currently unauthenticated.
>
> **Change.** Derive from the live caller where there is one, which covers nearly every
> path and costs almost nothing. Sign the chain at mint and verify before re-minting for
> the one path where nobody is present. Much smaller than signing for all of them.

**What an attacker gets.** Someone who can write the store but cannot sign is a distinct
and likelier adversary than one who has compromised a pod — a leaked database credential
rather than code execution. That adversary is precisely who chain integrity defeats, and
folding the two together into "the pod that can sign can impersonate anything" makes the
mitigation look less valuable than it is.

---

## The steps as interfaces

Written as signatures rather than prose, because prose let several things stay vague that
a type does not. These are shapes, not literal Go, and they span two codebases.

Each step's output has to be the next step's input. Where it is not, that is a finding.

```
Hop 1   BindPrincipal(inbound Request)            -> (Principal, error)
        OwnerOf(spec ScheduleSpec)                -> (Principal, error)

Hop 2   Narrow(parent Authority, spec SpawnSpec)  -> (Authority, Limits, error)

Hop 3   DelegatedCredential(
            subject UserToken, def DefinitionID,
            a Authority, aud Audience)            -> (Credential, error)
        ClientCredential(
            def DefinitionID,
            a Authority, aud Audience)            -> (Credential, error)

Hop 4   Call(c Credential, corr Correlation,
             tool ToolName, args Args)            -> (Result, error)

Hop 5   Decide(claims Claims, tool ToolName,
               backend BackendID, op Operation)   -> (Decision, error)

Hop 6   Candidates(u UserID)                      -> ([]StoredCredential, error)
        Select(cands []StoredCredential,
               backend BackendID, d Decision)     -> (StoredCredential, error)

Hop 8   Rederive(s Session, caller *Principal)    -> (Credential, error)
```

Six things the signatures expose that the prose hid.

**`Principal` is a sum type, not one thing.** Hop 1 produces either a user or a client,
and hop 3 has a different constructor for each. Writing "the principal" throughout let
that stay invisible. Anything consuming a `Principal` has to handle both, and the audit
record differs.

**`Narrow` returns two values, and only one of them travels.** `Authority` is the
reach-changing part — tools, mutation, resources — and crosses the boundary. `Limits` is
turns, tool calls and timeouts, and never leaves the process. Separating them in the type
is what stops the second kind accidentally becoming a claim.

**Two credential constructors, not one with a nullable subject.** They are different
grants and different trust models: one exchanges a user's token, the other authenticates
as the harness. A single function with an optional user is how the unattended path ends up
sharing validation it should not.

**`DelegatedCredential`'s parameters are exactly the cache key.** That falls out rather
than being designed, which is a good sign. It also means adding a parameter later silently
fragments the cache.

**`Operation` has three values, not two.** Read-only, mutating, and unknown — because the
hint comes from the backend's own tool annotation and is absent by default. Policy has to
handle unknown explicitly. A two-valued type here is how an unannotated tool quietly gets
treated as safe.

**`Select` needs two distinct errors.** "This user has no credential for that backend" and
"this caller may not use it" are different conditions. Collapsing them makes a permission
failure indistinguishable from a missing integration, which is both a bad diagnostic and a
small information leak.

And one thing the signatures make obvious that was easy to miss in prose: **`Decide` takes
`backend`, and `Select` takes the `Decision`.** Today the gate is not given the backend,
and selection happens before routing so it cannot receive a decision at all. The two
missing arrows are the design's actual work, and they are visible here as parameters that
have nowhere to come from.

`Rederive`'s caller is a pointer on purpose. Non-nil is the common path and the cheap one.
Nil is the scheduled run, and the only case that needs the signed chain.

---

## What has to change, on each side

Organised by codebase, each tied to the interface it serves. Everything here is fungible —
these are cost signals, not constraints.

### mecatl

| Interface | Change | Where |
|---|---|---|
| `BindPrincipal` | A principal field on session creation, on both the session and team requests | proto contract, `session` aggregate, server adapter |
| `OwnerOf` | An owner on `ScheduleSpec`, read by the fire path | `makeFireFunc` calls `CreateSessionWithProfile` in-process, so it never crosses the interceptor that would assign one |
| `BindPrincipal` | Labels must reach children, and empty must be rejected rather than compared | `buildChildSession`, `runBranch` and `Supervisor.sessionID` call `session.New` with no labels; the only writer lives in the server adapter, off every child-spawn path |
| `Narrow` | Split the returned authority from the limits, so only the reach-changing part can travel | today both are internal — catalog composition plus the audience-pinned evaluator |
| `DelegatedCredential`, `ClientCredential` | Mint in composition, never behind a port the loop calls | the loop must stay identity-agnostic. `TeamMemberEngineFactory` and `WithSubagentEngineFactory` are the existing shape: composition-supplied closures, with `engine/agent` carrying only an opaque string on `parentCaps`, following the `forkHistory` precedent |
| `Call` | A per-call correlation value | the MCP adapter bakes a static header map into a client at dial time; nothing is per-call today |
| `Rederive` | Derive from the live caller where there is one | the rehydration seam exists; it currently trusts persisted labels verbatim, including the permission posture |

### vMCP and ToolHive — fixes on `main`

| Interface | Change | Where |
|---|---|---|
| `DelegatedCredential` | **Make a confidential client provisionable, and do it with SVID client authentication rather than a secret.** Registration currently hardcodes clients public, rejects any auth method but `none`, and permits only `authorization_code` and `refresh_token`; there is no static-client config. **This blocks everything else.** The `spiffe-authserver` branch already auto-registers a confidential client with both required grant types, so the port answers this and the secret question together — see the branch table below. A static client with a shared secret is explicitly not the interim: it would ship the credential-in-the-environment problem the design exists to remove, and then be thrown away. |
| `Decide` | Pass the backend identifier to the gate | it exists on the tool type; admission passes only the name |
| `Decide` | Refuse when a credential store is attached and no policy is configured | the authz factory returns nil, which becomes an allow-all admission whose check returns true unconditionally |
| `Decide` | Stop discarding the issued token's claims when a primary upstream provider is pinned | claim resolution swaps to that provider's token, so the acting agent disappears and policy stops matching rather than failing |
| `Select` | Check the stored credential against the identity that stored it | the error for this is declared and never returned on that path |
| — | Advertise the grant, and a client-auth method, in discovery | discovery lists only `authorization_code` and `refresh_token`, and only `none` |

### vMCP and ToolHive — exists but unwired

| Interface | Change | Where |
|---|---|---|
| `DelegatedCredential` | Wire the multi-issuer subject-token validator | it exists with tests and has no non-test callers; the factory wires the self-issued one only. [#5989](https://github.com/stacklok/toolhive/issues/5989) gates it on a consent model, because external tokens often carry no `client_id` and fail the consent check closed |
| — | Wire the token cache | `pkg/vmcp/cache` declares the cache and is referenced nowhere outside its own package; two strategies keep private per-config caches instead |

### vMCP and ToolHive — ports from branches

| Branch | What to take | Note |
|---|---|---|
| `token-delegation` | The `oidc-trust` upstream type and its config surface — this is what lets hop 3 accept a subject token from the corporate IdP | **Port the config surface onto main's handler, not the branch's.** The branch handler predates main's hardening and lacks the consent check, `act` nesting and audience narrowing. |
| `spiffe-authserver` | The client-auth strategy, its middleware, and one wiring line | **On the critical path, and the answer to the provisioning blocker.** Auto-registers a confidential client with both required grant types, and authenticates it with the pod's SVID rather than a secret. Deferred in [#5194](https://github.com/stacklok/toolhive/issues/5194) as a sequencing decision, which this design reverses on the grounds that the alternative ships a secret the model can read. One deployment prerequisite to confirm: TLS has to terminate at the authorization server, or the ingress has to forward the client certificate. |

### Doesn't exist anywhere

| Interface | Change |
|---|---|
| `Candidates` | Key the credential read on the user rather than a login session. The enterprise user-keyed decorator already does this and is a port rather than new work |
| `Select` | **Stage two.** The decision from the gate has to reach the point of selection. The credential read has a real interface behind it, but it runs in HTTP middleware before routing, so there is no tool, no backend and no arguments at that point. Moving or splitting it is the substantive piece of this design. Note this is a fix rather than an invention: every comparable system already fetches against a known target, and Envoy treats decide-and-fetch disagreeing about the target as a privilege-escalation class |

One design analogue worth reading before building this, with a caveat. The `nono` agent
sandbox uses a credential-injection proxy that routes by service prefix and then resolves
the credential for that service — target-keyed, which is the right shape — but it loads
credentials from the keystore eagerly at startup, which is the shape we are moving away
from. It gets away with that because it is single-user and local: one principal, keys on
the same machine, no cross-user blast radius. A multi-user gateway has no equivalent
excuse. Worth studying for the injection mechanics, not as validation of preloading. It
also uses "phantom token" for its swap-the-credential-at-the-proxy pattern, which collides
with Curity's established use of the term for something else; avoid the phrase.

### Order

Provisioning and the external-issuer path gate everything — without them there is no
credential to reason about. Session and schedule ownership gates the mecatl side
independently, so it can proceed in parallel.

Then the gate's two missing inputs and its fail-closed default, since those are small and
make the gate correct before anything depends on it.

Then stage two, which is the design's real work.

Caching matters before fan-out is usable, but not before it is correct.

The SPIFFE port is on the critical path, because it is how the first item gets done. The
alternative — a static confidential client with a shared secret — would work and is
rejected deliberately: it puts a credential in an environment the adversary in this threat
model can read, and it is throwaway work, since the SVID path has to happen eventually
anyway.

---

## Deliberately open

**Where the user is carried, given the subject names the agent.** The lookup needs it
legible. Which claim holds it is a naming decision with a caching consequence, because it
becomes part of the key.

**How much narrowing travels in a credential versus living in policy.** The drafts
genuinely disagree, so this is not a settled question we are ducking.
`draft-mcguinness-oauth-actor-profile-00` says it *"operates at the representation and
propagation layer, not at the authorization policy layer"*.
`draft-liu-oauth-chain-delegation-00` puts it in the token with a MUST-subset the
resource server verifies. Since a child's tool set is largely determined by its
definition, policy can name most of it directly, and only what genuinely varies per spawn
needs to travel. Read-versus-write is the clear case; whether anything else qualifies is
worth settling before committing to a structured authority claim.

One shape constraint if we do carry it: fields inside a single `authorization_details`
object combine as a cartesian product, so this needs one object per backend-and-operation
cluster rather than one large object.

**What an unannotated tool means.** No fallback classifier exists, so this is a default
somebody chooses.

**Whether SPIFFE is on the critical path.** It is required for no hop above. It is
required for one thing: an agent identifier a policy can name as a SPIFFE ID. Whether
that is worth the port is a judgement about where policy is heading.

---

## References

- RFC 8693 (token exchange: §1.1 delegation versus impersonation, §2.1 no linkage between
  input and output tokens, §4.1 the current actor and identity-only `act` contents),
  RFC 9396 (`authorization_details`; §2.2 the field model, §6.1 no standardized
  comparison), RFC 8705 (mTLS client authentication), RFC 9068 §2.2 (`client_id` in
  conformant JWT access tokens), RFC 7523 (JWT assertion grants)
- Adopted drafts: `draft-ietf-oauth-transaction-tokens` (per-call context inside a trust
  domain), `draft-ietf-oauth-identity-chaining` (§2.5 no higher privilege than the subject
  token), `draft-ietf-oauth-identity-assertion-authz-grant` (ID-JAG),
  `draft-ietf-oauth-spiffe-client-auth`
- Individual drafts: `draft-mcguinness-oauth-ai-agent-instance` (per-instance identity and
  revocation), `draft-mcguinness-oauth-actor-profile` (actor semantics, layer scope),
  `draft-liu-oauth-chain-delegation` (in-token subset), 
  `draft-niyikiza-oauth-attenuating-agent-tokens` (§4.5, §7 containment algorithm),
  `draft-hartman-credential-broker-4-agents` (broker model; the justification-text rule)
- WIMSE: `draft-ietf-wimse-arch` (§2 the workload floor, §4.3 constrain, §4.5 authentication
  is not authorization), `draft-ietf-wimse-workload-creds` (§5.1, §7 identity and authority
  are separate)
