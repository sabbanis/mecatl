# Fork-only Mecatl qualification release — acceptance plan

**Contract:** human-reviewed/v2
**Work classification:** Architectural — this creates a durable fork release namespace, source authorization rule, artifact identity, signing/provenance boundary, and publication authority distinct from Mecatl's upstream release channel.
**Decision record:** [ADR 0352](../adr/0352-controlled-fork-qualification-release.md)
**Phase:** I2I `remote-read-only-v1` immutable artifact qualification
**Status:** proposed, 2026-09-25. The runtime baseline is merged on the fork branch; this contract awaits Plan / Interface review before release automation is implemented.
**Delivery:** Split. Tag authority, supply-chain identity, repository permissions, artifact contents, and conflict recovery require human review before a workflow can mint trusted release evidence.
**Expected tasks:** 4
**Issue:** None — this fork capability is tracked by the downstream I2I qualification record.
**Plan PR:** [sabbanis/mecatl#3](https://github.com/sabbanis/mecatl/pull/3)
**Approved baseline:** absent until the Plan / Interface PR merges.

Publish one narrowly scoped, immutable, fork-owned `mecated` prerelease that an
external qualifier can resolve by exact tag and digest. The workflow packages the
merged model-only one-shot source line; it does not turn the fork into Mecatl's
official release channel, publish unrelated products, approve an operator
configuration, or make a hosted-service claim.

The first consumer is I2I's `remote-read-only-v1` qualifier. I2I must still pin
and verify the selected archive, extracted binary, manifest, signature,
provenance, runtime configuration, remote endpoint, and client artifact. Mecatl
publishes evidence; it does not grant execution authority to that consumer.

## Human decisions

- [x] Keep fork publication isolated from the upstream release workflow. — Decision: add a dedicated `qualification-release.yml` workflow and `.goreleaser-qualification.yaml`; do not call or modify the general `release.yml` path to publish qualification artifacts.
- [x] Use a closed tag and source-authority namespace. — Decision: only push events for tags matching exact regular expression `^v0\.0\.39-i2i\.[1-9][0-9]*$` may publish; the peeled tag commit must contain `a607746a59b1ad61ac2331db7827b31b0a03919d` and be an ancestor of `origin/i2i/model-only-one-shot-v0.0.39-baseline`.
- [x] Publish only the daemon required by the profile. — Decision: build `mecated` for `darwin/amd64`, `darwin/arm64`, `linux/amd64`, and `linux/arm64`; exclude `mecatui`, `mecademo`, `mecatequi`, `mecak8s`, images, charts, packages, and Homebrew.
- [x] Make the qualification binary quiet by construction. — Decision: build with `CGO_ENABLED=0`, `-trimpath`, the exact tag as `buildinfo.BuildID`, and an explicitly empty product-metrics baked key; no release secret may enable product metrics.
- [x] Bind human- and machine-readable artifact identity. — Decision: each flat archive contains only `mecated` and `LICENSE`; a versioned JSON qualification manifest binds tag, source commit, required baseline, target, archive SHA-256, extracted-binary SHA-256, build identity, and the disabled-product-metrics assertion.
- [x] Use fork-owned keyless supply-chain evidence. — Decision: publish SHA-256 checksums, an SPDX-JSON SBOM per archive, Sigstore bundles for every archive and the checksum/manifest roots, and GitHub SLSA provenance under the exact fork workflow identity at the release tag.
- [x] Give publication no unrelated authority. — Decision: default workflow permissions are read-only; only the publication job receives this repository's `contents: write`, `id-token: write`, and `attestations: write`. It receives no package permission, PAT, GitHub App token, cloud credential, model credential, or external-repository write.
- [x] Keep tags and assets append-only. — Decision: serialize by exact tag without cancellation; a rerun may verify matching existing assets or add a missing asset to a draft release, but must fail on any same-name digest or release-metadata conflict and must never delete, overwrite, or retag.
- [x] Keep qualification claims downstream and exact. — Decision: every release is marked prerelease and qualification-only, creates no mutable `latest` reference, and conveys no approved configuration, endpoint, tenant isolation, hosted availability, general support, or upstream release status.

## Interface contract

- **gRPC / protobuf:** None — release automation does not change the model-only wire profile, compatibility feature, HTTP mapping, protobuf schema, service, field number, or status mapping.
- **Exported Go APIs / interfaces:** None — the workflow builds the existing `cmd/mecated` main and adds no exported symbol, interface method, module, or engine compatibility obligation.
- **Tool schemas:** None — release metadata is not model-visible and adds no tool, permission, MCP, delegation, or result schema.
- **CLI / config:** No runtime flag or daemon configuration changes. Repository automation adds `.goreleaser-qualification.yaml`, `.github/workflows/qualification-release.yml`, and Taskfile gates `qualification-release:check`, `qualification-release:snapshot`, and `qualification-release:verify`. The public artifact tag grammar is exactly `v0.0.39-i2i.N`, where `N` is a positive base-10 integer without leading zeroes. The binary reports that exact tag through `mecated --version`; the product-metrics linker value is empty.
- **Events / persistence:** No Mecatl runtime event or session persistence changes. GitHub persists one prerelease and its immutable assets at the exact tag. `qualification-manifest.json` uses schema version `1` and records `tag`, `source_commit`, `required_baseline`, `build_id`, `product_metrics_enabled`, and a target array whose entries contain `goos`, `goarch`, `archive`, `archive_sha256`, and `binary_sha256`. Published JSON is canonical and contains no secret, runner path, username, credential, or wall-clock-dependent field.
- **Security / authority:** Publication accepts only the closed tag grammar and both ancestry checks before any write-capable or OIDC step. Every third-party action is pinned by full commit SHA. The accepted signer certificate identity is the dedicated fork workflow at `refs/tags/v0.0.39-i2i.N`, with `N` resolved to the exact release integer, and issuer `https://token.actions.githubusercontent.com`. Release credentials cannot authorize a model route, cloud deployment, I2I grant, or remote task.
- **Compatibility / migration:** This is an additive fork-only prerelease channel. It neither changes nor supersedes upstream `vX.Y.Z`, `.github/workflows/release.yml`, `.goreleaser.yaml`, GHCR tags, Helm charts, Homebrew formulae, Go consumers, or existing Mecatl clients. Consumers opt in by exact tag plus digest; older and upstream builds remain unchanged. A future base version, broadened binary set, changed signer workflow, or altered tag/source rule requires a new reviewed contract rather than widening `v0.0.39-i2i.N` in place.

## In scope — 4 scenarios, in implementation order

### Scenario 1 — Only an authorized fork tag and source commit can publish

A tag trigger is repository authority, not proof that its commit belongs to the
reviewed model-only line. A read-only guard therefore resolves the tag and branch
history before any job receives write or OIDC permissions, as required by
[ADR 0352](../adr/0352-controlled-fork-qualification-release.md).

**Acceptance:**
- AC1.1: The workflow triggers only for the `v0.0.39-i2i.*` GitHub tag prefix, then validates the full exact regular expression and rejects zero, leading-zero, other-version, branch, and manual-dispatch inputs before publication.
  - verify: `TestADR_0352_QualificationRelease_Scenario1_TagAndSourceGuard`
- AC1.2: The peeled tag commit must both descend from exact runtime merge `a607746a59b1ad61ac2331db7827b31b0a03919d` and be contained by `origin/i2i/model-only-one-shot-v0.0.39-baseline`; either failed ancestry test stops every publishing job.
  - verify: `TestADR_0352_QualificationRelease_Scenario1_TagAndSourceGuard`
- AC1.3: Runs serialize on the exact tag with cancellation disabled, checkout does not persist credentials, and no build or publication job can bypass the guard.
  - verify: `TestADR_0352_QualificationRelease_Scenario1_TagAndSourceGuard`

### Scenario 2 — The archive and manifest identify the exact quiet daemon

The artifact is deliberately smaller than Mecatl's general release. Its manifest
lets an external qualifier distinguish archive integrity from the digest of the
extracted executable it will actually launch. This is the daemon-only boundary
selected by [ADR 0352](../adr/0352-controlled-fork-qualification-release.md).

**Acceptance:**
- AC2.1: Exactly four flat archives are generated for the declared OS/architecture matrix; each contains only `mecated` and `LICENSE`, and no unrelated binary or publishing pipe is configured.
  - verify: `TestADR_0352_QualificationRelease_Scenario2_MecatedOnlyArtifacts`; `task qualification-release:verify`
- AC2.2: Every executable is static, trimpath-built, reports the exact release tag, and has product metrics disabled without reading a secret.
  - verify: `TestADR_0352_QualificationRelease_Scenario2_MecatedOnlyArtifacts`; `task qualification-release:verify`
- AC2.3: Canonical schema-v1 `qualification-manifest.json` records the exact source and required baseline plus archive and extracted-binary SHA-256 values for every target; generated checksums agree with the manifest.
  - verify: `TestADR_0352_QualificationRelease_Scenario2_MecatedOnlyArtifacts`; `task qualification-release:verify`

### Scenario 3 — Every artifact has fork-owned integrity and provenance evidence

The accepted identity is the dedicated workflow at the exact tag. Reusing an
upstream identity, a branch-dispatch identity, or an unpinned action is a hard
failure rather than an equivalent release. The narrower authority intentionally
does not inherit [ADR 0319's general release channel](../adr/0319-release-archives-and-homebrew-tap.md).

**Acceptance:**
- AC3.1: Every archive has an SPDX-JSON SBOM, all payload assets are covered by `checksums.txt`, and the archives plus checksum and manifest roots have keyless Sigstore bundles.
  - verify: `TestADR_0352_QualificationRelease_Scenario3_SupplyChainAndLeastPrivilege`; `task qualification-release:verify`
- AC3.2: GitHub build provenance binds the published subject digests to the fork repository, exact tag, source commit, and dedicated workflow; verification pins the exact certificate identity and GitHub OIDC issuer.
  - verify: `TestADR_0352_QualificationRelease_Scenario3_SupplyChainAndLeastPrivilege`
- AC3.3: Workflow permissions and inputs prove there is no package push, cloud access, long-lived signing key, product-metrics secret, model credential, or external-repository mutation path.
  - verify: `TestADR_0352_QualificationRelease_Scenario3_SupplyChainAndLeastPrivilege`

### Scenario 4 — Publication is narrow, recoverable, and independently consumable

A partial run may be retried, but a retry cannot redefine an existing artifact.
Local snapshot gates prove shape and versioning without claiming that an online
signature, attestation, or GitHub Release exists. Shipped versus deferred status
remains explicit in the
[production-readiness record](../design/PRODUCTION-READINESS.md).

**Acceptance:**
- AC4.1: The GitHub Release is a prerelease titled and described as fork qualification-only; publication creates no `latest`, image, package, chart, formula, tap commit, or other repository write.
  - verify: `TestADR_0352_QualificationRelease_Scenario4_PublishAndRecovery`
- AC4.2: An existing same-name asset or release metadata is accepted only when it matches the proposed content and contract; any conflict fails without delete, overwrite, retag, or cancellation.
  - verify: `TestADR_0352_QualificationRelease_Scenario4_PublishAndRecovery`
- AC4.3: Taskfile-owned offline check, snapshot, and verification gates validate configuration, the four-archive matrix, archive contents, manifest/checksum agreement, exact build identity, and disabled metrics without network credentials.
  - verify: `TestADR_0352_QualificationRelease_Scenario4_PublishAndRecovery`; `task qualification-release:check`; `task qualification-release:snapshot`; `task qualification-release:verify`
- AC4.4: Consumer guidance requires exact tag, archive digest, binary digest, signer identity, issuer, provenance, and SBOM verification, and explicitly leaves operator configuration and remote route qualification pending.
  - verify: inspection — the implementation notes, release body, and downstream I2I qualification record preserve the separation; `task docs` validates links and document structure.

## Out of scope

| Item | Defer-to | Decision |
|---|---|---|
| Approved non-mock model route, provider credentials, endpoint policy, and operator configuration | I2I `remote-read-only-v1` requalification | An immutable binary is necessary evidence, not an approved deployment. |
| AWS/GCP/customer-account provisioning, ephemeral compute, scheduling, metering, and billing | I2I ExecutionHost and later Factory Compiler contracts | This workflow publishes a daemon; it provisions and runs nothing. |
| TLS, OIDC/bearer authentication, tenant isolation, workload identity, network policy, and remote cleanup | Qualified deployment and I2I handoff contracts | Existing controls remain independently configured and tested. |
| General Mecatl release, stable support, containers, charts, Homebrew, packages, TUI, or upstream namespace | Upstream release governance | The fork prerelease is intentionally non-substitutable. |
| Bundling, importing, or publishing the I2I client from this repository | I2I package/release process | The repositories compose through pinned external contracts and digests. |
| A base later than `v0.0.39` or a widened tag grammar | A new reviewed release contract | The first channel stays closed and auditable. |

## Definition of done

1. This Plan / Interface PR and ADR 0352 are human-reviewed and merged into `i2i/model-only-one-shot-v0.0.39-baseline`; its full merge commit is recorded before implementation begins.
2. The dedicated workflow, GoReleaser configuration, manifest generator/verifier, Taskfile gates, tests, and operator guidance satisfy every acceptance criterion without changing the general release path.
3. `task lint`, `task test`, `task build`, `task api:check`, `task docs`, `task ac-trace-strict`, and `go run ./cmd/mecademo` pass offline on the implementation candidate.
4. The implementation PR links the approved plan commit, reports interface conformance, receives independent review, and is human-merged before any qualification tag is created.
5. A human-authorized `v0.0.39-i2i.1` tag on the merged implementation commit completes successfully; a clean consumer verifies the archives, manifest, checksums, bundles, SBOMs, and provenance using the pinned fork identity.
6. I2I records the exact accepted artifact and extracted-binary digests, then reruns its separate non-mock configuration and protected remote qualification before admitting the route.

## Deferred decisions and known risks

- GitHub-hosted OIDC, Release, and attestation services are online dependencies. Offline snapshot success proves artifact shape only and cannot substitute for a real tagged run.
- Ancestry proves membership in the designated fork branch, not upstream acceptance or general support. Branch protection and tag creation authority remain repository-governance prerequisites outside the workflow artifact.
- Cross-compilation proves buildability, not host-specific runtime behavior. I2I must qualify the exact target it deploys; unqualified targets remain published candidates only.
- A compromised repository administrator can change workflow or tag governance. Exact workflow identity, source commit, action pins, and consumer-held digests limit silent substitution but do not eliminate forge trust.
- This work resolves the immutable-artifact blocker only. The approved non-mock operator configuration remains a separate blocker and must not be collapsed into release evidence.
