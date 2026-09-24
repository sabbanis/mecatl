# ADR 0350 — Construction-time model-only sessions and explicit compaction-off

- Status: Accepted
- Date: 2026-09-22
- Scope: session tool-surface profiles and context-management configuration
- Supersedes: none
- Superseded by: none

## Context

Some embedding clients need Mecatl only as a bounded model-inference host. The
existing `no-fs` profile removes filesystem authority but intentionally retains
MCP, web, memory, skills, delegation, and scheduling tools. A permission policy
cannot prove that none of those capabilities will be advertised, and a denylist
would make every future tool registration a possible widening.

The existing nil context-window behavior suppresses automatic compaction, but
there is no operator-facing configuration that also closes manual compaction.
That distinction matters because cascade compaction may make another model call
and both strategies rewrite retained history.

This Architectural change follows the split acceptance-plan spine. The
[model-only one-shot profile plan](../acceptance/model-only-one-shot-profile.md)
is the behavioral and interface contract; its Plan / Interface PR must merge
before the existing local implementation can become an approved baseline.

## Decision

1. Add the public session profile `model-only`. It binds the same exact no-FS
   placement as `no-fs`, always receives a per-session engine, and remains fixed
   for the session lifetime.
2. Build its model-visible catalog from an empty starting point and return before
   any core, MCP, web, memory, scheduling, skill, delegation, host-attached, or
   extra tool registration. Assert that the completed catalog is empty. This is
   a construction property, not a permission denial or a list of excluded names.
3. Reject client MCP and host-attached tools for `model-only` before making an
   outbound connection. Disable command expansion, progressive disclosure, and
   completion-learning observation for that engine. The prompt reports no
   filesystem and no tools without claiming other affordances.
4. Add `--compaction=off`. Composition supplies no context-window resolver, so
   automatic compaction cannot trigger, and installs a disabled compactor whose
   manual invocation returns `agent.ErrCompactionDisabled` without mutation or
   another model call.
5. A `model-only` session fails creation unless the daemon uses
   `--compaction=off`. Existing default and `no-fs` sessions remain unchanged
   unless the operator explicitly selects that global strategy.
6. Preserve `model-only` through persistence, rehydration, placement, and
   scheduler fire paths. An unknown profile or compaction strategy continues to
   fail closed rather than selecting a broader default.

## Consequences

An embedding client can prove an empty advertised tool surface without auditing
every ordinary tool family. Compaction-off covers both automatic and manual
entry points and is observable through a zero engine context window plus the
manual-operation error.

The daemon-wide compaction setting means a mixed deployment that needs ordinary
compaction and model-only sessions must run separate Mecatl instances. This is a
deliberate operationally obvious boundary for the first version.

`model-only` does not itself set provider retry, caching, request-size, response,
event, state, queue, concurrency, or duration limits. Embeddings that require
those constraints must configure and qualify them separately.

## See also

- [ADR 0012 — Compaction](./0012-compaction.md)
- [ADR 0276 — Full-request counting and manual compaction](./0276-full-request-and-manual-compaction.md)
- [ADR 0291 — Server-owned session placement](./0291-server-owned-session-placement.md)
- [Context management](../architecture/context-and-compaction.md)
