# ADR 0044 — Reserved `general` agent name

- Status: Accepted
- Date: 2026-06-22
- Scope: `engine/agent` (Subagent tool routing + spec enumeration), `internal/adapter/agents` (discovery), `internal/adapter/grpcdriver` (driver client), `engine/tool` (the reserved-name constant)
- Supersedes: none
- Superseded by: none

## Context

The default explorer engine (`SubagentTool.childEngine`) — the fresh-context,
broad-tool, base-persona child a `Subagent` call runs when no specialist is
selected — was reachable only by **omitting** the `agent` arg. There was no
reserved name the model could pass to request it explicitly. Claude Code, the
direct analogue, exposes its built-in general-purpose subagent as an explicitly
named type (selectable via `Task`'s `subagent_type`), distinct from user-defined
specialists in `.claude/agents/`.

This is an affordance/discoverability gap, not a capability gap: the default
explorer already behaves exactly as a general-purpose subagent should. But the
asymmetry made "general-purpose" invisible in the Subagent tool's spec
enumeration (the `agentEnumeration()` tail listed only custom defs), and the
omission-only surface was harder to document and steer toward.

## Decision

Reserve the name `general` (the constant `tool.ReservedAgentNameGeneral`) as an
explicit alias for the default explorer. Concretely:

1. **Routing** (`engine/agent/subagent.go` (`selectChildEngine`)): `agent:"general"`
   selects `t.childEngine` + `t.limits`, exactly like an omitted `agent` arg, and
   never enters the registry lookup.
2. **True-alias semantics across combinations**: because `general` is the default
   explorer (not a read-only specialist), it is NOT subject to the `agent`
   exclusions on `resume`, `fork`, `mode:"read-write"`, or the model router.
   `general`+`resume`, `general`+`fork`, `general`+`mode:"read-write"` are all
   allowed (the `general` is redundant but harmless), and `general` lets the
   semantic model router (ADR 0031) fire. Each guard that checks `args.Agent != ""`
   was tightened to `args.Agent != "" && args.Agent != tool.ReservedAgentNameGeneral`.
   The ONE deliberate carve-out is `general`+`model`: it is REJECTED (same as
   `agent`+`model`), because a per-call `model` override mints a fresh engine
   through the factory, making `general` redundant and the combination ambiguous.
   This is the single place `general` is not "same as omitting `agent`", and it is
   intentional — omitting `agent`+`model` is the plain model-override path.
3. **Reservation at the source layer** (`internal/adapter/agents/discover.go`
   (`parseAgentDef`)): an operator-authored `AgentDef` named `general` is rejected
   at parse time with a clear "reserved" reason, so the routing key can never be
   shadowed by a specialist. The driver client
   (`internal/adapter/grpcdriver/agentsource.go`) drops a wire def named `general`
   with a WARN — defense-in-depth so a driver cannot launder one past the FS
   reservation.
4. **Spec enumeration** (`engine/agent/subagent.go` (`agentEnumeration`)):
   `general` is listed FIRST in the "Available specialist agents" tail (when
   specialists are configured), so the model sees an explicit general-purpose
   option alongside them. The no-specialists case still renders no tail (the
   default-explorer-only case is unchanged). The `unknownAgentHint` lists
   `general` first in the available-names error.
5. **The constant lives on the port** (`engine/tool/agentsource.go`): the ONE
   source of truth the adapter parser, the driver client, and the agent-layer
   routing all read. This is layering-clean: `internal/adapter/agents` and
   `engine/agent` both already import `engine/tool`; neither imports the other.

## Consequences

**Easier:**
- The general-purpose subagent is now discoverable and explicitly requestable,
  closing the affordance gap with Claude Code without adopting its dynamic-
  creation surface (which mecatl deliberately omits as a trust boundary — see
  `internal/adapter/agents/agentdef.go` "no model-writable agent-draft path").
- The Subagent tool's spec honestly advertises the general-purpose option.

**Harder / costs:**
- `general` is now a reserved word — an operator who had a def named `general`
  gets a parse-time rejection on upgrade. This is a deliberate, documented break
  (the name was always a poor choice for a specialist; the reservation makes the
  routing key stable).
- One more constant on the `engine/tool` port surface (an `engine/api/tool.txt`
  snapshot bump; classified Added = minor).

**Committed to:**
- `general` is part of the Subagent tool's contract. The name is stable.
- The team-member path (`internal/app/build.go` (`lookupMemberDef`)) needs NO
  routing change: a def named `general` can never enter the registry (parse-time
  rejection), so `AgentType:"general"` is a registry miss and falls back to the
  default member catalog — the team-member analogue of the default explorer.

## See also

- [ADR 0031](./0031-subagent-model-router.md) — the semantic model router, which
  now fires for `general` delegations too (it is the default explorer's domain).
- [ADR 0014](./0014-agent-teams.md) — agent teams; members consume `AgentDef`
  via `AgentType`, and `general` falls back to the default member catalog.
- `docs/architecture/subagents-and-teams.md` — the living "how it works" doc that
  documents the reserved name.
- `docs/usage.md` — the `--agents-dir` flag row notes the reservation.
- Issue #146 — the tracking issue.
