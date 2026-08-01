# Agent and sub-agent identity

*Status: strawman / working draft. Speculative scoping, not a design record under
[ADR 0002](adr/0002-documentation-lifecycle.md) (no frozen decision here). Same
tier as [`docs/scoped-resource-grants.md`](scoped-resource-grants.md) and
[`docs/cloud-native-harness-kit.md`](cloud-native-harness-kit.md). If this
direction is ever committed, it becomes one or more ADRs and this doc gets
superseded.*

This doc is about recording *who* a session and a sub-agent act for, and making
that survive a restart. It is written to be concrete enough to argue with.
Almost none of it is implemented, and one part of it is a bug rather than a
design choice.

## The short version

mecatl does not record who a session belongs to, and two things follow from that.

A sub-agent can read another user's conversation. Sessions are stored under
predictable ids like `team-<teamID>-<member>`, and the tools that load a session
by id never check who owns it, so knowing the id is enough. On a shared store
that is a cross-tenant read. This one is a bug, and it can be fixed on its own:
add an owner field to the session and compare it against the caller in the four
places that load by id. No keys, no tokens, no dependency on the rest of this
doc.

A resumed sub-agent cannot show it is a continuation of anything. When one
process dies and another picks the session up, everything the resumed work knows
about who it acts for came out of storage, so whatever can write that storage
decides who the work is done by. The fix is to write a signed record when the
sub-agent is spawned, saying which user it acts for and what it was allowed to
do, and to check that record on resume instead of trusting a familiar id.

The rest of the doc follows from those two. SPIFFE identifies the mecatl process,
not the agents inside it. Narrowing a sub-agent's authority when it is spawned is
already solved, with five existing implementations to copy rather than a sixth to
design. Human identity stays in the OAuth layer and never becomes a workload
credential.

## The problem

mecatl does not record who a session belongs to. `session.Session` has no owner
field. Tool calls carry no user. The permission rules decide what a sub-agent may
do without ever asking who it is doing it for. That is a deliberate omission so
far, and mostly fine for a single-user CLI, but it has two consequences that stop
being fine as soon as more than one person shares a deployment.

The first is that an outbound tool call cannot say whose behalf it is made on.
The second is that a resumed sub-agent cannot show it is a continuation of
anything.

## What we would build

Four changes. The first works on its own; the rest only matter once mecatl runs
somewhere with a real trust boundary.

Add a field to `session.Session` holding the user the session belongs to. Set it
when the session is created, and pass it to sub-agent sessions when they are
spawned. Then, in the four places that load a session by its id, compare that
field against the caller before returning the conversation. That is one field and
four comparisons, with no keys or tokens involved. It also fixes the bug: today a
sub-agent can read another user's conversation by guessing its id.

Keep three kinds of identity separate. Who is acting, meaning a user plus the
chain of agents acting for them, belongs in an OAuth token. Which process is
running belongs in a SPIFFE credential, and that credential identifies the mecatl
process rather than the agents inside it. The user's own Slack or GitHub token is
the only one of the three that leaves our trust domain. Three separate sources
argue against merging them (see prior art).

Identify the sub-agent run that is currently executing. It has a start and an
end, so it can be identified the same way a process can. A session sitting
dormant in Redis cannot be, but it also has no need to be, because nothing is
executing that would use a credential. The session id becomes a stable name, and
the running work is what actually gets vouched for.

When a sub-agent is spawned, write a small signed record next to its session
saying which user it acts for, what authority it was given, and who its parent
was. On resume, check that record. Do not infer any of it from a familiar session
id showing up again.

## Two things that go wrong today

### A sub-agent reads someone else's transcript

Team member sessions are stored under `team-<teamID>-<member>`
(`engine/agent/teamsupervisor.go` (`MemberSessionID`)). The id is predictable on
purpose: the supervisor that saves the session and the tool that reads it back
have to agree on the key. `InspectMember` builds that key out of the `team_id`
and `member` strings the model supplied, and loads it
(`engine/agent/teaminspect.go`).

Nothing checks ownership. Knowing the id is enough to get the conversation.
`InspectSubagent` does have a gate (`engine/agent/subagentinspect.go`), but it
only checks that the id starts with `subagent-` or `parallel-`
(`engine/agent/childregistry.go`). Its own comment explains why: to stop the tool
turning into a read of the whole store. That check keeps a sub-agent out of main
sessions. It does nothing about another tenant's sub-agent.

The Redis store from [ADR 0048](adr/0048-mecak8s.md) is one keyspace shared by
everyone in the deployment. A sub-agent that has been prompt-injected into
guessing a team id gets a conversation it should not see.

The predictable id is not the problem. Using an id as proof of entitlement is the
problem. An id is fine as a lookup key; it is not a credential, and no choice of
authorization language changes that.

### A resumed sub-agent makes an outbound call

This is the case worth designing against, because it hits both problems at once,
and there is already a test that walks the path (`TestApproveAfterRestartE2E`).

A sub-agent stops on a permission prompt. The process dies. A new process picks
up at the prompt through the awaiting-approval entry point ([ADR
0027](adr/0027-cloud-native.md) Phase 2), a human approves, and the tool call
goes out.

Everything that call knows about who it acts for came out of storage. The
goroutine that was the sub-agent is gone. Under `cmd/mecak8s` there is not even a
long-lived local process to ask, because state lives in Redis and the Kubernetes
API server by design. Whatever can write that stored record decides who the call
is made by.

## How it fits together

```
SPIFFE ──identifies──▶ the mecatl PROCESS   (k8s_psat in-pod, join_token elsewhere)
                          │
                          │  …which issues identities for:
                          ▼
 human ──▶ main session ──spawn──▶ sub-agent run ──tool call──▶ gateway ──▶ SaaS
  OAuth      [owner]        ①      [owner,            ②            ③
  token                            act += child]
                 │                       │
                 └──── stored: ──────────┘
                       stable id + SIGNED RECORD
                              ▲
                              ④  resume: identify the new run,
                                 then check the stored record
```

What travels over each hop:

| hop | carries | leaves our trust domain? |
|---|---|---|
| human to harness | the user's OAuth token | it arrives here |
| session to sub-agent (①) | the owner, and a narrowed chain of who is acting | no |
| sub-agent to tool call (②) | that chain, as input to the permission decision | no |
| any process to any process | the SPIFFE credential for the process | no |
| gateway to SaaS (③) | the user's stored SaaS token, a different token | yes |
| resume (④) | a fresh identity for the new run, plus the stored record | no |

The agent's identity never reaches the SaaS. The far side sees an ordinary OAuth
request from the user, and which agent made it lives only in our audit log.
Atrium's research note reaches the same conclusion, and this doc does not
reopen it.

## Recording who owns a session

`session.Session` already has three fields shaped exactly like this one:
`Profile`, `ProviderID`, and `ModelID` in `engine/session/session.go`. Each is
documented as something the domain stores and never interprets, written once by
the composition root after `New`, with no setter. A fourth one:

```go
// Subject is the opaque principal this session belongs to. Same inert-label
// posture as Profile/ProviderID/ModelID: stored, never interpreted.
Subject string
```

It gets persisted the same way, as an `omitempty` key in
`engine/adapter/sessnap/sessnap.go`, so an older snapshot decodes to the empty
string and no format-tag bump is needed. Standalone mecatl leaves it empty. A
host that has real users writes its own chain into it.

Getting the caller's own value to the check needs no new plumbing. The dispatcher
already builds `parentCaps` once per run over the parent session, which is how
`forkHistory` reaches the Subagent tool. If the owner is on the session, the
resume and inspect tools can read it the same way.

Widening `port.SessionStore.Load` (`engine/port/store.go`) to take a caller would
be the wrong fix. It would break every store adapter and the conformance suites,
for a check that belongs above the store rather than inside it.

Adding an exported field to a core type trips the api-compat gate
([ADR 0037](adr/0037-engine-stability-contract.md)), so this needs
`task api:update` and a CHANGELOG entry classified Added.

## Identifying a running sub-agent

SPIRE already draws this line, and we can copy it. Its Kubernetes workload
attestor marks `k8s:pod-uid` and `k8s:pod-name` as volatile and tells operators
not to use them in registration entries, because they change every time a pod
restarts. Data about one particular instance belongs in a selector, which is
evidence used to decide an identity and then discarded. The identity itself is
built from things that outlive the instance.

The same split here:

- The currently-running sub-agent drive is the selector. It has a real start and
  a real end, and it is gone when the run finishes.
- The session id is what the identity is named after.
- A dormant session gets no credential, because nothing is running that could
  present one.

That last point is what makes the rest tractable. The situation that genuinely
cannot be vouched for, a stored record with nothing behind it, is also the
situation where no credential is needed.

How the identity was arrived at goes in a selector too, something like
`mecatl:vouch-basis:<basis>`. Selectors are the conventional place for
"how do we know this", which keeps the identity path a plain stable name instead
of a flag about how much to trust it.

## Proving a resumed sub-agent is the same one

At spawn, write a signed record alongside the session:

```yaml
# shape illustrative, not a wire format
continuity_record:
  workload: "…/session/<sessionID>/subagent/<childID>"
  subject: "user:joe"                  # who it acts for
  act: ["agent:code-reviewer"]         # the chain, narrowed at each spawn
  authority_digest: "sha256:…"         # what it was allowed to do, as resolved at spawn
  parent: "…/session/<sessionID>"
  spawned_at: "2026-07-29T10:00:00Z"
  signature: "<over the above, by the issuer's key>"
```

On resume, identify the new run normally, then check this record separately. Two
mechanisms that stay apart.

This is not a SPIRE registration entry, and the difference matters. A
registration entry is a rule written in advance: anything showing up with these
selectors gets this identity. When a pod crashes and a replacement starts, the
replacement inherits nothing from its predecessor. It qualifies on its own
current attributes. That is a rule being applied again, not a history being
carried forward, and it is why SPIFFE never needed a mechanism for continuity: no
individual pod's past has to outlive it.

Our record says something else. It is a fact about one particular earlier run.
There is no SPIFFE equivalent, and the risk that creates is worth writing down:
if any code treats a familiar session id reappearing as reason to believe the
authority is still granted, that conclusion is unsupported. Attestation does not
imply it and no convention licenses it.

An in-process sub-agent cannot really sign for itself, because a goroutine has no
key its parent cannot read. Signing with the harness key gets something narrower
but still useful: the record is fixed when the sub-agent is created, so nobody
can write a record afterwards claiming authority the harness never gave. That
closes off forging records. It does not make the sub-agent able to vouch for
itself. A sub-agent in its own process can sign for itself and gets the stronger
property. A direct-write sub-agent
([ADR 0041](adr/0041-direct-write-subagent.md)) has no boundary between it and
the parent at all, so it should just use the parent's identity; a separate record
would claim isolation that is not there.

`authority_digest` is there because agent definitions can change. A project-tier
definition is read from the workspace, and the workspace is mutable, so a
sub-agent resumed three days later might resolve to a different tool catalog or
model than it had at spawn. Recording a digest means that shows up as a mismatch
instead of going unnoticed.

## Narrowing authority when spawning

Authority narrows at the issuer, never widens, and the issuer keeps the tree of
who delegated to whom so that refusing to renew a parent also cuts off its
children. This is the same mechanism
[`docs/scoped-resource-grants.md`](scoped-resource-grants.md) already specifies,
and nothing here changes it. Integrating the two amounts to that doc's grant
envelope gaining a subject and an acting-chain next to the audience and scope it
already has.

Two notes on building it. If a sub-agent's grant is a finite list of
resource-and-action pairs, which is the usual case, checking that it is a subset
of the parent's needs no special machinery: evaluate each pair against the
parent's policy and require them all to pass. Only open-ended conditions like
"any resource where tenant is X" bring back the harder problem of comparing two
policies in general. Parameterized policy templates avoid the comparison
entirely, by making a child's policy narrower by construction, at the cost of
child grants only coming in template shapes.

## Checking permission in two places

These are different kinds of check and should not be confused.

Ownership gets checked on every load by id. Compare the loaded session's owner
against the caller. There are four places:

- `engine/agent/teaminspect.go`, for `InspectMember`
- `engine/agent/subagentinspect.go`, for `InspectSubagent`
- `engine/agent/subagent.go` (`resolveResumeSession`), for the `resume:` path
- `internal/adapter/server/service.go` (`loadAndReopen`), the wire-side entry
  point

A mismatch has to return the existing not-found message word for word. A separate
"forbidden" reply would let a caller tell the difference between a session that
does not exist and one it may not read.

Authorization on a tool call is an ordinary point check: one principal, one
action, one resource. A turn that fans out several tool calls can batch them,
sharing the subject and context and varying only the resource and action, with an
independent answer for each. The chain of who is acting for whom travels as data
that has already been verified elsewhere. The standard authorization model
assumes the enforcement point is trustworthy and gives no way to check the
attributes it supplies, so the chain is only as good as the identity layer that
produced it. Policy cannot repair an unverified chain, and no choice of which
field to put it in makes it more trustworthy.

## What this changes in mecatl

One of these is a bug. The rest were deliberate decisions, and a real design doc
for this direction would supersede them with a new ADR rather than editing them
quietly.

- **A session id stops being enough to read a session.** This is the bug.
  `engine/agent/teaminspect.go`, `engine/agent/subagentinspect.go`, and
  `engine/agent/subagent.go` (`resolveResumeSession`) currently hand back a
  transcript to anything that can name one. The prefix check in
  `engine/agent/subagentinspect.go` was never meant to be an ownership check.
- **`session.Session` gets a fourth stored-but-uninterpreted field.** Additive
  and precedented, but it grows the exported surface and the api-compat
  baseline.
- **`MemberSessionID` needs namespacing.** `team-<teamID>-<member>`
  (`engine/agent/teamsupervisor.go`) can collide between two tenants in a shared
  store. That is a different problem from the read hole: it overwrites data
  rather than leaking it, and the fix is either a subject-namespaced id or a
  partitioned store.
- **Two unrelated fields now survive `resetToIdle` for different reasons.**
  `Usage` is preserved so the token budget carries across a reopen. The owner has
  to be preserved because it is identity, which is a different reason, and the
  comment there should say so.
- **The stored snapshot becomes security-relevant.** Today
  `engine/adapter/sessnap/sessnap.go` writes ordinary state. Under this design it
  writes a signed record, which makes integrity at rest and write access
  requirements rather than good practice.

Unchanged: the layering rule (an owner string is domain-neutral, and the check
goes where the store access already is), `port.LLMRequest` neutrality, the
no-stdio-MCP rule, and deny-dominance in permissions. Identity is a separate
axis. `governance.Audience` still decides what a sub-agent may do.

## Security model

**What we trust.** The harness and whatever issues identities, which in a first
cut are the same process. The model's tool calls stay untrusted input, as they
are now. The store joins the trusted set the moment an identity decision reads
from it, which it does not today.

**Where enforcement happens.** For ownership, at the load, per access, against
the caller. For authority, against the signed record, checked again on every
decision.

**Confused deputy.** Partly closed. A sub-agent works from an owner and a chain
handed to it rather than from open access to the store, so a prompt-injected
sub-agent can no longer reach a transcript by naming it. It does not help when
the authority the sub-agent legitimately holds is the thing being misused; that
stays the permission rules' job.

**What remains risky.**

- A sub-agent sharing the parent's memory can read anything the parent holds.
  Signing stops records being forged, not secrets being read. Only a process
  boundary changes that.
- The component that writes the records is the component that checks them. That
  is weaker than a boundary checking records written elsewhere, and no
  authorization standard treats the two differently, so nothing external will
  flag it for us.
- Treating a reappearing session id as proof of authority. Named above; the
  defence is a test, not a mechanism.
- Definition drift across a resume. `authority_digest` makes it visible. It does
  not decide what to do about it.
- Any expiry on the stored record interacts badly with sessions designed to
  resume days later. Whatever the freshness rule is, it needs a stated tolerance
  rather than a default.

## What other people have built

*From a research pass in July 2026 using four domain specialists over primary
sources. The summary this work started from turned out to be unreliable, so every
claim below traces to a fetched source. Nobody was found to have built this
combination, several parts are more settled than we expected, and two of our own
early claims were wrong.*

**Narrowing at issuance is settled.** Five independent designs landed on the
same mechanism, where the issuer computes the narrower grant and refuses to
widen: the control-plane method in
[`docs/scoped-resource-grants.md`](scoped-resource-grants.md); Atrium's
single-issuer token exchange;
[Highflame ZeroID](https://github.com/highflame-ai/zeroid), Apache-2.0 from April
2026, which puts an RFC 8693 acting-chain and a scope in one token and computes
the intersection at exchange time, using SPIFFE-shaped URIs rather than real
SVIDs; the Mandate Evaluator in Clawdrey Hepburn's
[OVID](https://clawdrey.com/blog/), where minting only succeeds if containment
holds; and `draft-sweeney-wimse-credential-delegation-00` from 27 July 2026,
whose Delegation Server must check that a sub-delegation's capabilities are a
strict subset of the parent's. Adopt one of these rather than deriving a sixth.

**Keeping workload identity and human identity apart has three independent
endorsements.** `draft-ietf-wimse-arch-08` §3.4.7 treats the human as context a
workload carries, with "acting for a user" on a separate token, and a workload
credential has no slot for a person by design.
[`spiffe/spire-identity-exchange`](https://github.com/spiffe/spire-identity-exchange)
arrives at nearly the same rule on its own: claims encoded into an identity must
be controlled by the workload or its infrastructure owner, "not by a human
actor". SPIRE's registration entries enforce it structurally. ZeroID putting both
in one JWT is the outlier.

**Vouching for a host no platform can attest has a shipped precedent.** SPIRE's
`join_token` node attestor exists for exactly that case. It is an operator
asserting an identity with no independent signal behind it, and it ships as a
first-class plugin alongside the cloud and Kubernetes attestors. It is the
precedent for an identity that is asserted rather than attested and honest about
which it is.

**Two claims of ours that were wrong.** WIMSE already covers the kind of
principal we have: `arch-08` §2 defines a workload as "a logical entity rather
than necessarily a single running process", separate from a workload *instance*,
and its short credential lifetimes mean surviving a restart with one key was
never the intent. More importantly, we first read the SPIFFE Broker API's
workload-lifecycle requirement as making a suspend-and-resume principal
impossible. That only holds if the reference points at the stored record.
Pointing it at the currently-running drive satisfies the requirement, and the
stored id becomes an implementation-defined name. The reframing is what the
running-work section above is built on.

**The Broker API's wire format is still the wrong thing to copy.** Custom
reference types are explicitly allowed (§2 and §3.1.4, packed into the `Any`
field with a documented type name and no central registry), and SPIRE shipped the
endpoint in 1.15.2 behind an experimental flag. But its central requirement is
that a server must not trust reference data from a client without verifying it
independently, and that exists to stop a less trusted broker telling a more
trusted server what is true. With one process on both sides, the requirement can
be satisfied on paper and means nothing. The half we cannot use is the half that
does the work. The SVID-delivery messages are a plain schema we could borrow for
familiarity, but calling the result a broker would mislead anyone who knows the
spec. One small confirmation that a dormant state was never considered: the error
codes cover invalid, not-found, and not-entitled, with nothing for a reference
that exists but is not currently running.

**Where the actual gap is.** RFC 9334 does not require evidence to be live. The
§4.2 definition has no liveness condition, and §10.4 explicitly allows claims
saved to storage until connectivity returns, with freshness left to the verifier's
policy. But that allowance covers one entity producing, signing, and later
presenting its own claims. Ours is a different entity presenting claims about a
dead one, from custody of a file, and none of the architecture's roles covers
that. Which gives the useful version: an unsigned session record is not evidence
in any sense yet, and signing something at spawn is what brings it inside the
existing model. Each nearby community has a blind spot that meets here. Workload
identity assumes something is running. Attestation assumes hardware that survives
a restart. Delegation chains assume a live request. No prior art turned up on any
of their mailing lists.

**What is not prior art.** `spire-identity-exchange` cannot help with human
tokens. Its validator interface only validates a presented credential and emits
selectors for matching, with no way to assert an identity, nothing from the
presented token reaches the issued credential beyond pass or fail, and the
project says not to use it in production. It is a plausible fit for attesting a
harness running in CI, since `cmd/mecatequi` already holds a GitHub Actions OIDC
token, but that is blocked on the project's maturity rather than its design.
`draft-schwenkschuster-wimse-credential-exchange` is expired and shelved for lack
of working-group interest, with a stub security section. OVID, the closest
published work, is built for delegations short enough that resuming never comes
up, with minute-scale tokens that expire when a task finishes, and it does not
discuss the in-process boundary even though its evaluator runs inside the agent's
own process.

## Out of scope

- **Sessions as a grant resource type.** The rule of two in
  [`docs/scoped-resource-grants.md`](scoped-resource-grants.md) holds. Session
  ownership is a control-plane check, not a data plane with bytes and caching
  postures. An owner field and a check at the load is the whole mechanism.
- **Two accountable humans in one flow.** A customer and the employee helping
  them, plus an agent chain. Every format we surveyed has one subject with a
  list of actors hanging off it, and nothing at draft level addresses two. Out of
  scope until somebody actually needs it.
- **Federation across trust domains.** The endgame. The only obligation on a
  first cut is not painting the record shape into a single-issuer corner.
- **Picking an acting-chain wire format.** Two competing individual drafts cover
  enforced narrowing, one OAuth-flavoured and one WIMSE-flavoured, neither
  adopted. Borrow the ideas and leave the format alone.
- **Revocation machinery.** Short lifetimes and a renewal path, as in the grants
  doc.
- **Telling the model about any of this.** Identity is harness machinery. No
  prompt-layer surface, no tool, nothing the model can reason about or be
  injected into.

## Open questions

- **Who signs, and with what key.** An in-process issuer using the harness key
  is the obvious start, but custody, rotation, and whether the signer is also the
  checker are all open. The grants doc's point applies: if the issuer also
  verifies, the key never leaves, and what is left is keeping it consistent
  across replicas.
- **What `authority_digest` covers.** The resolved definition, the tool catalog,
  the model, the limits, the permission audience, or some subset. Too broad and
  any harmless config change breaks resumption. Too narrow and drift slips past.
- **How long a stored record stays good.** Sessions are meant to resume days
  later, so a short window is wrong, and never expiring is also wrong. Whether
  the answer differs per isolation tier is undecided.
- **Whether a sub-agent's entry in the chain is a type or an instance.** A
  definition name like `code-reviewer` is simpler and probably right at first.
  Per-version entries let you revoke one bad definition, at the cost of a
  migration later.
- **What a forked sub-agent is.** Its history is a copy of the parent's
  (`engine/agent/subagent.go`). Same principal, or a derived entry in the chain?
  The answer changes what a verifier may conclude, so decide it before anything
  depends on it.
- **Whether the event log needs the same check.** `port.EventLog`
  (`engine/port/eventlog.go`) also reads by session id, and the approval-replay
  consumer (`internal/app/approvalreplay.go`) reads it at the run-entry funnel.
  Whether that path needs its own check or inherits one needs tracing.
- **Namespaced ids or a per-tenant store.** The `MemberSessionID` collision has
  two fixes. Partitioning is cleaner and more disruptive.
- **What the vouch-basis values are.** `mecatl:vouch-basis:<basis>` needs a
  closed set, and they should line up with the isolation tiers rather than being
  invented per deployment.

## A spike to de-risk it

The smallest thing that shows whether this works, and deliberately not phase one:

1. The owner field on the aggregate and the snapshot, written by composition,
   with the check at all four load sites and a test per site showing that loading
   another owner's session is indistinguishable from a miss.
2. A stub issuer that signs a record at spawn and checks it at resume, with a
   stub key. Real key management explicitly excluded.
3. One end-to-end run of the restart case: stop on a permission prompt, kill the
   process, resume in a new one, and have the outbound call carry a checked
   record.
4. A mutation test showing the record is load-bearing. Tamper with the stored
   owner or the authority digest and the resume must refuse.
5. A test showing a familiar id grants nothing on its own: a valid identity with
   a missing or invalid record has to fail closed.

It works if the transcript-reading hole is closed, the restart case resumes with
a checked record, and step 5 fails for the right reason. Not in the spike: real
keys, SPIFFE process attestation, narrowing at spawn, and any grant integration.

## Related docs

- [`docs/scoped-resource-grants.md`](scoped-resource-grants.md) is the grant
  substrate this would give a subject to. Its envelope has an audience and a
  scope and no principal, so the acting-chain is the missing field, and its
  narrowing method is what this doc adopts instead of reinventing.
- [`docs/cloud-native-harness-systems.md`](cloud-native-harness-systems.md) and
  [`docs/cloud-native-harness-kit.md`](cloud-native-harness-kit.md) are the
  scoping and kit framing this fits into.
- [ADR 0027](adr/0027-cloud-native.md) is the restart-survival arc. The restart
  case above is its Phase 2 entry point, and its resource-inventory rule applies
  to anything long-lived this adds.
- [ADR 0038](adr/0038-event-sourced-rehydration.md) is the reconstruction
  contract a folded session has to satisfy, which an owner field would join.
- [ADR 0048](adr/0048-mecak8s.md) is the storage-free deployment with no durable
  local process to bind an identity to, which is what raises the question.
- [ADR 0041](adr/0041-direct-write-subagent.md) and
  [ADR 0058](adr/0058-writable-named-specialist-subagent.md) are the tiers with
  no boundary, where a separate identity record would overstate the isolation.
- [ADR 0044](adr/0044-host-supplied-askid-discriminator.md) is the existing
  precedent for a host-supplied identifier that can be rebuilt in another
  process.
