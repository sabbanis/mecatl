---
id: 05-lenient-readers
title: Lenient and fail-safe reader migration
blocked_by: [01-parser-capability-baseline, 02-dependency-engine-frontmatter]
status: pending
branch: "plan-goccy-yaml-migration/05-lenient-readers"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/goccy-yaml-migration
---

# Task brief

Migrate intentionally tolerant root readers while retaining their availability
posture: ToolHive detection, workspace-trust registry state, and mecatui state
and keymap readers. Use the safe diagnostic boundary for parser failures.
Malformed optional input must retain its documented fallback/skip behavior,
never crash startup, never reveal YAML-derived content, and never change
ToolHive's loopback-only `Config.BaseURL` derivation.

This task does not own strict `permconfig` decode mechanics (task 03), although
it must preserve the malformed permission reload's externally visible
fail-safe behavior. It also does not own cross-tier source security tests (task
06).

## Acceptance criteria

- AC1.2: malformed YAML reported by lenient/fail-safe root readers is value-free even when the input contains credential-shaped values, quotes, comments, indentation traps, or parser-looking text.
  - verify: `TestGoccyYAMLMigration_Scenario1_FailSafeDiagnosticsNeverEchoYAML`
- AC5.1: ToolHive detection keeps its forward-compatible unknown-field behavior and malformed/no-config/untrusted fallback, while `Config.BaseURL` remains `http://127.0.0.1:<port>/v1` and never derives a request host from `gateway_url` or another YAML value; diagnostics expose no parser-derived content.
  - verify: `TestGoccyYAMLMigration_Scenario5_ToolHiveUnknownFieldsFallbackAndLoopbackBaseURL`
- AC5.2: malformed mecatui state and keymap YAML preserves the existing local fallback/error behavior without breaking startup or exposing YAML content.
  - verify: `TestGoccyYAMLMigration_Scenario5_MecatuiReadersRetainFallbacks`
- AC5.3: a malformed permission config still follows its documented bounded skip/report path, including strict nested sections and lost-rule counts, rather than silently applying a partial policy.
  - verify: `TestGoccyYAMLMigration_Scenario5_PermissionReloadFailsSafeWithoutPartialPolicy`
- AC5.4: malformed workspace-trust YAML retains the documented untrusted fallback and emits no parser-derived content.
  - verify: `TestGoccyYAMLMigration_Scenario5_WorkspaceTrustFailsSafeAndValueFree`

## Worker notes

Keep the changes and focused tests within a 200–400 LoC-ish worker scope. Avoid
turning optional malformed files into hard failures or silently accepting strict
content. Run targeted reader tests and a mecatui startup-oriented test path.
