# Signed Darwin arm64 release archive — acceptance plan

**Phase:** focused distribution capability
**Status:** landed in this Combined candidate; authoritative on merge
**Issue:** [stacklok/mecatl#891](https://github.com/stacklok/mecatl/issues/891)
**ADR:** [ADR-0318](../adr/0318-signed-darwin-release-archives.md)
**Contract:** human-reviewed/v1
**Delivery:** Combined
**Expected tasks:** 1
**Combined rationale:** This is one additive workflow job, one packaging script, and its offline contract test; splitting the plan from implementation would add no useful interface-review boundary.

## Scope

Add only the native Apple Silicon distribution path. Existing OCI image and Helm publication remain independent and unchanged.

## Out of scope

Intel macOS, Linux or Windows archives, installers, Apple code signing/notarization,
additional binaries, and changes to existing OCI or Helm publication.

### Scenario 1 — A macOS operator verifies and runs the tagged binaries

Under [ADR-0318](../adr/0318-signed-darwin-release-archives.md), a root `v*` release builds only native `mecated` and `mecatui`, stamps both with the exact tag, packages them under a stable versioned archive name, emits a SHA-256 and keyless Cosign bundle, verifies both before upload, and publishes with narrowly scoped authority. The existing macOS CI job smoke-tests the same build target.

**Acceptance:**

- AC1.1: Repeated offline packaging of identical executable inputs and a valid version produces byte-identical archives with exactly one versioned directory containing `mecated` and `mecatui`; unsafe versions and pre-existing outputs fail closed.
  - verify: none — `.github/scripts/darwin-release-workflow_test.sh` is the deterministic offline shell proof outside Go test discovery
- AC1.2: The Darwin publisher runs on macOS, stamps both binaries with the exact tag, smoke-tests `--version`, signs and verifies the archive before upload, and has only contents-write and OIDC-token-write authority.
  - verify: none — `.github/scripts/darwin-release-workflow_test.sh` pins the workflow job and ordering offline
- AC1.3: macOS CI compiles and executes both exact-stamped native binaries through the same Taskfile target used by release.
  - verify: none — the `managed-temp-macos` CI job executes the native smoke contract on a real macOS runner
- AC1.4: Operator documentation names all three assets and gives checksum and certificate-identity-constrained Cosign verification commands.
  - verify: none — documentation is gated by `task docs` and the workflow contract pins the asset names

## Interface contract

- **gRPC / protobuf:** None — distribution does not alter a wire contract.
- **Exported Go APIs / interfaces:** None — only the existing private linker stamp is set.
- **Tool schemas:** None — no model-facing tool changes.
- **CLI / config:** None — existing `--version` output is smoke-tested without adding flags.
- **Events / persistence:** None — release artifacts do not affect runtime state.
- **Security / authority:** None — no runtime security or authority interface changes; the workflow-only least-privilege and signing contract is pinned by ADR-0315 and the offline test.
- **Compatibility / migration:** Additive Darwin arm64 GitHub Release assets; OCI and Helm jobs are unchanged, and source builds remain supported.

## Definition of done

The offline contract, macOS-native smoke wiring, documentation gates, lint, tests,
build, and offline demo pass; no commit, push, release, or GitHub mutation is made.

## Human decisions

None — issue #891 and the investigated minimal plan already fix platform, binary inventory, naming, exact version stamp, checksum, keyless trust material, pre-publication verification, and least privilege.

## Task

1. Add the narrowly scoped Taskfile build, deterministic package/contract scripts, release publisher, macOS smoke, ADR, and operator documentation; run offline workflow, docs, lint, test, build, and demo gates.
