#!/usr/bin/env bash
# Append-only publisher for the fork-owned Mecatl qualification prerelease.
set -euo pipefail

tag=${QUALIFICATION_TAG:?QUALIFICATION_TAG is required}
dist=${QUALIFICATION_DIST:-dist/qualification}
repo=${GH_REPO:-${GITHUB_REPOSITORY:-}}
if [[ $repo != sabbanis/mecatl ]]; then
  echo "qualification releases may publish only to sabbanis/mecatl, got: $repo" >&2
  exit 1
fi
if [[ ! $tag =~ ^v0\.0\.39-i2i\.[1-9][0-9]*$ ]]; then
  echo "invalid qualification tag: $tag" >&2
  exit 1
fi
if [[ ! -d $dist ]]; then
  echo "qualification dist directory does not exist: $dist" >&2
  exit 1
fi

title="Mecatl $tag fork qualification"
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
notes=$tmpdir/notes.md
cat >"$notes" <<EOF
## Fork qualification only

This prerelease contains the fork-owned, model-only Mecatl daemon used as an
input to I2I remote-read-only-v1 qualification. It is not an upstream Mecatl
release, an approved deployment configuration, or a hosted-service claim.

## Verify

Pin the exact tag and downloaded asset digest. Then verify the signed checksum
root and every payload before extracting the daemon:

\`\`\`sh
cosign verify-blob \\
  --certificate-identity 'https://github.com/sabbanis/mecatl/.github/workflows/qualification-release.yml@refs/tags/$tag' \\
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \\
  --bundle checksums.txt.sigstore.json checksums.txt
sha256sum --check checksums.txt
gh attestation verify qualification-manifest.json --repo sabbanis/mecatl
\`\`\`

The schema-v1 qualification manifest binds both archive and extracted-binary
SHA-256 values. I2I must separately qualify its pinned client, non-mock operator
configuration, protected endpoint, authorization, event stream, and cleanup.
EOF

shopt -s nullglob
archives=("$dist"/*.tar.gz)
sboms=("$dist"/*.tar.gz.spdx.json)
archive_bundles=("$dist"/*.tar.gz.sigstore.json)
roots=(
  "$dist/checksums.txt"
  "$dist/checksums.txt.sigstore.json"
  "$dist/qualification-manifest.json"
  "$dist/qualification-manifest.json.sigstore.json"
)
if [[ ${#archives[@]} -ne 4 || ${#sboms[@]} -ne 4 || ${#archive_bundles[@]} -ne 4 ]]; then
  echo "expected four archives, four SBOMs, and four archive signature bundles" >&2
  exit 1
fi
for root in "${roots[@]}"; do
  [[ -f $root ]] || { echo "missing release root: $root" >&2; exit 1; }
done
assets=("${archives[@]}" "${sboms[@]}" "${archive_bundles[@]}" "${roots[@]}")
declare -A expected=()
for asset in "${assets[@]}"; do
  name=$(basename "$asset")
  if [[ -n ${expected[$name]:-} ]]; then
    echo "duplicate local asset name: $name" >&2
    exit 1
  fi
  expected[$name]=$asset
done

release_json=$tmpdir/release.json
if ! gh release view "$tag" --repo "$repo" --json name,isDraft,isPrerelease,body,assets >"$release_json" 2>"$tmpdir/view.err"; then
  echo "no readable release for $tag; creating a draft" >&2
  gh release create "$tag" \
    --repo "$repo" \
    --verify-tag \
    --draft \
    --prerelease \
    --title "$title" \
    --notes-file "$notes"
  gh release view "$tag" --repo "$repo" --json name,isDraft,isPrerelease,body,assets >"$release_json"
fi

if [[ $(jq -r '.name' "$release_json") != "$title" ]]; then
  echo "release title conflicts with the qualification contract" >&2
  exit 1
fi
if [[ $(jq -r '.isPrerelease' "$release_json") != true ]]; then
  echo "release is not marked prerelease" >&2
  exit 1
fi
# -r appends its own newline even when the JSON string already ends in one.
# -j preserves the release body byte-for-byte, so a safe rerun compares the
# exact GitHub value instead of manufacturing a second trailing newline.
jq -j '.body' "$release_json" >"$tmpdir/remote-notes.md"
if ! cmp -s "$notes" "$tmpdir/remote-notes.md"; then
  echo "release notes conflict with the qualification contract" >&2
  exit 1
fi
is_draft=$(jq -r '.isDraft' "$release_json")

while IFS= read -r remote_name; do
  [[ -z $remote_name ]] && continue
  if [[ -z ${expected[$remote_name]:-} ]]; then
    echo "unexpected existing release asset: $remote_name" >&2
    exit 1
  fi
done < <(jq -r '.assets[].name' "$release_json")

for name in "${!expected[@]}"; do
  local_path=${expected[$name]}
  if jq -e --arg name "$name" '.assets[] | select(.name == $name)' "$release_json" >/dev/null; then
    remote_dir=$tmpdir/existing/$name
    mkdir -p "$remote_dir"
    gh release download "$tag" --repo "$repo" --pattern "$name" --dir "$remote_dir"
    if [[ $(shasum -a 256 "$local_path" | awk '{print $1}') != $(shasum -a 256 "$remote_dir/$name" | awk '{print $1}') ]]; then
      echo "existing asset digest conflicts: $name" >&2
      exit 1
    fi
    continue
  fi
  if [[ $is_draft != true ]]; then
    echo "published release is missing required asset: $name" >&2
    exit 1
  fi
  gh release upload "$tag" "$local_path" --repo "$repo"
done

# Re-read and re-download every asset. This proves newly uploaded and retained
# assets are byte-identical before a draft can become visible as a prerelease.
gh release view "$tag" --repo "$repo" --json name,isDraft,isPrerelease,body,assets >"$release_json"
if [[ $(jq '.assets | length' "$release_json") -ne ${#expected[@]} ]]; then
  echo "remote asset count does not match the closed qualification set" >&2
  exit 1
fi
for name in "${!expected[@]}"; do
  jq -e --arg name "$name" '.assets[] | select(.name == $name)' "$release_json" >/dev/null || {
    echo "remote release is missing asset after upload: $name" >&2
    exit 1
  }
  remote_dir=$tmpdir/final/$name
  mkdir -p "$remote_dir"
  gh release download "$tag" --repo "$repo" --pattern "$name" --dir "$remote_dir"
  if [[ $(shasum -a 256 "${expected[$name]}" | awk '{print $1}') != $(shasum -a 256 "$remote_dir/$name" | awk '{print $1}') ]]; then
    echo "remote asset digest changed: $name" >&2
    exit 1
  fi
done

if [[ $(jq -r '.isDraft' "$release_json") == true ]]; then
  gh release edit "$tag" --repo "$repo" --draft=false --prerelease
fi
gh release view "$tag" --repo "$repo" --json name,isDraft,isPrerelease,body,assets >"$release_json"
if [[ $(jq -r '.isDraft' "$release_json") != false || $(jq -r '.isPrerelease' "$release_json") != true ]]; then
  echo "qualification release did not reach published prerelease state" >&2
  exit 1
fi
echo "published append-only qualification prerelease $tag with ${#expected[@]} assets"
