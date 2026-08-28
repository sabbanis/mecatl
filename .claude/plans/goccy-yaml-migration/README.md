# Plan: goccy-yaml-migration

Migrate direct YAML parsing in the root and engine modules from `go.yaml.in/yaml/v3`
to `github.com/goccy/go-yaml`, preserving the existing strict, tolerant, and
fail-safe contracts. Parser diagnostics are a security boundary: expose only
harness context and typed token locations, never parser-rendered YAML content.

- **Plan:** [docs/acceptance/goccy-yaml-migration.md](../../../docs/acceptance/goccy-yaml-migration.md)
- **ADR:** [ADR 0244](../../../docs/adr/0244-goccy-yaml-parser.md)
- **Accumulator:** `acc/goccy-yaml-migration` (off `feat/goccy-yaml-migration`)

## Tasks (dependency ordered)

| # | Task | blocked_by |
|---|---|---|
| 01 | [Parser capability baseline and safe diagnostics](tasks/01-parser-capability-baseline.md) | — |
| 02 | [Dependency replacement and engine frontmatter](tasks/02-dependency-engine-frontmatter.md) | 01 |
| 03 | [Strict root configuration adapters](tasks/03-strict-root-config-adapters.md) | 01, 02 |
| 04 | [Settings document editor](tasks/04-settings-document-editor.md) | 01, 02 |
| 05 | [Lenient and fail-safe readers](tasks/05-lenient-readers.md) | 01, 02 |
| 06 | [Configuration-source compatibility and security matrix](tasks/06-compatibility-security-matrix.md) | 03, 05 |
| 07 | [Documentation and aggregate repository proof](tasks/07-docs-aggregate.md) | 02, 03, 04, 05, 06 |

Tasks 03–05 may proceed in parallel once task 02 lands. Task 06 is deliberately
last among behavior changes: it tests cross-source properties against the
migrated adapters rather than introducing another parser abstraction.
