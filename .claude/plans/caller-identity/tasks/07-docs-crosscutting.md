---
id: 07-docs-crosscutting
title: Cross-cutting docs — ADR 0027 inventory rows, user-docs flags, architecture note
blocked_by: [04-system-principal-goroutines, 06-schedule-owner]
status: done
branch: "plan-caller-identity/07-docs-crosscutting"
worktree: ""
issue: "367"
retries: 1
last_error: "worker stalled (watchdog, 600s no progress) before creating its branch; zero commits"
accumulator: acc/caller-identity
---

# Task brief

Docs-only. Every code task has landed; this pays the cross-cutting deliverables
`docs/acceptance/caller-identity.md` lists. **Do not change behaviour** — if you
find a code gap, report it as a mis-decomposition rather than fixing it here.

**`docs/adr/0027-cloud-native.md` — three inventory rows** (`AGENTS.md`: anything
whose lifetime outlives one tool call gets a row, and this is the class that has
drifted in unnoticed four times):
- **List 1** (resource inventory): the `toolhive-core/authn` JWKS cache — owner:
  the validator, scope: app lifetime (constructed with the server-root context),
  cleanup: the root context's cancel, re-attach: reconstructed at startup.
- **List 2** (rehydrate-fidelity ledger): the session **owner** — decision:
  **persist-in-snapshot**.
- **List 2**: the `Event.Actor` annotation — decision: **derive-at-append**,
  never persisted as identity-of-record (the session owner is the record).

**`user-docs/`** — the new `--oidc-issuer` / `--oidc-jwks-uri` /
`--oidc-audience` flags. Keep it lean: extend an existing
`user-docs/deployment/*.md` page with a short section plus a link out to the full
reference; a new page only if no existing page covers the area. State plainly
that this phase gives **attribution, not isolation** — nothing is refused yet
(the ADR explicitly asks that this not be oversold). Run `task site:build`
locally — the CI `user-docs` job throws on a broken link.

**`docs/architecture.md`** — a short caller-identity note in the relevant
section (it is the LIVING "how it works" doc): the principal enters at the
`authn.go` edge, rides a context key, the session/schedule record an owner, and
the event log's `Actor` is stamped log-only at `appendEvent`. Cite
repo-root-relative per `docs/design/README.md` — `docs/lint`'s `CheckCitations`
fails CI on a dead citation.

**`docs/usage.md`** — the three new flags in the flag reference, if that doc
enumerates flags (check; do not duplicate if `user-docs` is the only home).

Markdown changed ⇒ `task docs` (llms.txt regen + the matlatl strict link gate) is
mandatory before you report done.

## Acceptance criteria

No numbered `AC` items — this task pays the "Cross-cutting deliverables" section
of `docs/acceptance/caller-identity.md`. Its gate is `task docs` green (llms.txt
regenerated, matlatl `--strict` clean), `task site:build` green, and every
required row/section present as listed above. Add a scaffolding smoke check only
if one is natural; do not invent a test for prose.
