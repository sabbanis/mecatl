# ADR 0225 — Mecatl Studio as an in-repo module

- Status: Accepted
- Date: 2026-08-14
- Scope: `studio/` — the web client for the harness; its relationship to the Go modules and to `website/`

## Context

Mecatl Studio grew outside this repository as a web client for the public
HTTP/SSE API. That separation left it without CI, coupled it to one developer's
checkout path, and allowed the daemon protocol and the client view model to
drift. One result was especially misleading: a provider failure with
`result.stop == "error"` rendered as a successful empty turn.

`website/` already proves that a Node module can live in this Go monorepo with
its own package manifest, Taskfile namespace, dependency automation, and CI.
Studio needs that same lifecycle without becoming part of the Go dependency
graph or another composition root.

The deployment shape also has two first-class targets: a single-user developer
machine, and a separately operated daemon such as a Kubernetes deployment. The
web tier must not assume that it owns the daemon process or its credentials.

## Decision

Studio lives at `studio/` as a Node module:

- It has its own `package.json`, lockfile, `Taskfile.yml`, pinned Node version,
  Dependabot entry, and path-scoped CI workflow. CI builds, behavior-tests,
  lints, type-checks, and rejects high-severity npm advisories.
- It is NOT a Go module and never enters `go.work`, the layering DAG, depguard,
  or the engine API-compatibility gate. It imports nothing from `engine/` or
  `internal/`.
- It consumes only `mecated`'s public HTTP/SSE API through server-side Next.js
  route handlers. No Cloudflare Worker, image-optimization worker, D1/R2
  binding, or vinext hosting layer is part of the application.
- It has two pure modes:
  - **managed** (default): a loopback controller chooses a free HTTP port,
    spawns and supervises `bin/mecated`, generates a per-process bearer token,
    and resolves the repository workspace from its own location;
  - **external**: `MECATL_BASE_URL` points the server-side proxy at an existing
    daemon, `MECATL_AUTH_TOKEN` is injected by that proxy, `MECATL_WORKSPACE`
    supplies the session workspace, and `MECATL_STUDIO_PUBLIC_ORIGIN` pins the
    browser origin. No controller is started
    and local provider/router/MCP mutation controls are disabled.
- Provider secrets are never accepted by the browser or controller. Managed
  mode selects a provider with `MECATL_STUDIO_PROVIDER`; `mecated` reads the
  credential from its normal `auth.yaml` seam and fails with an actionable path
  when the selected provider is unavailable.
- The controller pins loopback `Host`, allowlists `Origin`, and requires a
  server-injected header for control mutations. Its child-only MCP proxy uses an
  unguessable path, caps request bodies, accepts HTTPS targets, and permits
  loopback HTTP only through an operator environment opt-in.
- Wire JSON is decoded at a typed runtime seam and covered with behavior tests.
  Event kinds that this Studio version does not render are surfaced to the user
  instead of silently disappearing.

The imported starter and demo residue is not part of this module: the Worker
hosting files, Vite/vinext adapter, Playwright marketing walkthrough, voiceover
scripts, and their dependencies are removed.

## Consequences

Protocol, rendering, proxy-auth, deployment-mode, CSRF, and egress-policy
regressions now fail in the same repository as the daemon change. A clone can
run managed mode without editing a path, while a containerized web tier can
connect to a separately operated daemon without inheriting process-management
duties.

The repository carries a second package ecosystem and a server-rendered web
runtime. The current suite uses a fake authenticated daemon plus pure wire and
controller-policy tests; it does not yet drive a real offline `mecated` binary.
Generated TypeScript bindings from `contracts/proto/mecatl/v1` remain a follow-up
because adopting a repository-wide TS code-generation toolchain is distinct
from moving and securing the client. Until then, the runtime decoder is the
single browser seam and malformed envelopes fail there.

The HTTP/SSE surface now has an in-repo consumer. A breaking wire change owes a
Studio update in the same PR.

## See also

- `studio/CLAUDE.md` — module commands and invariants.
- [ADR 0002](./0002-documentation-lifecycle.md) — documentation lifecycle.
- [ADR 0036](./0036-engine-module.md) — the engine module boundary.
- [ADR 0087](./0087-mecatui-staged-transport-migration.md) — the embedded-versus-external client precedent.
