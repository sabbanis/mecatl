# CLAUDE.md — studio/

Studio is mecatl's web client (the Atrium workspace): a Next.js **Node module,
never a Go module** — not in `go.work`, the layering DAG, depguard, or the
api-compat gate. It consumes only the daemon's public HTTP/SSE API. See ADR
0287 (`docs/adr/0288-studio-atrium-module.md`).

> Studio is landing as a stacked PR series; this file grows with the module.
> Until the series completes, the rules below cover what is in the tree.

## Rules that have teeth

- **Daemon-only.** No mock layer, no demo fallbacks: an unreachable daemon is a
  rendered offline state. Never add fixture content behind a probe failure.
- **npm, pinned.** Node from `.nvmrc`; the lockfile is regenerated only with
  the pinned npm (`npx -y npm@10.9.4 install`) — npm 11 rewrites it into a
  shape CI's npm 10 rejects. Installs run `--ignore-scripts`.
- **License headers.** Everything under `studio/` is `Apache-2.0`; CI greps
  away any stray Proprietary SPDX header regression.
- **Gates.** `npm run lint` (Biome), `npm run typecheck`, `npm run knip`
  (dead code/exports/deps), `npx vitest run`, `npm run build` — all green
  before commit. Root docs gates still apply to any Markdown change.
