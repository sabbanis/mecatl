---
id: 07-docs-aggregate
title: Documentation and aggregate repository proof
blocked_by: [02-dependency-engine-frontmatter, 03-strict-root-config-adapters, 04-settings-document-editor, 05-lenient-readers, 06-compatibility-security-matrix]
status: pending
branch: "plan-goccy-yaml-migration/07-docs-aggregate"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/goccy-yaml-migration
---

# Task brief

Aggregate the completed migration and update living documentation only after all
parser behavior is proven. Replace current-behavior yaml.v3 references with
goccy in `AGENTS.md`, `docs/architecture.md`,
`docs/architecture/extensibility.md`, and
`docs/design/IMPLEMENTATION-NOTES.md`; update parser-specific comments and
allowlists where needed. Do not edit the acceptance plan or ADR. Regenerate
`llms.txt` through the documented docs/generate task rather than by hand.

Run the repository-level proof that goccy remains constrained to parser-owning
adapter/command packages, engine layering and standalone closure remain intact,
and all root/engine gates plus the offline demo pass after tidy/sync. Address
only integration defects exposed by those gates; do not enlarge YAML syntax or
configuration surface.

## Acceptance criteria

- AC7.2: goccy is allowed only where the current parser dependency belongs, and engine domain/port/agent layering remains unchanged.
  - verify: inspection — `task lint` runs depguard, vet, and the engine layering checks.
- AC7.3: the engine independently resolves, builds, and tests with goccy in its small standalone closure and no root-module dependency.
  - verify: inspection — `task test:engine-standalone` is the standalone module proof.
- AC7.4: root and engine tests, API compatibility, and the offline demo remain green after module tidy/sync.
  - verify: inspection — `task test`, `task api:check`, and `go run ./cmd/mecademo` cover the repository gates and offline demo.

## Worker notes

This is an aggregate/docs scope, not a parser rewrite. Keep repairs small and
within a 200–400 LoC-ish worker scope. Run `task docs` for Markdown changes and
then the listed gates; do not commit, alter the plan, or alter ADR 0244.
