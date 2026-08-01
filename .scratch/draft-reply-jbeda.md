# DRAFT — reply to jbeda on #321. NOT POSTED.

Distilled from `docs/agent-identity-outbound.md`. He asked for a concrete example with
the threats it defends against. JAORMX said the scenario was the gap he hadn't filled,
so check with him before posting — this may be his to write.

---

You asked for something concrete to test against. Here's the outbound half, as one
request.

Alice asks her agent to review a PR. The agent spawns a code-reviewer subagent, which
needs the diff from GitHub. GitHub is behind vMCP, and vMCP holds Alice's GitHub token.

```
Alice ──► mecatl ──► vMCP ──► GitHub
              │        │
              │        ├─ GATE:   may this caller make this call?
              │        └─ SELECT: which of Alice's credentials, if any?
              │
              └─ subagent (goroutine, no key, holds nothing)
```

Two things are worth arguing about, and they're the two boxes.

**The subagent never holds a credential.** It's a goroutine. mecatl holds one token and
makes calls for it. So the threat isn't the agent stealing Alice's GitHub token — it
can't reach it. The threat is the agent getting mecatl to *use* it for something Alice
didn't ask for. Confused deputy, not theft. That changes what the defence has to be: not
secrecy, but a gate that can tell the difference between the calls a narrowed subagent
may cause and the ones it may not.

**Which is the gate box.** Today it can't tell. It sees who is acting and whether the tool
is read-only, but not *which backend* the call routes to — that identifier exists on the
tool and simply isn't passed. So it can authorise "this agent may read" without being able
to say "…but not with Alice's GitHub token." And with no policy configured at all it
allows everything, which is fine for a proxy with nothing to hand out and wrong the moment
credentials are attached.

**And the select box is the part nobody has specified.** Picking a credential should be
two questions: whose is it (the user), then may this caller cause *this* one to be used
(the backend, the actor, the operation). Today only the first happens, and it happens in
HTTP middleware before routing — so at that moment there is no tool and no backend to
narrow by. Every credential the user owns is a candidate and nothing narrows the set.

That's the whole design in one sentence: **give the gate the backend, and give the
selection the gate's answer.**

## What this gets wrong today, concretely

A code-reviewer subagent narrowed to read-only on one repo can, right now, cause any call
the gateway advertises using any credential Alice owns. Not because anything is
misconfigured — because the narrowing mecatl performs stops at its own process boundary,
and nothing downstream is looking at it.

## Three threats, and where each is caught

**Prompt injection at the subagent.** Expected, not exceptional. Caught at the gate, and
only if the gate can see enough to distinguish the calls the subagent's narrowing permits.

**Prompt injection at the parent.** Worse, because the parent chooses the child's tools and
prompt. Identity can't prevent it — the attacker is driving the harness's own reasoning.
It can bound it: a ceiling carried in the credential limits what a compromised parent can
hand out. Worth being honest that mecatl's other defences here weaken at the top of the
posture ladder.

**A leaked database credential.** Distinct from a compromised pod and likelier. Such an
attacker can rewrite a stored session but cannot sign, which is exactly the adversary
chain integrity defeats. Worth separating from "the pod that can sign can impersonate
anything", which is true and makes the mitigation look less valuable than it is.

## Two things the doc currently claims that don't survive

**The chain doesn't reach the backend.** The XAA strategy builds its outbound token from
stored upstream tokens and never reads the inbound claims, and RFC 8693 says an exchange
creates no linkage between input and output tokens. So "verifiable by a third party" has
to mean *at the gateway*, not at the resource server. That's the right place anyway — a
backend has no policy about mecatl's subagents it could apply — but the boundary should
be stated.

**An agent can never carry the session pointer the credential store keys on.** It's minted
during a browser login, and the exchange drops it. So you can have the actor or the
credential lookup, not both, and #5194 exists to get the actor. That's why the lookup has
to key on the user instead.

## On build-versus-buy, one data point for your list

Selection is genuinely unspecified. RFC 9396 says there's no standard way to compare two
authorization detail requests. The WIMSE credential-exchange draft declines the problem
as unfittable to one protocol. CB4A routes on an envelope but defines no way to choose
among several credentials for the same user and service. Every draft that approaches it
hands the remainder to an unspecified policy point.

So this is one to build rather than wait for — but small, and worth building as the
simplest thing that works rather than as a vocabulary.

One rule worth taking from CB4A verbatim: *the PDP must not evaluate justification text
for approval decisions.* In an agent deployment that's the entire injection surface, not
a refinement.
