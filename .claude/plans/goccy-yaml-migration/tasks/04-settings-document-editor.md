---
id: 04-settings-document-editor
title: Settings document editor preservation
blocked_by: [01-parser-capability-baseline, 02-dependency-engine-frontmatter]
status: pending
branch: "plan-goccy-yaml-migration/04-settings-document-editor"
worktree: ""
issue: ""
retries: 0
last_error: ""
accumulator: acc/goccy-yaml-migration
---

# Task brief

Migrate the YAML document-node editing paths in
`cmd/mecated/configvalidate.go` (`replaceMappingValue`) and
`cmd/mecatui/learning_settings.go`
(`operatorLearningSettings.withLockedDocument`) to goccy's node API. Add and
use the named preservation fixtures `settings-preserve-top-level.yaml` and
`settings-preserve-learning.yaml`. The editor may change only the intended
learning value and any fixture-declared normalization directly required by that
rewrite.

Preserve the existing single-document, duplicate, alias, symlink, lock, and
atomic-write boundaries. Validation patches remain in-memory and value-free; do
not broaden this task into strict decoding generally (task 03) or UI state/keymap
readers (task 05).

## Acceptance criteria

- AC4.1: a `--learning-patch` replaces or inserts only the top-level learning mapping in memory, validates the complete proposal, never writes or displays the proposed document, and preserves the unrelated semantic content specified by `settings-preserve-top-level.yaml`.
  - verify: `TestGoccyYAMLMigration_Scenario4_LearningPatchPreservesUnrelatedDocument`
- AC4.2: mecatui's learning mode and sensitivity edits match the expected outputs for `settings-preserve-top-level.yaml` and `settings-preserve-learning.yaml`: unrelated values, comments, order, and supported styles survive; every permitted normalization is asserted explicitly.
  - verify: `TestGoccyYAMLMigration_Scenario4_LearningEditorPreservationFixtures`
- AC4.3: the settings editor retains one-document/duplicate/alias protections, does not write on parse or validation failure, and keeps its existing symlink rejection, cross-process lock, and atomic-write behavior; parser migration does not widen its write authority.
  - verify: `TestGoccyYAMLMigration_Scenario4_LearningEditorWriteSafetyUnchanged`

## Worker notes

Limit the slice to editor code, fixtures, and focused tests (about 200–400
LoC-ish). Never silently accept a formatting loss: write each allowed
normalization into expected fixture output. Do not alter public flags or general
configuration formatting behavior.
