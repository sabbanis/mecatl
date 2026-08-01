# PR #321 — comments to post

Three sections. **A** is design questions, where I'm actually disagreeing. **B** is
what has to change in mecatl for the design to be implementable, which is most of
what I found. **C** is doc corrections.

---

## TOP-LEVEL

Reviewed with the SPIFFE, RFC 8693 and WIMSE specs open, plus a pass over the code
each claim touches. The design holds up. The three-tier split is the right
decomposition, `act`-is-audit-never-authority complies with a normative MUST that
most agent-delegation designs get wrong, "subagents are not network entities"
deletes the per-subagent key problem, and the `sub` collision between JWT-SVID §3.1
and RFC 8693 delegation is a real find. This also supersedes my own draft on the
same topic, which I'm deleting; the tier model here is better than what I had.

Most of what follows is not disagreement. It's the prerequisite list: the design
assumes several things about mecatl that aren't true yet, and they're cheap to state
as work items. Three things are genuine design questions, in section A.

Separately, the outbound boundary we'd agreed to take next is now a stacked doc,
`docs/agent-identity-outbound.md`. The only ask on *this* PR is that line 359 stop
reading as though the SVID presentation is settled. A0 summarises what's in the stack.

---

# A · Design questions

A0 is the known outbound-boundary gap we've agreed to take next; it's a one-line ask
here plus a pointer to the stacked doc. A1 to A3 are open.

## A0 · The outbound boundary (known, agreed as next work)

Not a challenge to this PR, and only one ask on it.

**The ask.** Line 359: "the *harness* presents the subagent's SVID plus its own
proof-of-possession" reads as settled, and it isn't. Suggest naming it an open boundary
and linking out, because how it resolves decides how much of the issuer apparatus is
load-bearing — on one of the two live options the SVID does nothing at that hop.

I've worked the rest out in a stacked doc rather than inline here, since it's a design
with its own open decisions and deserves its own review thread:
**`docs/agent-identity-outbound.md`** (stacked on this branch).

What's in it, so you can judge whether it's worth reading before merging this:

- vMCP is a gateway, so there are two boundaries, and the choice at the first constrains
  the second.
- Boundary 1 is one credential and two options. The default: mTLS with the X.509-SVID at
  vMCP's token endpoint, one client-auth layer under both `client_credentials` (unattended
  work, including scheduled fires) and `token-exchange` (delegated, user token in hand).
  The alternative is ID-JAG at the front-door IdP, for callers whose token doesn't name
  mecatl. The discriminator is third-party dependency, not build cost.
- The SVID's justification is narrower than this doc assumes and confined to the first
  option: no static `client_secret` in the environment, plus per-pod attestation. Real,
  but smaller than "the harness's identity."
- A subagent rides `act` at **definition** tier, for a cache reason, and `act` is
  authority rather than only audit — RFC 8693 §4.1 permits authorizing on the current
  actor, and `actor-profile-00` §14.5 calls evaluating only `sub` a confused-deputy risk.
  Worth reconciling with this doc's audit-only framing.
- One real conflict: a delegated token can't carry the upstream-session reference, which
  breaks the plain-3LO path at boundary 2 — the strategy that serves most ordinary
  backends. That's the item most likely to force a rework.
- The blocker is a decision rather than a build: three identifier spaces are in flight for
  `act.sub`, and no policy can be written until one is picked. The first option dissolves
  most of it, since the `client_id` and SPIFFE-URI candidates turn out to be the same
  string on that path.

## A1 · Suggestion: derive authority from the live caller, and make the stored chain a bound rather than a source

A concrete alternative for the parkable-lifecycle section, which I think is both
safer and less work.

**The proposal.** On resume, mint from the identity of whoever is asking *now*, and
use the persisted chain only to check that the new credential doesn't exceed what was
previously granted. So the chain becomes an upper bound you validate against, not the
thing you read the subject out of. Instead of "the record says X, so mint X", it's
"the caller proved X, and the record confirms X was within what was permitted."

**Why.** A stored record is only ever as trustworthy as whatever can write it. Today
that's an unauthenticated Redis (B5), so it's worth very little. But even after B5 is
fixed, "trust the row" is a weaker claim than "the caller just authenticated", and
the design currently rests the entire post-restart authority on the row. Four shipped
systems made the opposite call, which is what moves this from a detail to the main
alternative:

- AWS Bedrock AgentCore re-derives identity from the live inbound request on every
  invocation and explicitly declines to store the mapping: "AgentCore does not
  enforce session-to-user mappings."
- OpenAI Codex persists the agent task into its rollout stream, then on rehydration
  calls `task_matches_current_identity` and discards on mismatch. The record is a
  cache; the live binding is the authority.
- CB4A, your own citation, makes SVIDs non-renewable: "agent MUST re-attest to get
  new SVID."
- `practices-05` §5.5, which you already quote for the pause language.

**What it buys.** Most resumption turns out to have a live caller already, so this
covers it for free. Approve-after-restart is reached only from `ApproveRun`, which is
only reached from the wire, so a human clicking approve *is* an authenticated
request. A `resume:` of a persisted subagent runs under a live parent turn. Background
children are run-scoped with a live parent. The one case with genuinely nobody there
is a scheduled fire (A2, B4).

So the signed-chain machinery is needed for one case instead of all of them, and it's
the case the doc doesn't currently mention. That's a much smaller thing to build, and
it puts the effort where the risk actually is.

**If you keep the chain as the authority anyway**, it needs integrity. It currently
rides the `Profile`/`ProviderID` snapshot pattern, which has none, and
`Service.rehydrateSession` trusts those labels verbatim including `sess.Mode`, the
permission posture. So monotonic attenuation across resume is one `HSET`. The fix is
that the issuer signs the chain at mint and verifies before re-mint, so the row
proves its own integrity rather than being trusted for being in the database.

**And this answers your own open question 4 — type or instance.** The doc guesses "a
definition name like `code-reviewer` is simpler and probably right at first" without a
reason. The reason is cacheability. Key the exchanged token on `(user, agent
definition, scope-set, audience)` and eight concurrent subagents of one `AgentDef`
share one token that survives across turns and sessions for its TTL. Name the
*instance* and the token is per-session and uncacheable, which puts a network round
trip on the tool-call path at fan-out. So: definition in the actor claim, where it's
both authorizable and cacheable; instance id as a non-authz correlation value. RFC
8693 §4.1 licenses exactly that split, and per-spawn minting is only forced if every
instance needs a distinct scope set — which def-level tool sets suggest it doesn't.

One scoping note that follows: ADR 0041/0058 direct-write subagents have no boundary
at all, so per this doc's own reasoning they use the parent's identity and are out of
scope here entirely.

## A2 · Suggestion: make the durable owner record primary and the edge one writer of it

**The proposal.** Instead of the edge interceptor being *the* place a principal is
bound, treat the stored owner as the primary record and the edge as one of the things
that writes it. Then work that starts itself has somewhere to get a principal from,
and the edge keeps doing exactly what it does today.

**Why.** The doc makes the network edge the sole source of `user/<uid>`, and
everything downstream depends on that. But `makeFireFunc` calls
`CreateSessionWithProfile` in-process from a leader-elected goroutine, so a scheduled
fire never crosses the interceptor. It has no user by construction — and crucially, no
amount of issuer or KMS work reaches it, because the work never passes the point where
identity is assigned. A harness that runs work on a timer can't derive principals only
from inbound requests.

**What it costs.** `ScheduleSpec` gains an owner field (B4), and the fire path reads it
instead of finding nothing. That's the whole change on the mecatl side.

**And the honest answer for what that owner should be.** Not a user. A cron fire has no
user, so there's no ID token and no subject token, and A0's Flows A and B both need one.
It's the unattended branch of A0's Option 1: `client_credentials` at ToolHive's AS, where
scheduled work authenticates as itself with its SVID and policy is written against the
client. That records "the schedule did this," which is true, rather than "Alice did this
at 3am," which isn't. It needs no separate component either — the same client-auth layer
serves both branches, so it comes for free with the delegated path.

The tempting alternative — give the schedule a service-account user with a stored
long-lived refresh token — reintroduces exactly the stored-credential problem the rest
of this design exists to remove, and it lies in the audit log. Worth naming as
considered and rejected rather than leaving the reader to wonder.

Either way this belongs in the doc: it's currently in neither the out-of-scope list nor
the open questions, and the Schedule tool has shipped.

## A3 · Suggestion: make phase 1 either unsigned-and-honest or signed-and-enforcing, and move the one-way commitments later

**The proposal.** Split phase 1 along a different line. Ship the audit trail
*unsigned* — `principal` on the EventLog annotation — and hold the signing apparatus
until the phase that also enforces. Or, if signing has to come first, bring the
ownership comparison and the child-principal binding forward into it. Either is
coherent; the two combined as currently scoped are not.

**Why.** Contract #3 says of Copilot's coding agent: "commits attributed to the user,
no visible actor — impersonation with no audit trail. We refuse that shape." But as
scoped, phase 1 produces signed `dlg` chains rooted at a real `user/<uid>`, with no
scope enforcement and every child carrying an empty principal (B3). A real human root
with blank actor hops reads as *the user did this* — the shape the doc refuses, in the
first phase, under a signature.

The sharper version: phase 1 signs `scope`, whose own table entry says "Issuer-enforced
invariant: strict subset of the parent's", and enforces nothing. The named downstream
consumer is `scoped-resource-grants.md`, a *verifier* design — so a verifier reading
phase 1's `scope` would be correct to believe it. That's not a gap a later phase fills;
it's a signed claim that isn't true yet, and signing is precisely what makes a reader
stop checking.

**What it buys.** The unsigned variant is small, true, and immediately useful: a durable
record of which principal did what, on a seam (`Service.appendEvent`) that already
exists. It also can't be misread, because nothing about it invites trust it hasn't
earned.

**And a second reordering worth making at the same time.** Phase 1 currently takes the
commitments that are hardest to undo: the KMS dependency, the JWKS endpoint with an
admittedly unresolved SLO, and the trust-domain name — which the doc concedes is close
to one-way, since "a rename orphans every SPIFFE ID in the historical audit log", with
no migration story. Those land before anything has been learned about whether the novel
parts work. Moving them behind the first enforcing phase costs a little sequencing and
buys the option to change your mind.

---

# B · What has to change in mecatl

None of these are objections. They're the prerequisite list, and stating them in the
doc would make the phasing concrete.

## B1 · `CreateSessionRequest` needs a principal field

Nothing can set a principal today. `CreateSessionRequest` has no such field and
neither does `CreateTeamRequest`, so only an in-process host could write the label.
The edge interceptor is correctly identified as the missing seam; this is the proto
half of it.

Two notes on the proto paragraph while you're there. "The driver protocol today
carries no tenant, principal, session, or namespace field on any RPC" is wrong,
since every session-store RPC carries `session_id`. And a principal on the
*snapshot* needs zero proto change (the driver payload is opaque, `sessnap` is
additive JSON) whereas the Audit section's "events gain a principal annotation" is
one. So the count is one change, just not the one named.

## B2 · Tier 1 needs an agent name on session creation, or it's a constant

`CreateSessionRequest` has no agent field and the per-def engines are child engines
only, so no top-level session is ever bound to an `AgentDef`. `<def>` in
`spiffe://<td>/agent/<def>/inst/<sessionID>` resolves to `main` for every session
that exists.

That has consequences worth naming in the doc, because they follow from the gap
rather than from the design. Definition-tier policy has no subject: a `tdd-worker`
only appears as `agent/main/inst/<sid>/child/subagent-<callID>`, with the def name
absent from the path. `may_act`, discharged onto definition-tier policy, has nothing
to bind to, and `AgentDef` carries no authority fields. Two of the four nested
envelopes are empty, leaving instance ⊇ child, which `governance.Audience` already
does. And the def name is already inside `dlg` as `{id, def, scope}`.

So: add the field and tier 1 becomes real, or drop `<def>` from the path and let
`dlg` carry it. A third option is making tier 1 the role instead, since `Deps.Role`
exists and `roleFamily` reduces it to a closed six-value set covering every engine.
Which one is a product decision rather than an identity one.

One snag to fix regardless: the session-as-identity rejection says instance identity
"inherits the wrong lifetime — sessions reopen across runs and migrate across pods",
twelve lines after the INSTANCE bullet makes surviving reopen and pod migration the
deliberate feature.

## B3 · The label has to propagate to children, and reject empty

`buildChildSession`, `runBranch` and `Supervisor.sessionID` all call `session.New`
with no labels, and `setSessionLabels` (the sole writer) lives in the server
adapter, off every child-spawn path. Since the child-minting seams are phase 2,
phase 1 as scoped ships every child with an empty `Principal`.

And the check has to reject empty rather than compare equal. The
`Profile`/`ProviderID` pattern is cited correctly, but those degrade to a sane
default and an identity field doesn't: empty means both "single-user deployment" and
"somebody forgot to propagate". The in-tree precedent shows the shape, since
`needsRehydration` is a pure empty-vs-set fold over exactly these labels and
`profileForSession` carries a documented second-defence inference because an empty
label can't be told from a genuine default.

Worth knowing no existing test catches a missed write: the `eventsource` fold guard
catches a missing classification. `storeconformance` round-trip fixtures are the
cheap place to catch it.

Also two exported surfaces, not one. `engine/adapter/eventsource/review_test.go`
compares `session.Session`'s exported fields exactly, and because a creation label
classifies as "supplied via SessionMeta, not event-carried",
`eventsource.SessionMeta` must gain the field with `Fold` assigning it. Both need
`task api:update` plus a CHANGELOG note.

`Service.ForkSession` does copy labels, but model-switch carryover takes them from
the request rather than the source.

## B4 · `ScheduleSpec` needs an owner field

It persists an entire session construction (prompt, trigger, workspace, mode,
`Mutating`, selector, limits) with no field naming the creating principal, and the
fire is deliberately a fresh top-level session. So a narrowly-scoped instance calls
`Schedule create`, and the fire runs later with deployment-default authority: no
parent, no `dlg`, nothing to attenuate against. Every bound the model establishes is
discharged by writing it down and waiting.

This is the concrete half of A2. The owner field is what makes the fire attributable
at all.

## B5 · The Redis client needs auth and TLS

`redisstore.go` dials `redis.NewClient(&redis.Options{Addr: addr})`. No password, no
TLS, no keyspace scoping, and `--redis-url` is a bare `host:port`. `Save` writes
`mecatl:session:<id>` with a caller-supplied id, and `sessnap` is plain JSON with no
MAC.

Two consequences. First, this is a prerequisite for any phase of the design meaning
anything, since `Principal` is a field in that same store. Second, the backstop
sentence has to go: "the identity references a session that must exist in Redis"
doesn't hold, because an attacker who can request signatures writes the session
rather than needing it to exist. The doc already says the honest version two sections
later — "the pod that can sign is the pod that can impersonate any session" — and
that sentence should replace it.

Worth adding that on resume all authority comes out of Redis, which makes it the
root of trust for the whole model.

## B6 · `validateScheduleSpec` needs workspace containment, and scope needs a resource axis

The doc excludes workspace from scope because it's "a property of the session's
construction, not of its identity". True for an operator-created session, false for a
model-created one. `validateScheduleSpec` checks the workspace for non-emptiness
only: no allowlist, no containment against the creating session's root, no
canonicalisation, and there's no workspace allowlist anywhere in
`internal/adapter/server` or `internal/app`.

A read-leaning scheduled fire runs in plan mode, which permits Read/Grep/Glob
confined to the workspace root, and that root is the model-supplied value. So
`Schedule create {workspace: "/var/run/secrets", mutating: false, cron: …}` is a
shell-free, approval-free, unattended read of the credential directory, and it works
on the distroless image.

So a child whose `scope` is a strict subset on the tool-name and posture axes can
read a strictly larger part of the filesystem than its parent. The stated reason for
excluding workspace is the argument for including it: construction is exactly what a
scoped principal must not be able to widen. A `resources` array with prefix
containment after canonicalisation (C1) gets most of the value.

## B7 · Child minting has to happen in composition, not via a port the loop calls

The doc says the issuer is "injected as a port; the engine loop stays
identity-agnostic (the same storage-agnostic discipline as `port.EventLog`)", and
also that child minting hooks into `buildChildSession`. Those two can't both hold.
EventLog works because the loop only emits and a downstream relay persists; the loop
never calls `Append`. There's no downstream seam for spawn, since the child is
constructed and driven inside dispatch.

The fix is an existing idiom. The team member factory is already
composition-supplied (`agent.TeamMemberEngineFactory` is a closure built in
composition), and `WithSubagentEngineFactory` is the same shape. Mint in
composition-supplied factory closures on both seams and have `engine/agent` carry
only an opaque string on `parentCaps`, following the `forkHistory` precedent. No new
port, and the discipline claim survives.

If you'd rather the loop be identity-aware, the honest in-tree analogy is
`Deps.ChildAskReviewer`, not `port.EventLog`.

## B8 · Smaller prerequisites

`SessionLease.Owner` can't carry the issuer identity. It needs per-Build
distinctness ("two Builds in one process get distinct owners") while an issuer
identity is shared across replicas: exclusion needs distinctness, attribution needs
sharing. It's also equality-compared in every backend, so overloading it makes four
adapters plus `leaseconformance` security-relevant. An additive field gets the same
result. (The same bullet uses "pod identity" and "issuer identity"
interchangeably.)

`callID` needs sanitising before it becomes a path segment. It's the provider's
tool-call id taken verbatim off the stream, so within-family uniqueness rides
provider entropy: fine for OpenAI and Anthropic, not for a gateway emitting
`call_1`, and a collision is a silent principal swap. `sanitizeFireIDName` exists
because a schedule name with a slash would land in a session id; the child id
families never got that treatment.

The KMS residual needs one more category. "A compromised pod can request signatures"
is infrastructure compromise, but on any image with a shell, prompt injection
reaches the same capability, and prompt injection is this doc's own primary
adversary. The Bash runner sets only `cmd.Dir`, and `governance.readOnlyVerbs`
classifies `cat`/`ls`/`grep`/`find` read-only by verb with no path predicate, so
`IsolationApprovable` auto-approves them for an isolated child with no human
involved. Distroless plus the `/bin/sh` default makes this inert today, which is
worth naming as a requirement of the feature rather than an accident, since
coding-agent images routinely need `git` and `go`. Also `networkpolicy.yaml` allows
egress to anything on 443 with no `to:` selector. Credit where due: it blocks port
80, so cloud metadata is unreachable.

Definition drift across a resume isn't detected. A project-tier `AgentDef` is read
from a mutable workspace, and instance identity is deliberately stable across reopen
and pod migration, so a resumed instance can be running a different catalog or model
than the one its credential was minted for. If you want to close that,
`draft-goswami-agentic-jwt-01` derives agent identity from a one-way hash of prompt,
tools and configuration and forces re-registration when it changes. Two caveats: its
§VII-D1 flags a TOCTOU problem, since runtime template substitution is hard to
distinguish from prompt injection, and the mechanism is patent-pending (application
19/315,486).

`jti`-to-session-liveness isn't a revocation substitute. It revokes the session, not
one leaked token, and since the harness re-mints on demand a holder with the signing
path just mints a fresh `jti`. Calling it a liveness hint would be accurate.

Whether `ListSessions` must be principal-filtered is undecided in the doc.
Unfiltered it returns every stored session id, and under this threat model an id is
the lookup key.

---

# C · Doc corrections

## C1 · Use RFC 9396 `authorization_details` for the scope claim

`scope` is registered to RFC 8693 §4.2 as "a JSON string containing a
space-separated list of scopes" in RFC 6749 §3.3 format, whose charset excludes
spaces and structured JSON, so the doc's structured value can't use that name
cleanly. RFC 9396 `authorization_details` is the registered name for structured
authority, published and used in FAPI:

```json
{"type": "mecatl_tool",
 "operations": ["Read", "Grep", "Bash"],
 "resources": ["/workspace/repo"],
 "constraints": {"posture": "auto", "max_depth": 3}}
```

`resources` is the axis B6 needs, and `constraints` absorbs the posture ceiling and
`max_depth` instead of them being separate top-level claims.

Two more in the claim table. `txn` is already registered: IANA points it at RFC 8417
§2.2, and Txn-Token -09 §9.2 confirms "as defined in Section 2.2 of [RFC8417]", so
it isn't pre-standard and References should cite 8417. And for the phase-3 PoP
binding, `cnf` with a `jkt` thumbprint (RFC 9449) is the standard name.

`dlg` is genuinely unregistered, so "pre-standard" is accurate for it. But two
drafts from the same author group (`draft-liu-agent-operation-authorization-02` and
`draft-liu-oauth-chain-delegation-00`) both call this claim `delegation_chain`.
Worth using that name, citing it as what `dlg` mirrors, or saying why a shorter
private name is preferred.

Minor: the `dlg` shape is described two ways. A flat `{id, def, scope}` array in the
table, nested `{sub, act: {sub, …}}` in the prose, with opposite ordering.

## C2 · The attenuation claim, in a version that holds

"Nobody has solved multi-tier agent delegation with attenuation" doesn't survive.
Suggested replacement:

> No ratified standard mandates attenuation. RFC 8693 only *suggests* scope as an
> abuse mitigation (§5); `draft-ietf-oauth-identity-chaining-17` expects
> non-escalation in non-normative prose and explicitly leaves claim representation
> undefined; ID-JAG makes narrowing a policy MAY (§4.3.3). Several individual drafts
> do mandate it. What is unspecified everywhere is *how* to compute a subset over a
> structured authority model, and *who* is obliged to refuse.

Four to cite:

- `draft-mcguinness-oauth-actor-profile-00` (30 Apr 2026) is the closest overlap,
  and not the "punts on policy" doc its abstract suggests. It mandates
  non-escalation on every path (§6.2.1.2, §6.2.2, §4.2), specifies a chain
  construction and validation algorithm with append-only as a MUST (§3.6), enforces
  a depth limit, and has `sub_profile: "ai_agent"` with a "user → orchestrator →
  agent → tool" reference architecture.
- `draft-mcguinness-oauth-ai-agent-instance-00` (4 Jul 2026), same author, makes
  your definition/instance split in almost your words: "A platform registers a
  single `client_id` and then runs many concurrent agent instances under it."
  REQUIRED `agent_instance_id`, plus `agent_platform`/`agent_model`/`agent_runtime`
  provenance. You cite Hartman as closest analog for per-session SVIDs; this is the
  closest analog for the tier model itself.
- `draft-liu-agent-operation-authorization-02` (16 Mar 2026) and its follow-on
  `draft-liu-oauth-chain-delegation-00` (6 Jun 2026) both name a `delegation_chain`
  claim and enforce strict-narrower server-side, the second with a depth cap of 5.
- Macaroons (Birgisson et al., 2014) and Biscuit are the actual origin of
  holder-side attenuation, and the omission I'd fix first. Biscuit gives a
  cryptographic guarantee rather than a runtime policy: the holder appends a
  narrowing block offline and the verifier rejects any block that widens. Worth
  revisiting because `docs/scoped-resource-grants.md` already evaluates Biscuit and
  parks it on the grounds that offline attenuation has no v1 consumer, but this
  design does want per-hop narrowing.

All four are individual submissions with Standards Track intent, none WG-adopted.
Only `draft-ietf-oauth-identity-chaining` and ID-JAG carry that.

What's left of the claim survives and gets sharper. Every attenuation MUST in
actor-profile cites "[RFC8693], Section 4" for the method, and §4 is the claims
registry where §4.2 defines `scope` as a space-separated string. No reduction
algorithm there. So even the draft with the hardest MUSTs mandates the requirement
and points at a section with no method. Containment over this authority model, with
tool names and a posture ladder and delegation rights, is genuinely unspecified.

Three places actor-profile makes your case stronger. Its chain entries carry only
identity (`sub`, `iss`, `sub_profile`), so a per-hop scope snapshot doesn't fit `act`
even under the draft that fully specifies it, making your secondary reason for a
private claim better than you argued. §6.3 requires an `actor_token` to identify the
acting party in its top-level `sub`, so a JWT-SVID is exactly the required shape. And
§3.2's "sub is the authorizing principal" is an explicit invariant, which RFC 8693
never states, so that's the citation your `sub` argument needs (C3).

One nuance that keeps `depth` yours: actor-profile's depth is a locally configured
maximum, never a token claim, so `max_depth` in the credential stays distinct and
RFC 3820 remains the in-credential precedent.

Two more gifts, uncited. Transaction Tokens §9.2 hits the same `sub` collision and
resolves it your way, with `sub` as transaction principal and `req_wl` as requesting
workload. And -09 §13.14 has an append-only chain MUST whose "mechanism for
maintaining this Call Chain is out of scope", naming your contribution as unclaimed.
RFC 3820 §3.8.2's rights-intersection rule is also prior art for the attenuation,
not just for `depth`.

One objection to answer: a JWT is immutable once signed, so a holder can't attenuate
its own token, and narrowing needs the issuer to mint a new one. General objection to
JWT chains, this one included. Your answer is that minting is a local signing call,
which is good and currently implicit.

Also: `max_depth` = 5 is citable from Sweeney §9.5 rather than picked. Sweeney is
also the only one of these with a fully worked revocation design, which is worth a
sentence in the costs section naming TTL-only as considered and rejected rather than
unconsidered. And the WIMSE workload/instance/service parallel is half right:
workload → instance nests and maps cleanly, but "service" is an orthogonal axis (a
capability spanning several workloads), so it doesn't correspond to "run".

## C3 · Citation pass

One pattern, so one pass fixes them.

The private-claims quote is the wrong sentence. JWT-SVID §3 reads "Registered claims
not described in this document, in addition to private claims, MAY be used as
implementers see fit", *then* warns about interoperability. The doc quotes only the
warning as if it were the permission.

The `sub`-collision premise overstates 8693. There's no normative language assigning
`sub` anywhere: §2.1 says only that the issued token's subject will "typically" be
the subject token's, and Appendix A.2.5 is illustrative. The conflict is real but
definitional. §4.1 defines `act` as the party *to whom* authority has been delegated
and keys access control to it, so with `sub` bound to the acting instance the user
can only go in `act` (making a conformant consumer authorize the user as actor) or in
a non-`act` claim (not `act`-expressed delegation). Regrounding it there makes the
argument unattackable, and actor-profile §3.2 states the invariant explicitly if you
want a citation.

One factual error. The doc says the 8693 trail "only exists across the sequence of
exchanges"; §4.1 says the opposite, that "the nested `act` claims serve as a history
trail that connects the initial request and subject through the various delegation
steps". What's defensible: `dlg` is issuer-enforced rather than AS-discretionary, and
carries a per-hop scope snapshot that `act` doesn't.

"Federation is free because we stay spec-shaped" isn't true, and it's the only
justification offered for the PKI apparatus. A bundle endpoint needs either
`https_web` with a public-CA cert or `https_spiffe`, where the endpoint presents its
own X.509-SVID, so the issuer would have to mint X.509-SVIDs too rather than only
the JWT-SVIDs this design is scoped around. The doc picks no profile. Federation is
also bilateral registration, not discovery. And the costs section asks "whether the
JWKS endpoint needs its own SLO" two sections later.

"Rotate at half-life" doesn't apply to JWT-SVIDs. From `spire_agent.md`:
`availability_target` "only affects the agent SVIDs and workload X509-SVIDs, but not
JWT-SVIDs". Those are minted fresh per request.

Delete the deployed-STS aside. Of AWS, Azure and GCP SA impersonation, only Google's
STS is an actual 8693 endpoint, and none of the three emits nested `act` chains, so
they can't evidence how deployed systems evaluate such chains. The §4.1 MUST carries
the point alone.

Smaller: `may_act` §4.4 is about who may *act for* a subject rather than "delegate
for" it, and covers impersonation too; §1.1 doesn't mention `sub` (that's §4.1
Figure 5 and Appendix A.2.5); Txn-Token `§14.11.1` was renumbered to §13.14 in -09;
the §3.4.11 arrow chain is a fair paraphrase but reads as a quote.

Two I checked and found sound. The informational-only MUST is quoted accurately with
an honest ellipsis, though restoring the dropped "For the purpose of applying access
control policy" preamble would stop a reader thinking 8693 forbids any use of nested
`act`. And the no-structural-enforcement claim is right and stronger than stated:
§5's "the use of the `scope` claim … is suggested" is exactly where the RFC declines
to make attenuation an invariant.

Also: Q3 and Q4 contradict each other. "Projection, not authority" declares the SVID
a projection of settled internal machinery, which can't also be an open design
frontier. Q3 has the argument behind it.

And the Zhu dismissal doesn't apply. Both IETF approaches are dismissed because they
"assume the token holder persists", but nothing here holds a token either, since the
harness re-mints from Redis. Stripped of the label, the mechanism is short TTL plus
re-derive from durable state, which is what Zhu describes.

## C4 · Add a "what breaks today" section

The doc says nothing is implemented and never states the current position, which
matters because it changes what the design has to defend.

`Service.ListSessions` returns every stored session with a `Title` derived from that
session's first user prompt, clamped to 120 runes: inventory and prompt content, no
id needed. On Redis it takes the slow path, since `redisstore` implements
`PrunableStore` but not `MetaLister`, so it also loads every session per request.

`GET /v1/sessions/{id}/events` deliberately relays `EvUserPrompt` and
`EvCompactionArchive`: every prompt verbatim plus entire pre-compaction
conversations. The handler comment explains why and ends "Do NOT copy the live-relay
filter here", which is right for a single-user harness and exactly the assumption
that breaks on a shared store.

Framing that keeps it fair: mecatl has no tenants today, since one shared operator
token means one principal, so this is cross-session context isolation rather than a
cross-tenant vulnerability. A missing session owner is also the harness-tier norm.
Claude Code's `listSessions(projectKey)` takes no principal, Codex's `get_threads`
returns `first_user_message`, LangGraph OSS's `alist` has no owner filter. Every
system that enforces a check is a multi-tenant server product: Google ADK's primary
key is `(app_name, user_id, session_id)` and `list_sessions` can't be called without
a `user_id`. ADR 0048's shared Redis moved us into the second category while the code
stayed in the first.

The lesson from ADK: put the principal in the signature, so enumeration is scoped by
construction. A get-by-id-only fix leaves `ListSessions` open.

Also worth stealing from Entra: it hard-blocks specific permissions from ever being
granted to an agent identity, even by an admin who wants to. That's a ceiling
independent of any issuer's correctness, which is stronger than narrowing at the
issuer and trusting the issuer.

And split the unattended-trigger gap from the parking gap. Sweeney covers async
consent, where a human approves out of band, so "no synchronous caller" is covered
elsewhere. What nobody covers is firing repeatedly on a timer against an
already-granted authority with no human at all, which is the Schedule/Fire shape.
Two contributions; the doc claims one.

---

## Two separate issues, not comments on this PR

Both surfaced only because this doc forced the trust-boundary question, which is a
point in its favour.

1. `Schedule create` accepts an arbitrary workspace path, validated for
   non-emptiness only, no allowlist anywhere, and the fire runs unattended. Details
   in B6.
2. `envscrub` only scrubs the child shell's environment. Every mention in the repo
   names the threat as `cat /proc/self/environ`, and `self` is the scrubbed shell.
   The harness process's `/proc/<pid>/environ` is same-uid readable from that shell
   and isn't scrubbed.

## Route one idea elsewhere

Sweeney's Delegation Server keeps the real external credential in a vault and makes
the downstream call itself, so the agent process never sees the secret. Stronger
boundary than this doc's, but it's external secret custody rather than internal
identity, and it's the missing piece for hop 7. Belongs in
`docs/scoped-resource-grants.md`.
