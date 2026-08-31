# ADR 0254 — Slack bot: `@stacklok/mecatl`'s first real consumer, built on Slack's native Agent Sessions API

- Status: Proposed
- Date: 2026-08-31
- Scope: A Slack bot reference implementation, `sdk/typescript/examples/slack-bot/` (once
  [#821](https://github.com/stacklok/mecatl/issues/821) creates the SDK tree). Issue
  [#882](https://github.com/stacklok/mecatl/issues/882) (this ADR) plans it;
  [#883](https://github.com/stacklok/mecatl/issues/883) implements it;
  [#881](https://github.com/stacklok/mecatl/issues/881) is the umbrella.
- Supersedes: none.

## Context

`@stacklok/mecatl` (#821) has no real consumer yet exercising its Node/Bun gRPC path
end-to-end — every design decision so far (durable `run_id`, steer, the mocking
testkit) has been validated against the API surface, not against a real app driving
it. A Slack bot — tag it, it drives a mecatl session, it replies in the thread — is
both a genuine stress test (session lifecycle, streaming `Converse`, steer-while-running,
cancellation) and, once proven, shippable as example code alongside the SDK.

**Two things this ADR deliberately does not solve**, named so a future reader doesn't
read their absence as an oversight:

- **Whose code this reuses, if any.** An informally-mentioned PoC ("a working
  Slackbot connected to the Claude harness," demoed via video) was referenced in the
  2026-08-31 UI team sync. The only concretely-found Slack+agent work under the same
  author (Radoslav Dimitrov) is `stacklok/atrium`'s "Craig V1"
  (`stacklok/atrium#135`) — a full production system (its own agent loop, MCP
  gateway, OAuth, customer-shippable chart) that does not appear to use
  `@stacklok/mecatl` at all. Whether Craig and the informal PoC are the same thing,
  related, or unrelated is **unconfirmed** — tracked as an open fact-check in #882,
  not resolved here. This ADR plans as build-fresh; if that fact-check later surfaces
  something genuinely reusable (most plausibly Craig's Slack MCP server as a *tool*,
  not its bot shell — Craig's agent loop is a different one entirely), that is a
  scope reduction to make later, not a blocker now.
- **Identity-impersonated, multi-user approvals.** A separate Slack thread (Rado)
  explored a bigger idea — an internally-hosted Mecatl Slack bot where the agent
  inherits the invoking user's Slack identity, so approvals happen on their behalf,
  inspired by Slack's own "Code channels" feature and the Perplexity-Computer origin
  story. That is materially bigger scope (multi-user sessions, identity-mapped
  approval) than this ADR's goal and is explicitly **out of scope** — a later,
  separate effort, not a requirement here. mecatl already has the infrastructure that
  idea would eventually need: [ADR 0204](./0204-caller-identity-threading.md) (accept
  and thread a verified principal), [ADR 0206](./0206-oidc-authn-module.md) (pluggable
  caller-identity acceptance), [ADR 0212](./0212-caller-ownership-enforcement.md)
  (ownership enforced at every access path) — worth knowing it's not a green-field
  problem when that effort starts, but nothing here depends on it.

**Slack's own AI-agent platform has moved since the informal PoC was demoed.** In
2026 Slack shipped a purpose-built **Agent Sessions API**
(`docs.slack.dev/ai/agent-sessions/`), replacing the older Assistant messaging
experience (deprecated Feb 2027). It gives a session four lifecycle statuses —
`active`, `processing`, `suspended`, `closed` — a native stop button
(`agent_session_stopped`, shown automatically while `processing` if subscribed), and
native token-by-token streaming (`chat.startStream`/`appendStream`/`stopStream`).
`suspended` is documented explicitly as "the agent needs clarification **or a tool
approval**." This maps closely onto mecatl's own session model, and is the
Slack-recommended way to build exactly this kind of app — building on it instead of
hand-rolled message editing is a real decision, not a default.

**One confirmed platform risk, not hypothetical:** community reports say
`chat.startStream` works reliably in DMs but fails in **channels** with
`missing_recipient_team_id` — and "tag the bot in a channel" is this ADR's actual
scenario. This needs an early spike to confirm current behavior, not an assumption
either way.

## Decision

**1. Build on Slack's Agent Sessions API, mapped directly onto mecatl's session
states — don't hand-roll message editing.**

| Slack agent-session status | mecatl session state |
|---|---|
| `active` | idle (ready for next prompt) |
| `processing` | running |
| `suspended` | awaiting / `PendingAsk` |
| `closed` | completed / cancelled / failed (terminal) |

One mecatl session per Slack **thread**: a new top-level `@mention` starts a fresh
mecatl session; replies in that thread continue it. This matches both Slack's own
thread-scoped session model and mecatl's session-per-conversation model — no
translation layer needed.

**2. Streaming is spiked first, not assumed.** Target native
`chat.startStream`/`appendStream`/`stopStream` for real token-by-token streaming from
mecatl's `Converse` events. Before committing to it as the v1 path, validate directly
whether it actually works when the bot is tagged in a **channel** (not a DM) — the
reported `missing_recipient_team_id` failure is the one concrete platform risk here.
If it's still broken, fall back to a single final `chat.postMessage` for v1 without
blocking on Slack fixing it. Either way this is a session-scoped stream tied to the
mecatl run, not a per-token round-trip to mecatl — the SDK's real gRPC streaming path
is what feeds it.

**3. mecatl's `CancelRun` wires to Slack's native stop button.** Subscribing to
`agent_session_stopped` gets the stop button for free while `processing`. The handler
calls the SDK's cancel, then explicitly transitions the session status (Slack does
not do this automatically on stop) — this is genuinely cheap: no new mecatl-side
work, the capability already exists.

**4. Approval: auto-approved by default, manual approval prototyped as an explicit
experiment, not the v1 requirement.** Every demo run executes under an
auto-approved posture so it never blocks waiting on a human — matching the "tag it,
get an answer" v1 scope this ADR is actually trying to unblock. Separately,
prototype the natural-looking alternative: a mecatl `PendingAsk` transitions the
Slack session to `suspended` (the documented "needs a tool approval" state) and
posts Block Kit approve/deny buttons in the thread; clicking resumes the run and
transitions status back. Slack's `suspended` status gives the native "needs your
input" signal, but does **not** supply a ready-made approve/deny widget — the actual
buttons are still hand-built. If this doesn't fit naturally once tried, drop it
without ceremony; it was never the thing this ADR needs to ship.

**5. Development sequencing: `mecated --mock` first, real `mecated` once the SDK
path is proven.** Matches the project's existing offline-testing discipline (the
mocking testkit, `mecademo`'s offline pattern) — the Slack-side plumbing (Socket
Mode wiring, session-status mapping, streaming) can be built and tested without a
live agent loop, then pointed at a real `mecated` once the gRPC path works.

**6. Event delivery: Socket Mode.** A persistent WebSocket from the bot process to
Slack — no public URL, no ngrok, nothing to expose. Simplest fit for a self-hosted
dev app (create your own Slack app in dev mode, install it to one workspace — no App
Store listing, ever, per the original self-hosted framing).

**7. No fixed demo script.** The bot relays whatever task it's tagged with to a real
mecatl session — it is not scripted to always demonstrate one canned task. Honest to
"just wire the SDK through"; a specific polished demo script (if wanted for an actual
conference run) is a later, separate concern from this plan.

**8. Code lands at `sdk/typescript/examples/slack-bot/`** — provisional, since that
tree doesn't exist yet ([#821](https://github.com/stacklok/mecatl/issues/821) owns
its real layout. This ADR names the intended location; #821's actual conventions win
if they differ once the tree exists.

## Consequences

- **A real end-to-end SDK consumer finally exists**, exercising session lifecycle,
  streaming `Converse`, and (if the experiment lands) steer/approval — not just API
  surface reviewed in the abstract.
- **Building on Slack's Agent Sessions API instead of hand-rolled UI is a bet on a
  platform still settling** (the classic Assistant experience it replaces sunsets
  February 2027; the new API shipped mid-2026). Accepted because it's the
  Slack-recommended path and gives the stop button and `suspended` status for free —
  but it means tracking Slack's own changelog, not a one-time integration.
- **The channel-streaming risk is real and unresolved until spiked.** If
  `chat.startStream` genuinely doesn't work when tagged in a channel, v1 ships with a
  single final message instead of true streaming — a real capability gap versus the
  SDK's actual streaming path, accepted rather than blocking the whole plan on a
  third-party bug.
- **The manual-approval experiment may simply not ship.** It's explicitly not a
  requirement; if `suspended` + Block Kit buttons turns out awkward in practice, the
  auto-approve default is what actually unblocks this ADR's goal.
- **The reuse question stays open past this ADR.** If the Craig/PoC fact-check later
  confirms something reusable, this plan doesn't need revisiting — it was written
  build-fresh regardless, and picking up a reusable piece (most plausibly a Slack MCP
  server as a tool) is a scope reduction applied on top, not a contradiction of this
  decision.
- **Code location is provisional**, subordinate to whatever `sdk/typescript/`'s real
  layout ends up being once #821 lands it.

## See also

- [Issue #881](https://github.com/stacklok/mecatl/issues/881) — the umbrella
  end-to-end implementation task.
- [Issue #882](https://github.com/stacklok/mecatl/issues/882) — the planning
  sub-task this ADR is the output of; carries the open Craig/PoC fact-check.
- [Issue #883](https://github.com/stacklok/mecatl/issues/883) — the implementation
  sub-task, blocked on #821.
- [Issue #821](https://github.com/stacklok/mecatl/issues/821) — the
  `@stacklok/mecatl` TypeScript SDK this bot consumes.
- [Issue #872](https://github.com/stacklok/mecatl/issues/872) — the SDK mocking
  testkit (ADR 0253, PR #875 as of this writing, not yet merged); the `mecated
  --mock` development sequencing here follows the same offline-first discipline.
- [ADR 0232](./0232-steer-while-running.md) — steer-while-running, relevant if the
  manual-approval/steer experiment extends to mid-run Slack replies.
- [ADR 0204](./0204-caller-identity-threading.md),
  [ADR 0206](./0206-oidc-authn-module.md),
  [ADR 0212](./0212-caller-ownership-enforcement.md) — the caller-identity
  infrastructure Rado's separate, out-of-scope identity-impersonation idea would
  eventually build on.
