---
id: 03-strict-root-config-adapters
title: Strict root configuration adapters
blocked_by: [01-parser-capability-baseline, 02-dependency-engine-frontmatter]
status: pending
branch: "plan-goccy-yaml-migration/03-strict-root-config-adapters"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/goccy-yaml-migration
---

# Task brief

Migrate strict root parsing paths without changing their contracts:
`internal/adapter/daemonconfig`, `internal/adapter/authfile`,
`internal/adapter/permconfig`, and `cmd/mecated/configvalidate.go` outside its
document-node editor (task 04). Use goccy and the safe diagnostic boundary from
task 01. Strict failures must distinguish schema from syntax where they already
do, preserve no-content diagnostics, and retain all no-follow/bounded-read and
whole-document validation safety checks.

`permconfig` is intentionally different: preserve top-level leniency, targeted
`output-economy` rejection, strict nested-section validation, and lost-rule
accounting. Do not cover editor node preservation, optional readers, or
cross-source matrix tests in this task.

## Acceptance criteria

- AC1.1: malformed YAML reported by strict root readers includes the goccy token line and column when available, and contains neither the offending line nor any attacker-controlled key or scalar.
  - verify: `TestGoccyYAMLMigration_Scenario1_StrictDiagnosticsUseTokenLocationWithoutSource`
- AC2.3: daemon configuration rejects unknown fields, wrong types, malformed syntax, and a second document; its diagnostic preserves the existing distinction between schema and syntax without exposing YAML content.
  - verify: `TestGoccyYAMLMigration_Scenario2_DaemonConfigStrictContract`
- AC2.4: a whole-file auth.yaml schema/decode failure rejects the complete credential snapshot with a value-free warning, while entry-local invalid OAuth/API material found during provider validation drops only that entry/material and retains valid sibling entries.
  - verify: `TestGoccyYAMLMigration_Scenario2_AuthFileWholeFileVsEntryLocalFailure`
- AC2.5: `mecated config validate` retains ADR-0225's read-only safety boundary: it opens only a final-component no-follow, nonblocking regular file, bounded-reads it, never writes either input or prints configuration values, and permits a missing base only when an explicit learning patch preflights a prospective new file.
  - verify: `TestGoccyYAMLMigration_Scenario2_ConfigValidateADR0225Safety`
- AC2.6: config validation still rejects aliases, anchors, duplicate mapping keys, non-mapping roots, multiple documents, and invalid learning-only patches before it claims a document is valid.
  - verify: `TestGoccyYAMLMigration_Scenario2_ConfigValidationSafeDocumentContract`
- AC2.7: permissions/settings decoding remains lenient at the top level, preserves the targeted `output-economy` rejection, and keeps nested strict section validation and lost-rule counting behavior.
  - verify: `TestGoccyYAMLMigration_Scenario2_PermconfigStrictLenientBoundary`

## Worker notes

Keep the implementation and focused regression tests to a manageable
200–400 LoC-ish scope. Do not make a partial policy apply after malformed input;
do not log raw parser errors. Run targeted adapter/cmd tests and relevant
permission configuration tests before handoff.
