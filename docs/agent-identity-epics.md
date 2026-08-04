# Agent identity: what to file

*Status: proposal, not filed. The filing plan for the work described in
[`docs/agent-identity-model.md`](agent-identity-model.md) (inbound) and
[`docs/agent-identity-outbound.md`](agent-identity-outbound.md) (outbound).*

[`docs/agent-identity-issues.md`](agent-identity-issues.md) is the **long form**: 26 numbered
issues, 208 acceptance criteria, and the reasoning behind each. This file is what we would
actually put in a tracker. It is deliberately short, because an epic nobody reads before starting
the first slice is a doc pretending to be an epic.

Two rules shape it.

**Acceptance criteria state behaviour, adversarially, with an actor and an ordering.** "Access is
enforced on every session read" is satisfiable by a check in `acquireLease` — green box, false
property. "Bob's *second* prompt on Alice's session is refused" is not. Implementation detail
(type shapes, package names, api-baseline line counts) is left out on purpose: it is cheap to
re-derive and expensive to keep true, and a stale instruction reads as authoritative.

**Hazards are separate from criteria.** A hazard is a fact that was expensive to discover and
that nobody re-derives on the way to implementing. It changes how someone designs, so it is prose
at the top of the epic, not a checkbox. Every hazard below is verified against code; the long form
carries the citations.

`[M]` mecatl · `[T]` ToolHive · `[M+T]` both · `[OPS]` deployment · `[S]` spike

---

## Eleven things to file

Seven behaviour epics, three standalone, one tracker.

### EP1 · A caller has an identity, and objects have owners `[M]` `wave 1`

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

**Criteria.**
- Alice creates a session; the store, the event log and the fast list path all name her.
- Alice's session survives reopen, interrupt, recover, a pod migration and a fork, still naming her.
- A 3am schedule fire names its creator, across a restart and a leadership change.
- An operator with no verifier wired upgrades: snapshots are byte-identical and nothing is checked.
- A developer runs mecatui locally with no token: no principal is invented, and the log says
  unauthenticated rather than naming a user who does not exist.
- A session persisted before this shipped is refused rather than adopted by whoever touches it
  first.

**Seams.** A1 verifier · A2 identity type and carriage · A3 schedule owner.

### EP2 · One caller cannot reach another's work `[M]` `wave 2`

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

**Criteria.**
- Bob lists sessions and sees only his. **Twin:** Alice still sees hers.
- Bob prompts Alice's session **twice**; both are refused.
- Bob asks for Alice's events by id and cannot tell refusal from not-found.
- Bob approves a tool call on Alice's *live* run, cancels it, and flips her mode: all three refused.
  All three succeed today.
- A prompt-injected agent handed another tenant's subagent id calls `InspectSubagent` and gets a
  refusal, not the transcript.
- A developer widens a store port, forgets to classify the method, and the **build** fails.

**Seams.** A4 the shared seam · A6 the five bypasses.

### EP3 · Sensitivity is a label that survives delegation `[M]` `wave 3`

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

**Criteria.**
- A labelled session spawns a subagent, a parallel branch and a team member; each carries the label.
- A caller whose live labels do not dominate the session's is refused.
- Revoking a caller's group takes effect on the next request, with no store rewrite.
- The model cannot lower a label, and cannot author the text a human approves a release with.

**Seams.** L1 the label and its propagation · L2 the non-session transitions.

### EP4 · Work can be shared deliberately `[M]` `wave 3`

Alice adds Bob as an observer, then hands off.

**Hazards.** Per-item read control inside a session is defeated three ways, each silently: the
model can include the content in an answer, the agent re-derives it under a new prompter
unlabelled, and compaction folds the label away. The primitive for mixed sensitivity is a
separate derived artifact — a fork — which is the tearline pattern every document vendor
converged on independently.

**Criteria.**
- Alice adds Bob as an observer: he reads, cannot prompt.
- Alice hands off: Bob prompts, Alice's access follows the recorded decision rather than vanishing.
- Bob cannot add himself.

**Seams.** S1 observers then handoff.

### EP5 · An agent cannot widen its own authority `[M]` `wave 2–3`

Spawn narrows, resume never widens.

**Hazards.** Authority is re-derived from the session store on resume, which makes the store the
root of trust (see A5). A project-tier definition taking an operator definition's name is a
privilege swap with no wire involved.

**Criteria.**
- An injected parent spawns a child asking for more than it holds; the child gets the intersection.
- A resumed child re-derives authority and cannot come back wider, including across a restart.
- A project definition cannot claim an operator definition's name.

**Seams.** B1 authority as a runtime value · B2 the three spawn seams · B3 resume · B4 name collision.

### EP6 · The harness acts for a user against an external system `[M]` `[OPS]` `blocked`

The broker holds the key at its own uid; a model-spawned shell cannot reach it.

**Hazards.** The credential read is the thing worth attacking, and the sibling project currently
forwards upstream credential tokens in tool result bodies unchanged (toolhive#5293) — a tool
result body reaches the model.

**Criteria.**
- A model-spawned shell under the loosest posture cannot read the key. Adversarial test, from the
  attacker's side.
- One user-scoped credential is read per authorized call, behind the gate, counted.
- The broker survives a restart without re-consenting the user.

**Gated on** the E1 spike below, and on toolhive D3 + D5 + F1, which **are not filed**.

**Seams.** Track E2 broker and SPIRE selectors · Track E3 mecatl's broker client and cache.

### EP7 · A scheduled run acts with bounded, consented authority `[M+T]` `wave 3`

3am work carries its creator's owner and a grant that expires with the schedule.

**Hazards.** Never fall back to a service identity when the user's grant expires — that turns an
expiry into an escalation. The model must not be able to author the consent record.

**Criteria.**
- A schedule outliving its grant fails closed, and says so, rather than running as the service.
- The model cannot author or widen the consent envelope.
- `FireNow` inherits the same bound without its own code path.

**Seams.** G1 schedule types and the signed envelope · G2 grant lifetime.

### Standalone: A5 store hardening `[M]` `[OPS]`

Redis dials with no auth, no TLS and no keyspace scoping, and `sessnap` is plain JSON with no MAC.
Independent of every epic, and it should land before any multi-tenant deployment, because it
absorbs the one property the deferred SPIFFE issuer was going to provide: an adversary holding a
leaked store credential cannot forge a MAC.

### Standalone: the Track E1 spike `[M]` `[S]`

Can a model-spawned shell reach the pod's key? Output is a decision, throw the code away. Cheap,
unblocked, and it gates EP6 — so run it now rather than discovering the answer during EP6.

### Standalone: X1 the escalation proof `[M+T]`

File first as the north star, complete last. An injected parent calls `Subagent(agent: "deployer")`,
the scope shrinks between two shown token payloads, the gateway refuses the write, and **the twin**
holds: the operator running `deployer` top-level still succeeds. Without the twin you cannot
distinguish "escalation blocked" from "deployer is broken".

It follows `test-sidecar-delegation.sh`, which checks real HTTP status codes — **not**
`run-demo.sh` Act 3, whose delegation matrix is a hardcoded `printf`. Decide where it runs:
`task e2e` is live, costs money, and is not part of `task test`, and a proof that is not gated
rots.

### Tracker: the questions nobody owns

Not an epic, and it must not be distributed into the epics or it is lost. The long form's three
non-issue sections: the deferred rows and their triggers, the issuer sequencing, and six open
questions each blocking a named wave.

Two of those need an answer before anything else moves. **Pick and record the trust-domain name
now, mint nothing** — that is a condition on deferring the issuer, and deferring it is only safe
if the name is fixed. And **whether the driver protocol enforces or is declared trusted** blocks
EP2.

---

## ToolHive coverage

Checked against all open and closed issues in `stacklok/toolhive`.

| Long-form issue | Existing toolhive issue | Verdict |
|---|---|---|
| D1 land the delegation branches | #5194 (8693 token exchange) | covered |
| D2 registration says what a client may hold | #6113, #5321, #5359 | **partial** — the definition-allowlist half is absent |
| D3 intersect requested scope against the subject token | — | **missing** |
| D4 nest `act` instead of overwriting | #6113; #6035 closed (audit captures the chain) | covered |
| D5 bind by `cnf`, sender-constrained end to end | — (#6176 is adjacent, different bug) | **missing** |
| F1 resolved target only admission can construct | — (the admission *seam* shipped: #5438, #5430) | **missing** |
| F2 Cedar evaluates the right things | #6081, #6053, #6049, #6048, #5845, #5582 | covered, well |
| F3 the credential read | #2045, #3877, #3869 | **partial** — the gating half is absent |

Zero SPIFFE/SPIRE issues in toolhive on any search term. That is fine: EP6's selectors are
mecatl-side.

**The three missing ones are the enforcement ones.** Intersection, binding and an unforgeable
target are exactly what separates delegation that constrains from attribution that describes.
Without them the chain is a log field.

Two open toolhive issues strengthen this plan rather than duplicating it, and one should worry us:
**#5293**, the proxy forwarding upstream credential tokens in tool result bodies unchanged; and
**#6081**, Cedar taking its principal from an unverified `id_token` — F2's premise, already broken.

---

## Sequencing

```
EP1 ─┬─→ EP2 ─┬─→ EP4
     │        │
     ├─→ EP3 ─┘
     ├─→ EP5 ──────────────→ X1
     └─→ EP7 ←── EP6 ←── spike
                 ↑
    toolhive D3 + D5 + F1  ← file first
A5, spike: unblocked, any time
```

EP1 is the only unblocked mecatl epic, and everything waits on its owner field. EP5 branches off
EP1 without needing EP2. EP4 needs both EP2 and EP3.

**X1 cannot be demoed until D3 lands in toolhive**, because scope shrinking between two token
payloads *is* the intersection. So the first action is filing the three missing toolhive issues —
otherwise the mecatl side runs ahead of the thing that proves it works.
