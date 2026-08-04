# Agent identity: what to file

*Status: proposal, not filed. The filing plan for the work described in
[`docs/agent-identity-model.md`](agent-identity-model.md) (inbound) and
[`docs/agent-identity-outbound.md`](agent-identity-outbound.md) (outbound).*

[`docs/agent-identity-issues.md`](agent-identity-issues.md) is the **long form**: 26 numbered
issues, 208 acceptance criteria, and the reasoning behind each. This file is what we would
actually put in a tracker. It is deliberately short, because an epic nobody reads before starting
the first slice is a doc pretending to be an epic.

Three rules shape it.

**Acceptance criteria are property-level and say what done means.** They are the contract a reviewer
checks against. Implementation detail is left out on purpose — type shapes, package names,
api-baseline line counts are cheap to re-derive and expensive to keep true, and a stale instruction
reads as authoritative.

**Each epic also carries a proof: the same property, adversarially, with an actor and an ordering.**
A property-level criterion alone can go green while being false. "Access is enforced on every
session read" is satisfiable by a check in `acquireLease` — green box, false property. "Bob's
*second* prompt on Alice's session is refused" is not. The properties define the work; the proofs
stop it passing for the wrong reason.

**Hazards are separate from both.** A hazard is a fact that was expensive to discover and that
nobody re-derives on the way to implementing. It changes how someone designs, so it is prose at the
top of the epic, not a checkbox. Every hazard below is verified against code; the long form carries
the citations.

---

## Eleven things to file

Seven behaviour epics, three standalone, one tracker.

### EP1 · A caller has an identity, and objects have owners

*mecatl. First — nothing else starts without it.*

Every session and schedule records who owns it. A deployment with no verifier wired behaves
exactly as today, to the byte.

**Hazards.**
- `SecurityConfig.authEnabled()` is the wrong disable predicate. It means "a static shared token is
  configured", which is wrong in both directions: a shared-token deployment has one credential and
  *zero* subjects, an OIDC deployment may have subjects and no static token.
- The module boundary does **not** protect the ctx accessor. It stops `engine/`; the risk is
  intra-package, where ~60 `Service` methods already take `ctx` first. Depguard cannot express that.
- `ScheduleSpec.OriginSessionID` outlives the session it names, because `childgc` sweeps top-level
  sessions on retention. Capture the owner where the origin is already loaded at create.
- A fork must inherit the **source's** owner. Stamping the forking caller's own makes fork an
  ownership-laundering path.
- Anonymous means a nil caller and a zero owner, never a fabricated one. The sibling project mints
  `sub: "anonymous"` with forged `exp`/`iat`/`nbf`, and that string then appears in audit records
  and an external webhook payload looking like a real user.

**Acceptance criteria.**
- Exactly one place parses an inbound credential, and one credential-free type crosses into the
  service layer. Nothing downstream re-parses a token.
- The owner survives every persistence and rehydration path: the snapshot, the event-sourced fold,
  and the fast list path. A path that misses it yields a silent zero, so all three are enumerated.
- Identity is either derived from a verified credential or absent. There is no third state, and the
  server never invents a principal to fill the gap.
- No credential, expiry or refresh token is persisted, logged, or placed on a durable type.
- With no verifier configured, behaviour and stored bytes are unchanged from today.
- An object created before this shipped has one defined answer, applied identically everywhere.

**Proof.**
- Alice creates a session; the store, the event log and the list row all name her, and still do
  after reopen, interrupt, recover, a pod migration and a fork.
- A 3am schedule fires naming its creator, across a restart and a leadership change.
- A developer runs mecatui locally with no token: no principal is invented, and the log says
  unauthenticated rather than naming a user who does not exist.
- A session persisted before this shipped is refused, not adopted by whoever touches it first.

**Inside.** Verify an inbound token and derive a principal · the identity type and how it travels ·
the schedule owner, captured at create.

### EP2 · One caller cannot reach another's work

*mecatl. After EP1.*

Bob is refused on Alice's sessions, events, memory and live runs.

**Hazards.**
- `acquireLease` cannot hold the check: it returns early on a nil lease (**the default in both
  binaries**), again on a sticky `leaseDisabled` any storage backend can set, and again on
  `heldLeases`, which is session-scoped for the session's life by design. The check would fire on
  the first run-entry only.
- The live-run verbs touch no store, so no store decorator sees them: `ApproveRun`'s lock-free fast
  path, `Cancel`, `CancelChild`, `SetMode`, `ApprovePlan`, `Persist`.
- `engine/agent` reads the shared store from **model-facing** tools, gated by an id-prefix family
  check rather than ownership, over ids that are *derived* rather than secret.
- `StreamSessionEvents` returns the log for any id the caller names, and deliberately relays
  `EvUserPrompt` and `EvApproval` in full.
- `childgc` and both memory consolidators run on goroutines with no caller. They break silently the
  day a check lands unless they get an explicit system principal.

**Acceptance criteria.**
- One decision function governs every owned kind — sessions, schedules, teams, memory — with a
  per-kind interpretation table rather than a second mechanism per subsystem.
- It is enforced where the object is touched, so a caller reaching an object through a port
  directly, or through the model's own tools, is governed by the same code as one arriving at the
  API.
- The check runs per request. Not once per session, not once per process, and never conditional on
  an optional backend being configured.
- A refusal is indistinguishable from the object not existing.
- Listing returns the caller's own objects and no others — both halves tested, so "return nothing"
  cannot pass.
- Adding a method that touches an owned object fails the build or the test suite until it is
  classified as governed or explicitly exempt.
- Actors with no caller run under an explicit system principal, never under an absent one.
- It stays orthogonal to the model-facing posture ladder, so no posture setting can disable it.

**Proof.**
- Bob lists sessions and sees only his. Alice still sees hers.
- Bob prompts Alice's session **twice**; both are refused.
- Bob asks for Alice's events by id and cannot tell refusal from not-found.
- Bob approves a tool call on Alice's *live* run, cancels it, and flips her mode: all three refused.
  All three succeed today.
- A prompt-injected agent handed another tenant's subagent id gets a refusal, not the transcript.
- A developer widens a store port, forgets to classify the method, and the build fails.

**Inside.** The one shared check, called from the store boundary · the five paths that do not go
through it.

### EP3 · Sensitivity is a label that survives delegation

*mecatl. After EP1.*

A labelled session's children carry the label, and the four labels that exist today stop silently
dropping.

**Hazards.**
- The label mechanism already exists and already fails open: `Profile`, `ProviderID`, `ModelID` and
  `ReasoningEffort` propagate on `ForkSession` and on no other child-mint path, of which there are
  eight in `engine/agent`.
- A label is **mecatl's own vocabulary**, not a set of IdP group names. The sibling's normalised
  `Groups` field is dead — never populated, never read — because group claim names vary by provider.
  Persisting them freezes at create time, so revoking a group leaves old sessions readable.
- The model must not author the rationale a human reads when approving a release. That is
  justification capture, and the repo already solves the shape once in the ask-reviewer discipline.

**Acceptance criteria.**
- Every object-creation path stamps the label. One propagation path, and a test that enumerates all
  of them rather than sampling.
- The durable label is mecatl's own closed vocabulary. Provider claim names appear in exactly one
  config table and nowhere downstream.
- The caller's labels are computed per request and never persisted, so revocation takes effect
  without rewriting stored objects.
- Access is a set-dominance check with no sensitivity ladder and no policy engine.
- The model can neither lower a label nor author the text a human relies on when releasing
  something, and a test proves the instruction saying so reaches the system prompt.

**Proof.**
- A labelled session spawns a subagent, a parallel branch and a team member; each carries the label.
- A caller whose live labels do not dominate the session's is refused.
- Revoking a caller's group takes effect on the next request, with no store rewrite.
- The model attempts to lower a label and to write its own release justification; both refused.

**Inside.** The label itself, propagated at every creation seam · the transitions that are not
session creation.

### EP4 · Work can be shared deliberately

*mecatl. Needs EP2 and EP3 both — this is the last one.*

Alice adds Bob as an observer, then hands off.

**Hazards.** Per-item read control inside a session is defeated three ways, each silently: the
model can include the content in an answer, the agent re-derives it under a new prompter
unlabelled, and compaction folds the label away. The primitive for mixed sensitivity is a
separate derived artifact — a fork — which is the tearline pattern every document vendor
converged on independently.

**Acceptance criteria.**
- Sharing is an explicit recorded act with a named author. Access is never inferred from activity.
- Read and prompt are separate grants, so an observer is a first-class state rather than a weakened
  owner.
- Only a principal who already holds the object can extend access to it.
- Mixed sensitivity is handled by deriving a new object, and the doc says why per-item fields are
  not offered.

**Proof.**
- Alice adds Bob as an observer: he reads, and cannot prompt.
- Alice hands off: Bob prompts, and Alice's own access follows the recorded decision rather than
  silently vanishing.
- Bob cannot add himself, and cannot add a third party.

**Inside.** Read-only observers first, then explicit handoff.

### EP5 · An agent cannot widen its own authority

*mecatl. After EP1, independent of EP2.*

Spawn narrows, resume never widens.

**Hazards.** Authority is re-derived from the session store on resume, which makes the store the
root of trust — see the store-hardening item below. A project-tier definition taking an operator
definition's name is a privilege swap with no wire involved.

**Acceptance criteria.**
- Authority is a value carried on the run, not a lookup against a mutable source at point of use.
- Every spawn seam intersects. None unions, and none accepts a request to widen.
- Resume re-derives from persisted state and cannot come back wider than what was persisted.
- Definition-name resolution has a fixed precedence in which the operator tier wins, and a
  lower-tier definition cannot occupy a higher-tier name.

**Proof.**
- An injected parent spawns a child asking for more than it holds; the child gets the intersection.
- A resumed child cannot come back wider, including across a restart.
- A project definition cannot claim an operator definition's name.

**Inside.** Authority as a runtime value · narrowing at the three spawn seams · re-derivation on
resume · the definition name collision.

### EP6 · The harness acts for a user against an external system

*mecatl, with deployment work. Blocked — see below.*

The broker holds the key at its own uid; a model-spawned shell cannot reach it.

**Hazards.** The credential read is the thing worth attacking, and the sibling project currently
forwards upstream credential tokens in tool result bodies unchanged (toolhive#5293) — a tool
result body reaches the model.

**Acceptance criteria.**
- The key is held by a process the model's shells cannot reach, demonstrated adversarially rather
  than argued from configuration.
- One credential read per authorized call, keyed on the end user, counted so the count is
  reviewable.
- No credential value enters a tool result, a prompt, an event or a log, at any verbosity.
- The cache survives a restart without re-consenting the user, and an expiry never falls back to a
  broader or service identity.

**Proof.**
- A model-spawned shell under the loosest posture cannot read the key. Written from the attacker's
  side.
- The read counter shows exactly one read per authorized call, and zero on a refused one.
- The broker restarts; the user is not asked to consent again.

**Gated on** the key-reachability spike below, and on three pieces of ToolHive enforcement that
**are not filed** — scope intersection, sender-constrained binding, and an unforgeable resolved
target.

**Inside.** The broker at its own uid with its attestation selectors · mecatl's broker client and
token cache.

### EP7 · A scheduled run acts with bounded, consented authority

*mecatl and ToolHive. After EP1 and EP6.*

3am work carries its creator's owner and a grant that expires with the schedule.

**Hazards.** Never fall back to a service identity when the user's grant expires — that turns an
expiry into an escalation. The model must not be able to author the consent record.

**Acceptance criteria.**
- A schedule carries the authority of its creator, captured when it is created and replayed at every
  fire, with no live lookup that can fail or drift.
- Consent is a signed artifact the model can neither author nor widen.
- The grant's lifetime is bounded by the schedule's, and expiry fails closed with a reason
  distinguishable from a transient error.
- Manual and automatic fires share one path, so neither can carry authority the other cannot.

**Proof.**
- A schedule outliving its grant fails closed and says so, rather than running as the service.
- The model attempts to author or widen the consent envelope; refused.
- A manual fire is bound identically to a tick-driven one.

**Inside.** The two schedule types and the signed consent envelope · the grant's lifetime bound.

### Standalone · Store hardening

*mecatl, deployment work. Unblocked, independent of every epic.*

Redis dials with no auth, no TLS and no keyspace scoping, and `sessnap` is plain JSON with no MAC.
It should land before any multi-tenant deployment, because it absorbs the one property the deferred
SPIFFE issuer was going to provide: an adversary holding a leaked store credential cannot forge a
MAC.

**Acceptance criteria.** Auth, TLS and keyspace scoping supported and used by the shipped manifest ·
a startup warning when a shared store has no auth · a MAC over the snapshot covering the owner and
the label, verified on load · a failure that reads as integrity rather than as transient.

**Proof.** Modify a stored row directly, then resume: refused. An unmodified snapshot still loads.

### Standalone · Spike: can a model-spawned shell reach the key?

*mecatl. Output is a decision, throw the code away.*

Cheap, unblocked, and it gates EP6 — so run it now rather than discovering the answer partway
through EP6.

### Standalone · The escalation proof

*mecatl and ToolHive. File first as the north star, complete last.*

An injected parent asks to act as a write-capable definition, the scope shrinks between two shown
token payloads, the gateway refuses the write, and **the twin** holds: the operator running that
same definition top-level still succeeds. Without the twin you cannot distinguish "escalation
blocked" from "the definition is broken".

One agent proves nothing — a single-agent run never requests a second definition, so the
interesting step never executes and the demo passes whether or not it is guarded.

It follows `test-sidecar-delegation.sh`, which checks real HTTP status codes — **not**
`run-demo.sh` Act 3, whose delegation matrix is a hardcoded `printf`. Decide where it runs:
`task e2e` is live, costs money, and is not part of `task test`, and a proof that is not gated
rots.

### Tracker · The questions nobody owns

Not an epic, and it must not be distributed into the epics or it is lost. The long form's three
non-issue sections: the deferred rows and their triggers, the issuer sequencing, and six open
questions, each blocking work named there.

Two need an answer before anything else moves. **Pick and record the trust-domain name now, mint
nothing** — that is a condition on deferring the issuer, and the deferral is only safe if the name
is fixed. And **whether the driver protocol enforces or is declared trusted** blocks EP2.

---

## ToolHive coverage

Checked against all open and closed issues in `stacklok/toolhive`.

| What we need there | Existing issue | Verdict |
|---|---|---|
| Token exchange lands at all | #5194 | covered |
| Registration says which definitions a client may act as | #6113, #5321, #5359 | **partial** — the definition-allowlist half is absent |
| Requested scope is intersected against the subject token | — | **missing** |
| `act` nests instead of overwriting | #6113; #6035 closed (audit captures the chain) | covered |
| Tokens are sender-constrained end to end | — (#6176 is adjacent, a different bug) | **missing** |
| The resolved target is a value only admission can construct | — (the admission seam itself shipped: #5438, #5430) | **missing** |
| Cedar evaluates the right things, safely | #6081, #6053, #6049, #6048, #5845, #5582 | covered, well |
| The credential read happens behind the gate | #2045, #3877, #3869 | **partial** — the gating half is absent |

Zero SPIFFE or SPIRE issues there on any search term. That is fine — EP6's attestation selectors
are mecatl-side.

**The three missing ones are the enforcement ones.** Intersection, binding and an unforgeable
target are exactly what separates delegation that constrains from attribution that describes.
Without them the chain is a log field.

Two open issues there strengthen this plan rather than duplicating it, and one should worry us:
**#5293**, the proxy forwarding upstream credential tokens in tool result bodies unchanged; and
**#6081**, Cedar taking its principal from an unverified `id_token`, which is the premise of the
whole gate, already broken.

---

## Sequencing

```
EP1 ─┬─→ EP2 ─┬─→ EP4
     │        │
     ├─→ EP3 ─┘
     ├─→ EP5 ─────────────→ the escalation proof
     └─→ EP7 ←── EP6 ←── spike
                  ↑
     the three missing ToolHive pieces  ← file first

store hardening, spike: unblocked, any time
```

EP1 is the only unblocked mecatl epic, and everything waits on its owner field. EP5 branches off
EP1 without needing EP2. EP4 needs both EP2 and EP3.

**The escalation proof cannot be demoed until scope intersection exists in ToolHive**, because the
scope shrinking between two token payloads *is* the intersection. So the first action there is
filing those three — otherwise the mecatl side runs ahead of the thing that proves it works.
