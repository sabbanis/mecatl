# ADR 0110 — Mecatl Studio as an in-repo module

- Status: Accepted
- Date: 2026-08-14
- Scope: `studio/` — the local web client for the harness; its relationship to the Go modules and to `website/`

## Context

The harness has had two first-party clients: `mecatui` (the Bubble Tea TUI, an
in-repo gRPC client) and `mecademo` (the offline demo). A third grew up outside
the repo — a local web client, "Mecatl Studio" — in a private standalone
repository. It speaks the same HTTP/SSE API `mecated` already serves, plus a
small Node supervisor that spawns `mecated` and holds the provider credential in
memory.

Living outside the repo cost it the things every other client gets for free:

- **No CI.** Nothing built or tested it on a PR. Its test suite asserted source
  invariants (bounded OAuth, project-scoped skills, read-only memory) that had
  already gone stale against the code they described, and nothing noticed.
- **Path coupling with no contract.** It reached its harness through
  `../../mecatl`, a hardcoded relative path to a sibling checkout, and one
  absolute developer-machine path was compiled into the client bundle. It worked
  on exactly one machine.
- **Silent protocol drift.** It reads `session.Event` payloads, the schedule
  registry, and the user-model index. When those move, a repo-external client
  learns about it from a bug report. A turn that failed in the provider was
  rendered as a successful empty turn for exactly this reason: the client's
  handling of `result.stop == "error"` was never exercised against the daemon
  that produces it.

`website/` already established that a Node module can live in this Go monorepo:
its own `package.json` and `Taskfile.yml`, included in the root Taskfile under a
namespace, with a dedicated CI job. Studio is the same shape with a different
job.

The alternatives considered: keep it standalone and pin a protocol version
(rejected — nothing generates or checks such a version, so it degrades to a
comment); vendor it as a Go-embedded asset bundle (rejected — it needs a live
supervisor process, not a static bundle, and embedding would put a 400-package
npm tree inside the Go build); rebuild it as a `mecatui` web renderer (rejected
as a much larger piece of work that this decision does not preclude).

## Decision

Studio lives at `studio/`, a Node module in this monorepo, on the `website/`
pattern:

- Its own `package.json` / `package-lock.json`, `Taskfile.yml` included by the
  root Taskfile under the `studio:` namespace, and a `studio` CI job running
  `npm ci && npm test && npm run lint && npm run typecheck`.
- **It is NOT a Go module and never enters `go.work`.** It is not in the
  layering DAG, the depguard allowlists, or the api-compat gate. `task test` is
  unchanged — Studio's suite runs from its own namespace and its own CI job.
- **It consumes the PUBLIC API only** — the HTTP/SSE surface `mecated` serves on
  loopback, through a same-origin worker proxy. It imports nothing from
  `engine/` or `internal/`, and it is not a second composition root.
- **The workspace is resolved, never hardcoded.** The controller derives the
  repo root from its own location and reports it on `/status`; the client reads
  it from there and refuses to open a session before it knows it. A clone
  anywhere works with no source edit.
- **The credential boundary is unchanged.** The supervisor holds an OpenRouter
  key in memory only, and holds no gateway credential at all — the ToolHive
  gateway path reaches `mecated` through the loopback proxy that injects a token
  per request.

The starter-template residue the app was scaffolded from (D1/Drizzle wiring, the
examples surface, the auth-header helper) is dropped in the move rather than
carried into this repo.

## Consequences

**Easier.** A protocol change that breaks the web client now fails a PR instead
of a user's afternoon. Studio's invariants become reviewable in the same diff as
the code they describe — the stale routing assertion this move surfaced is the
first instance, not the last. Contributors get `task studio:dev` next to
`task site:dev`, and the two clients no longer diverge in how they are run.

**Harder, and honestly.** The repo now carries an npm dependency tree (~460
packages) and a second package ecosystem for reviewers to reason about; the
`studio` CI job adds a Node install to every PR. Studio's suite is a
BUILD-plus-source-invariant suite, not a browser test — it proves the app
compiles, server-renders, and still contains its safety-critical shapes; it does
NOT prove a panel works against a live daemon. That gap is deliberate for now
(an offline-daemon integration test is the obvious next step) and should not be
mistaken for coverage it does not have.

**Committed to.** The `mecated` HTTP/SSE surface is now a client-facing contract
with an in-repo consumer, so a breaking change to it owes a Studio update in the
same PR — the same rule `user-docs/` already carries for user-facing behavior.

## See also

- `studio/CLAUDE.md` — how to run it, and what the module may depend on. (Agent
  guidance, not product docs, so it sits outside the matlatl corpus — the same
  treatment `website/CLAUDE.md` gets.)
- [ADR 0002](./0002-documentation-lifecycle.md) — the documentation lifecycle this record follows.
- [ADR 0036](./0036-engine-module.md) — the engine module boundary, and why Studio deliberately sits outside it.
- [ADR 0102](./0102-toolhive-direct-mode.md) — the ToolHive LLM gateway path Studio prefers as its provider.
