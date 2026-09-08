# ADR 0310 — Signed native Darwin release archives

- Status: Accepted
- Date: 2026-09-08
- Scope: GitHub Release distribution for native Apple Silicon operator binaries
- Supersedes: none
- Superseded by: none

## Context

Mecatl publishes Linux OCI images and a Helm chart, but macOS operators have had to build `mecated` and `mecatui` from source. A native archive is useful only if its filename and embedded version are predictable and if operators can authenticate the downloaded bytes without trusting a long-lived release key.

The existing root `v*` release workflow already uses GitHub OIDC and pinned Cosign tooling for keyless OCI signatures. Native distribution must not widen or couple the existing OCI and Helm jobs, publish unrelated binaries, or grant their permissions to a new job.

## Decision

For each root `v*` release, build only `mecated` and `mecatui` as CGO-free Darwin arm64 binaries on a macOS runner. Stamp both binaries' `internal/buildinfo.BuildID` with the exact release tag and smoke-test their `--version` output before packaging.

Publish one stable `mecatl-<version>-darwin-arm64.tar.gz` GitHub Release asset containing a versioned top-level directory and those two executables. Publish its SHA-256 file and a Cosign keyless bundle beside it. Sign the archive with the release workflow's GitHub OIDC identity, then verify both the Cosign bundle and checksum before creating or updating the GitHub Release.

Give the native publisher only `contents: write` and `id-token: write`. Keep the existing OCI image and Helm jobs, dependencies, and permissions unchanged. Re-running a release may replace the three version-addressed assets after verification.

Keep archive assembly in one offline-testable script. Pin the release workflow's build, package inventory, naming, permissions, sign-before-verify-before-upload order, and deterministic packaging behavior with an offline contract test. Exercise the same exact-stamp native builds in the existing macOS CI job.

## Consequences

Apple Silicon operators gain a small native distribution with an explicit checksum and offline-verifiable Sigstore bundle. The certificate identity remains tied to this repository's release workflow and GitHub's OIDC issuer; consumers must verify both constraints.

The archive does not include `mecademo`, `mecatequi`, `mecak8s`, Intel macOS, Linux executables, installers, notarization, or Apple code signing. Gatekeeper policy remains an operator concern. GitHub Release publication now depends on the macOS runner and Sigstore availability, independently of the unchanged OCI and Helm jobs.

## See also

- [Install and verify native macOS binaries](../usage/install.md#native-apple-silicon-release)
- [Documentation lifecycle](./0002-documentation-lifecycle.md)
- [GitHub Release workflow](../../.github/workflows/release.yml)
