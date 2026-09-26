# Fork qualification release procedure

This procedure cuts and verifies the fork-owned `mecated` artifact used as one
input to I2I `remote-read-only-v1` qualification. It implements
[ADR 0352](../adr/0352-controlled-fork-qualification-release.md) and the
[approved acceptance contract](../acceptance/fork-only-qualification-release.md).
It does not publish an upstream Mecatl release, approve a runtime configuration,
or authorize a remote task.

## Authority boundary

Only an exact `v0.0.39-i2i.N` tag contained by
`i2i/model-only-one-shot-v0.0.39-baseline` can start the workflow. The tag commit
must also contain runtime merge `a607746a59b1ad61ac2331db7827b31b0a03919d`.
The tag event—not a branch or manual dispatch—binds the accepted Sigstore
identity:

```text
https://github.com/sabbanis/mecatl/.github/workflows/qualification-release.yml@refs/tags/v0.0.39-i2i.N
```

The workflow can write only this repository's GitHub Release and attestation
records. It receives no package, cloud, model, product-metrics, or
external-repository credential.

## Before creating a tag

Run the offline gates from a clean checkout of the human-merged implementation
commit:

```sh
task qualification-release:check
task qualification-release:snapshot
task qualification-release:verify
task lint
task test
task docs
go run ./cmd/mecademo
```

The snapshot uses the representative identity `v0.0.39-i2i.1`, performs no
upload or signing, and omits SBOM generation so it requires no online identity
or release credentials. It must produce exactly four flat archives containing
only `mecated` and `LICENSE`, plus a schema-v1 manifest and checksum root.

## Create the release

Select the next unused positive integer. Confirm the exact full commit is on the
pinned branch, then create and push one immutable tag:

```sh
git merge-base --is-ancestor COMMIT origin/i2i/model-only-one-shot-v0.0.39-baseline
git tag v0.0.39-i2i.N COMMIT
git push origin v0.0.39-i2i.N
```

Do not move or recreate a pushed tag. The workflow creates a draft, verifies or
uploads the closed asset set, re-downloads every asset to compare its SHA-256,
then publishes the draft as a qualification-only prerelease. A rerun of the
original tag event may complete missing draft assets or verify an identical
published release. Any metadata or digest conflict fails without overwriting or
deleting evidence.

## Verify from a clean consumer

Download the release assets and pin their observed digests outside the release
repository. Verify the signed checksum root with the exact tag identity:

```sh
cosign verify-blob \
  --certificate-identity 'https://github.com/sabbanis/mecatl/.github/workflows/qualification-release.yml@refs/tags/v0.0.39-i2i.N' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  --bundle checksums.txt.sigstore.json checksums.txt
sha256sum --check checksums.txt
gh attestation verify qualification-manifest.json --repo sabbanis/mecatl
```

Inspect `qualification-manifest.json` and record all of the following in the I2I
qualification report:

- exact tag and source commit;
- required baseline commit;
- archive name and SHA-256 for the selected target;
- extracted `mecated` binary SHA-256;
- exact signer identity and OIDC issuer;
- manifest and SBOM digests;
- `build_id` equal to the exact tag;
- `product_metrics_enabled` equal to `false`.

Extract only the selected archive and confirm `mecated --version` reports the
exact tag. An archive published for another target is a candidate, not evidence
that target has passed runtime qualification.

## Downstream gates remain separate

The immutable release resolves only the Mecatl artifact blocker. I2I must still
bind and verify its own client artifact, approved non-mock model route and
operator configuration, protected transport and authorization, bounded event
sequence, usage, result, and cleanup. No route is admitted from release evidence
alone.

Infrastructure provisioning, ephemeral compute, scheduling, metering, billing,
and Factory Compiler integration remain outside this workflow. Upstream
contribution planning is also deferred until after the product launch.
