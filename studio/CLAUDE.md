# studio/ — Mecatl Studio, the local web client

A local web client for the harness: chat with tool-call and approval cards, plus
panels for the provider, MCP gateway, semantic model routing, skills, memory, and
scheduled tasks. It talks to `mecated` over the SAME public HTTP/SSE API any
external client would use — see [ADR 0110](../docs/adr/0110-studio-module.md).

**This module is not a Go module.** It is not in `go.work`, the layering DAG, the
depguard allowlists, or the api-compat gate, and `task test` does not run it.

## Commands

Use the root Taskfile's `studio:` namespace — not `npm run` from inside here:

```sh
task build            # FIRST: studio drives ../bin/mecated, so it must exist
task studio:dev       # start Studio + its mecated supervisor (background) at http://localhost:3000
task studio:stop      # stop the web server, the controller, and the supervised mecated
task studio:test      # build + the test suite (what CI runs)
task studio:lint      # ESLint
task studio:typecheck # tsc --noEmit
```

## Shape

- `app/` — the client (a single `page.tsx` view plus `globals.css`).
- `scripts/local-controller.mjs` — the supervisor on `127.0.0.1:8788`. Spawns and
  restarts `../bin/mecated`, owns provider selection and the MCP gateway OAuth
  dance, and reports the resolved workspace on `/status`.
- `scripts/dev-local.mjs` — starts the controller and the web server together.
- `worker/index.ts` — same-origin proxies: `/api/mecatl/*` → mecated (8081),
  `/api/mecatl-control/*` → the controller (8788).
- `tests/rendered-html.test.mjs` — builds the app, asserts it server-renders, and
  pins the source invariants below.

## Rules that have teeth

- **The workspace is resolved, never hardcoded.** The controller derives the repo
  root from its own location and reports it on `/status`; the client refuses to
  open a session until it has one. Do not reintroduce a literal path — the app
  then works on exactly one machine (it did, once).
- **The controller holds no gateway credential.** ToolHive's `thv llm proxy`
  injects a token per request. An OpenRouter key, when the operator connects one,
  lives in the controller's memory for the process lifetime and is never written
  to disk.
- **The memory panel is read-only.** Mecatl curates its own memory through
  injection-scanned tool calls; a value typed into the UI would land in turn-0
  context without passing that check.
- **A failed turn must render as failed.** A provider failure arrives as a
  well-formed `result` carrying `stop:"error"` and no text — the "Done." fallback
  must not swallow it.
- **Skills stay project-scoped.** `--skills-dir` only; never
  `--skills-conventional`, which would widen discovery to the user-global tree.

Each of those has an assertion in `tests/rendered-html.test.mjs`. If you change
the behavior deliberately, change the test in the same commit — a stale assertion
that no longer matches the code is how the routing invariant rotted before this
module moved in-repo.

## Gotcha

`npm test` BUILDS before it asserts, so it is slower than it looks and it fails
on a compile error before any test output appears. `npm run lint` and
`npm run typecheck` are the fast feedback loop.
