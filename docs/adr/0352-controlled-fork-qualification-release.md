# ADR 0352 — Controlled fork qualification releases

- Status: Proposed
- Date: 2026-09-25
- Scope: immutable fork artifact publication for independently qualified model-only deployments
- Supersedes: none
- Superseded by: none

## Context

The model-only one-shot runtime from ADRs 0350 and 0351 is merged on the
`sabbanis/mecatl` fork's pinned `v0.0.39` source line. Source tests and an
authenticated loopback run prove behavior, but they do not give an external
consumer an immutable downloadable binary, a stable artifact digest, a software
bill of materials, or a fork-owned signing and provenance identity.

Mecatl's existing release workflow is intentionally broader. A root `v*` tag can
publish multiple binaries, images, a chart, a GitHub Release, and a Homebrew
formula, and some jobs write outside this repository. It is guarded against
non-main tags and represents the upstream Stacklok release identity. Reusing it
for an I2I qualification fork would either fail its source guard or grant a
qualification tag unrelated product, registry, and cross-repository authority.

The qualification channel must close that evidence gap without presenting the
fork as an upstream release, enabling telemetry, approving a deployment, or
coupling I2I source into Mecatl.

## Decision

1. Add a dedicated fork workflow and GoReleaser configuration for qualification
   artifacts. The workflow is independent of the general release workflow and
   may not invoke its image, chart, package, TUI, or Homebrew publication paths.
2. Reserve exact tags `v0.0.39-i2i.N`, with positive non-zero `N` and no leading
   zeroes. Publication runs only on matching tag-push events. Before any job
   receives write or OIDC authority, the peeled tag commit must descend from
   model-only merge `a607746a59b1ad61ac2331db7827b31b0a03919d` and be an
   ancestor of `origin/i2i/model-only-one-shot-v0.0.39-baseline`.
3. Publish only `mecated` for Darwin and Linux on amd64 and arm64. Each flat
   archive contains `mecated` and `LICENSE`. No mutable alias or `latest` tag is
   created.
4. Build statically with trimpath, stamp the exact tag as the existing BuildID,
   and explicitly bake an empty product-metrics key. Qualification builds do not
   read the product-metrics release secret and cannot phone home through that
   pipeline.
5. Publish a canonical schema-v1 qualification manifest binding the tag, source
   commit, required baseline, build identity, disabled-metrics assertion,
   target, archive SHA-256, and extracted-binary SHA-256. Wall-clock and runner-
   local values are excluded so reruns can be compared exactly.
6. Publish SHA-256 checksums, an SPDX-JSON SBOM per archive, keyless Sigstore
   bundles for each archive and the checksum/manifest roots, and GitHub SLSA
   provenance for the published subjects. Consumers pin the fork workflow at
   the exact tag as certificate identity and GitHub's OIDC issuer.
7. The workflow is read-only by default. Only the guarded publication job gets
   this repository's `contents: write`, `id-token: write`, and
   `attestations: write`; no package permission, cloud credential, model
   credential, PAT, GitHub App token, or external-repository grant is present.
   Third-party actions are pinned by full commit SHA.
8. Serialize runs by exact tag without cancellation. Publication is append-only:
   a retry may verify identical existing state or complete a matching draft, but
   any asset or metadata conflict fails without replacement, deletion, or
   retagging.
9. Mark every release prerelease and qualification-only. The artifacts establish
   build identity and integrity only; they do not approve runtime configuration,
   deployment identity, authorization, tenant isolation, remote execution,
   hosted availability, or upstream support.

## Consequences

I2I and other explicit consumers can pin one fork artifact by tag, archive digest,
extracted binary digest, signer identity, and provenance instead of trusting a
developer-local build. The manifest gives the downstream qualification record a
stable machine-readable bridge without importing either repository's source.

The release surface is intentionally redundant with part of the general release
configuration. That duplication is preferable to letting a narrow tag inherit
image, chart, Homebrew, package, telemetry, or external-write behavior. Shared
behavior must not be factored into a reusable workflow unless a later ADR
preserves both authority boundaries explicitly.

A tag can be created only after the implementation workflow is merged onto the
pinned branch, so the first released commit will descend from the runtime merge
rather than equal it. The two ancestry checks preserve the reviewed source line
while allowing the release machinery itself to be added.

The fork and GitHub remain trust anchors. Signatures and attestations make
substitution visible; they do not prevent an authorized repository administrator
from changing future source or governance. Consumers therefore retain exact
digests and do not accept a tag name alone.

## Rejected alternatives

**Reuse `.github/workflows/release.yml`.** Rejected because its `origin/main`
guard represents a different source authority and its successful path can publish
images, charts, TUI archives, Homebrew updates, mutable tags, and cross-repository
writes unrelated to qualification.

**Treat the local source build as the qualified artifact.** Rejected because a
worktree binary has no stable download identity, fork-owned signature, SBOM,
provenance, or independent reproduction and retention boundary.

**Publish only a container image.** Rejected because the first qualified I2I
client launches a host-native daemon on macOS, while later ephemeral compute
needs Linux. A daemon-only native matrix supports both without adding registry
authority.

**Require the tag to equal the runtime merge commit.** Rejected because the
release workflow and its reviewed contract must themselves be present at the
tagged commit. Descendant-of-baseline plus ancestor-of-pinned-branch expresses
the intended source authority without permitting an arbitrary side branch.

**Permit manual dispatch or overwrite assets during recovery.** Rejected because
a branch-dispatch OIDC subject would differ from the accepted tag identity, and
overwrites would let one tag resolve to different bytes over time. GitHub's rerun
of the original tag event retains the desired identity; conflicts fail closed.

**Bundle the I2I client or configuration.** Rejected because client packaging,
operator configuration, and route admission are downstream authority boundaries
with independent versions and evidence.

## See also

- [Fork-only Mecatl qualification release acceptance plan](../acceptance/fork-only-qualification-release.md)
- [ADR 0319 — Signed release archives and Homebrew tap distribution](./0319-release-archives-and-homebrew-tap.md)
- [ADR 0350 — Construction-time model-only sessions and explicit compaction-off](./0350-model-only-profile-and-compaction-off.md)
- [ADR 0351 — Bounded one-shot model-only runs](./0351-bounded-one-shot-model-only-runs.md)
- [Model-only one-shot profile acceptance plan](../acceptance/model-only-one-shot-profile.md)
