# ADR 0350 — Session-scoped agent identity

- Status: Proposed
- Date: 2026-09-22
- Scope: `CreateSessionRequest`/`sessions.create()`, the composition-layer agent-definition
  engine construction (`internal/app/agentdefs.go`), session persistence
  (`engine/adapter/sessnap`)
- Supersedes: none

## Context

[ADR 0013](./0013-agent-definitions.md) gave mecatl named specialist `AgentDef`s — a
markdown-plus-frontmatter persona with its own tool allowlist, model, run limits, MCP
servers, hooks, and memory. But an `AgentDef` is only ever reachable as a **child**:
`Subagent(agent="name")` or a team member's `AgentType`. `CreateSessionRequest`
(`contracts/proto/mecatl/v1/harness.proto`) has no field to select one — its knobs are
`mode`, `limits`, `provider_id`, `model_id`, `profile`, `reasoning_effort`, the debug
fields, and `mcp_servers`. A session's root engine is always the deployment's default
explorer, built once at `app.Build` time.

Issue [#1053](https://github.com/stacklok/mecatl/issues/1053), "Slack bot: multiple
@-mentionable identities backed by mecatl agent definitions," is what surfaces the gap
concretely: a Slack bot built on `@stacklok/mecatl-sdk` wants several distinct
`@mention`-able identities in one workspace, each backed by its own `AgentDef`, each
restricted to its own tool set — not a single fixed identity with a persona pasted into
its prompt. Per issue [#1395](https://github.com/stacklok/mecatl/issues/1395) (the Slack
bot integration roadmap), the single-identity v1 is delivered; this is the one open item
under "Identity and expansion." mecak8s is the deployment target.

The composition layer already has exactly one function that turns an `AgentDef` into a
real engine — `buildAgentDefEngine` (`internal/app/agentdefs.go`) — reused today by three
call sites: startup Subagent-engine construction, the per-call `agent`+`model` override,
and the per-call `agent`+`read-write` override. Adding a session-creation call site is
the fourth use of the same reusable step, not a new design. It matters, though, that
`buildAgentDefEngine` currently bottoms out in `newChildEngineForProvider` — a
**child-shaped** construction: no guardrails wiring, and child-specific ask handling
(headless auto-deny, the optional ask-reviewer). That shape exists for good reasons
specific to delegation (no recursion into guardrails, no human necessarily watching a
background child), but none of those reasons apply to a session that **is** the root.

This ADR is deliberately narrow: it says how an `AgentDef` becomes a session's main
engine and what that session inherits from "being a main session" versus "being built
from a def." It does not touch operator-tier permission posture. PR
[#1730](https://github.com/stacklok/mecatl/pull/1730) (draft
[ADR 0351](https://github.com/stacklok/mecatl/pull/1730/files), not yet merged at the
time of writing) proposes a named `--permission-mode` vocabulary and is explicit that
composition-bearing tiers (posture, allow-all, substitution loosening) stay
operator-only and non-session-selectable, and that "agent-definition frontmatter cannot
name a composition-bearing tier." This ADR is consistent with that: it only ever
resolves the existing session-level `PermissionMode` enum (`plan`/`default`/
`acceptEdits`), never posture.

A separate, unmerged design (a stale `add-slack-bot-adr` branch, never landed under a
reserved ADR number — its intended slot, 0254, is on `main` today as an unrelated
document, "Session debugger admin transport") sketches the Slack bot's own approval UX:
a mecatl `PendingAsk` mapped onto Slack's `suspended` agent-session status with Block Kit
approve/deny buttons. It's cited below by issue chain, not by ADR number, since it was
never actually accepted. It matters here only because this ADR's "ordinary main-session
behavior" decision is what keeps that approval UX buildable at all.

One naming note, to head off confusion: this repo separately uses "agent identity" for
an unrelated concept — SPIFFE-style workload identity and per-agent credential exchange
for outbound MCP calls (the `agent-identity-fold`/`agent-identity-issues` branches, ADR
drafts about vMCP token exchange). That is a different axis entirely (cryptographic
caller identity, not persona/config) and this ADR does not touch it.

## Decision

**Extend `CreateSessionRequest` with an optional `string agent_id` field.** Empty
reproduces today's behaviour exactly (the default explorer engine); a name that doesn't
resolve in the agent registry is a loud `InvalidArgument`, mirroring how an unknown
`provider_id` is handled. A dedicated new RPC was considered and rejected: it would
duplicate `mode`, `limits`, `mcp_servers`, `reasoning_effort`, and the debug fields, and
create two call paths that must be kept in sync on every future `CreateSessionRequest`
change — against this codebase's existing "one seam" convention (`provider_id`/
`model_id`/`profile` are all optional fields on the same message already).

**The def's tool scope is a strict, non-widenable ceiling — covering core tools and MCP
tools uniformly, no exceptions.** When `agent_id` is set, the session's catalog is built
**exclusively** from the def's own `tools`/`disallowedTools` (core) and `mcpServers:`
(MCP) — a full replacement of the normal per-session catalog assembly, not a filter
layered on top of it. Concretely:

- `CreateSessionRequest.mcp_servers` and `debug_mcp_servers` are **rejected** with
  `InvalidArgument` whenever `agent_id` is set. Honoring either would let a caller add
  tools the def never declared, defeating the ceiling.
- Already-configured global MCP servers the def doesn't reference are not exposed
  either — only what the def's own `mcpServers:` names.

This is a deliberate simplicity choice: it should be possible to look at one `AgentDef`
file and know exactly what a session bound to it can call, with nothing else in the
request able to widen that set.

**No delegation in v1.** An `agent_id`-bound session's catalog never includes
`Subagent`/`Parallel`/`Team`, mirroring the existing rule that already applies when a def
is used as a child (`engine/tool/agentsource.go`: "Subagent/Parallel/ToolSearch are
ALWAYS excluded"). This keeps the security story bounded for v1; a delegating specialist
is a real but separate feature to consider only if a concrete use case needs it.

**Mutation is allowed if and only if the def's `tools:` allows it.** Unlike the
Subagent-delegate path — which forces read-only regardless of `tools:`, for reasons
specific to the read-parallel/mutate-serial child dispatcher — a session root is not in
that race-hazard situation, so there is no technical reason to force read-only here.

**Run limits are tighten-only.** `Limits.max_turns`/`max_tool_calls` on the request may
lower the def's configured `maxTurns`/`maxToolCalls`, never raise them. This mirrors the
tighten-only discipline already used for per-call Subagent overrides
(`subagentArgs.MaxTurns` etc.) — the operator's configured cap on a specialist is a
ceiling, not a suggestion a caller can override upward.

**`PermissionMode` is also tighten-only against the def's `permissionMode`** — the same
discipline as limits, and deliberately *not* the "explicit field simply wins" rule used
for `provider_id`/`model_id` below. The asymmetry is intentional: `PermissionMode` has a
real permissiveness ordering (`plan` < `default` < `acceptEdits`, consistent with how PR
#1730 characterizes the values), so a def author setting `permissionMode: plan` means it
as a real restriction on what this identity may ever do. `provider_id`/`model_id` have no
such ordering — one model isn't "more restrictive" than another — so caller-wins is
correct there and would be wrong here.

**`provider_id`/`model_id` precedence: explicit request field, if set, wins; else the
def's `Model`/`Provider`, if set; else the existing global/server default.** This is not
a new mechanism — both `CreateSessionRequest` (documented: "Empty => the server default
provider" / "Empty => the provider's default model") and `AgentDef` (documented: empty
means inherit) already use empty-string-means-unset as their sentinel, so a caller
omitting `model_id` to get the def's model behavior falls straight out of the existing
convention. It also mirrors the already-shipped Subagent per-call precedence
(`def.Model` > global `--subagent-model` > parent `--model`). One existing validation
rule needs a scope fix: "`model_id` without `provider_id` is `InvalidArgument`" must
account for `agent_id` supplying the provider — that combination is no longer ambiguous
and must not be rejected.

**Everything else about the session is ordinary main-session behavior, not child
behavior.** Guardrails (the operator's `modelhook` checker) stay wired exactly as for any
other main session; governance permission rules evaluate under `AudienceMain`, not
`AudienceSubagent`; a permission ask pauses the session to `awaiting` and resolves via
the normal `ResolveRunAsk`/approve flow — never the child-specific headless auto-deny or
optional ask-reviewer. Two concrete reasons:

- Guardrails are a content-level check independent of the tool-presence ceiling, and
  Slack input comes from untrusted end users — dropping them for an `agent_id` session
  would be a real safety regression relative to how the operator's other main sessions
  are protected.
- Child-style headless auto-deny would make the Slack bot's own planned approval UX
  (a `PendingAsk` mapped to Slack's `suspended` status with Block Kit approve/deny
  buttons — see "Context" above) structurally impossible — every ask would auto-deny
  before a human ever saw it.

Because `buildAgentDefEngine`/`newChildEngineForProvider` bottom out in child-shaped
Deps today, this decision is a real implementation requirement, not free: building the
catalog/prompt/model/limits from a def has to be separated from choosing which Deps
bundle (guardrails, ask-flow, governance audience) wraps the resulting engine. There is
no v1 toggle between the two postures — no concrete use case names a reason to want the
child-shaped variant as a session root, so building one now would be speculative.

**No per-caller authorization on which `agent_id` values may be requested, in v1.**
Access control is left at the deployment level (e.g., separate mecak8s deployments per
bot or purpose). This is deferred, not silently dropped: it would need a caller/principal
model this RPC doesn't have today, and is a real future concern once multiple callers
need different visibility into the same registry.

**`agent_id` is fixed for the session's lifetime and persists on the session
snapshot**, the same discipline `ProviderID`/`ModelID` already follow
(`engine/adapter/sessnap`: an `AgentID string` field alongside them, same
`omitempty`/additive convention). `ForkSession` and `ClearSession` preserve the source
session's `agent_id` — both continue or restart the same identity, never pick a new one.
`CreateSessionResponse` echoes the resolved `agent_id` back, mirroring the existing
`resolved_model` echo, so a caller (e.g. the Slack bot) can confirm and display which
identity is live.

**No special-casing by discovery mechanism.** `AgentDefSource` is already a port; the new
call site consumes it exactly as the three existing call sites do, whether definitions
come from `--agents-dir`/conventional filesystem discovery or the remote
`--agent-source-url` driver.

## Consequences

- **Closes a real gap.** Per-agent tool restriction — the actual thing issue #1053 needs
  — was previously reachable only as a delegate, never as a session root. A Slack bot (or
  any SDK caller) can now start a session that *is* a named, tool-restricted specialist.
- **Real new implementation cost.** `buildAgentDefEngine`'s catalog/prompt/model/limits
  construction and its child-shaped Deps selection are fused today and must be split so
  a session-root call site can take the former without the latter. This is not "just
  load the data" — it's the harder half of the work.
- **Contract and compatibility surface.** A new `CreateSessionRequest.agent_id` field and
  a `CreateSessionResponse` echo require `task generate` (proto/contract regen) and, if
  any core `engine/` API surface changes, an `engine/api/*.txt` update per
  [ADR 0037](./0037-engine-stability-contract.md).
- **What this deliberately does not do (v1), named so it isn't read as an oversight**,
  mirroring ADR 0013's own honesty about scope:
  - No agent-as-session-root delegation (`Subagent`/`Parallel`/`Team` excluded).
  - No per-caller authorization on which identities a caller may select.
  - No configurable choice between "ordinary main-session" and "child-shaped" behavior
    for an `agent_id` session — always the former.
  - No change to operator-tier permission posture or to how posture is selected; this
    ADR only ever resolves the existing session-level `PermissionMode` enum.

## See also

- [ADR 0013 — Agent definitions](./0013-agent-definitions.md) — the `AgentDef` port,
  discovery, and the `buildAgentDefEngine` composition step this ADR adds a fourth call
  site for.
- [Issue #1053](https://github.com/stacklok/mecatl/issues/1053) — the motivating issue:
  Slack bot identities backed by agent definitions.
- [Issue #1395](https://github.com/stacklok/mecatl/issues/1395) — the Slack bot
  integration roadmap; names #1053 as the current open "Identity and expansion" item.
- Issues [#881](https://github.com/stacklok/mecatl/issues/881),
  [#882](https://github.com/stacklok/mecatl/issues/882),
  [#883](https://github.com/stacklok/mecatl/issues/883) — the (delivered, single-fixed-
  identity) Slack bot v1 whose unmerged planning draft sketches the approval UX
  ("Context" above) this ADR's "ordinary main-session behavior" decision preserves the
  ability to build.
- [PR #1730](https://github.com/stacklok/mecatl/pull/1730) / draft ADR 0351 (not yet
  merged) — the adjacent, non-conflicting decision on operator-tier permission-mode
  vocabulary; this ADR stays consistent with its position that composition-bearing
  posture is not session-selectable.
- [ADR 0037 — Engine stability contract](./0037-engine-stability-contract.md) — governs
  whether this change needs an `engine/api/*.txt` update.
