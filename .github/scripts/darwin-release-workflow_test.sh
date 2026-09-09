#!/usr/bin/env bash
# Offline contract test for the Darwin release archive and publisher job.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
workflow="$root/.github/workflows/release.yml"
archive="mecatl-v1.2.3-darwin-arm64.tar.gz"
work="$root/.scratch/darwin-release-contract-test-$$-${RANDOM}"
if ! mkdir "$work"; then
  echo "FAIL: could not create unique test workspace: $work" >&2
  exit 1
fi
cleanup() {
  rm -f -- \
    "$work/one/$archive" "$work/one/$archive.sha256" \
    "$work/two/$archive" "$work/two/$archive.sha256" \
    "$work/bin/mecated" "$work/bin/mecatui" \
    "$work/one/mecatl-v1.2.3-darwin-arm64/mecated" \
    "$work/one/mecatl-v1.2.3-darwin-arm64/mecatui" \
    "$work/two/mecatl-v1.2.3-darwin-arm64/mecated" \
    "$work/two/mecatl-v1.2.3-darwin-arm64/mecatui"
  rmdir "$work/one/mecatl-v1.2.3-darwin-arm64" "$work/two/mecatl-v1.2.3-darwin-arm64" 2>/dev/null || true
  rmdir "$work/one" "$work/two" "$work/bin" "$work" 2>/dev/null || true
}
trap cleanup EXIT
mkdir "$work/bin" "$work/one" "$work/two"
printf '#!/bin/sh\nprintf "mecated v1.2.3\\n"\n' > "$work/bin/mecated"
printf '#!/bin/sh\nprintf "mecatui v1.2.3\\n"\n' > "$work/bin/mecatui"
chmod 0755 "$work/bin/mecated" "$work/bin/mecatui"

bash "$root/.github/scripts/package-darwin-release.sh" v1.2.3 "$work/bin" "$work/one" >/dev/null
bash "$root/.github/scripts/package-darwin-release.sh" v1.2.3 "$work/bin" "$work/two" >/dev/null
cmp "$work/one/$archive" "$work/two/$archive"
(
  cd "$work/one"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "$archive.sha256"
  else
    sha256sum -c "$archive.sha256"
  fi
  checksum_target="$(awk '{print $2}' "$archive.sha256")"
  [[ "$checksum_target" == "$archive" ]] || {
    printf 'FAIL: checksum names non-portable target: %s\n' "$checksum_target" >&2
    exit 1
  }
  members="$(tar -tzf "$archive")"
  [[ "$members" == $'mecatl-v1.2.3-darwin-arm64/\nmecatl-v1.2.3-darwin-arm64/mecated\nmecatl-v1.2.3-darwin-arm64/mecatui' ]] || {
    printf 'FAIL: unexpected archive members:\n%s\n' "$members" >&2
    exit 1
  }
)
if bash "$root/.github/scripts/package-darwin-release.sh" v1.2.3 "$work/bin" "$work/one" >/dev/null 2>&1; then
  echo 'FAIL: pre-existing release output was overwritten' >&2
  exit 1
fi
if bash "$root/.github/scripts/package-darwin-release.sh" '../bad' "$work/bin" "$work/one" >/dev/null 2>&1; then
  echo 'FAIL: unsafe version was accepted' >&2
  exit 1
fi

job_block() {
  awk -v job="$1" '
    $0 == "  " job ":" { in_job = 1 }
    in_job && /^  [[:alnum:]_-]+:$/ && $0 != "  " job ":" { exit }
    in_job { print }
  ' "$workflow"
}
require_once() {
  local haystack="$1" needle="$2"
  [[ "$(grep -Fc -- "$needle" <<<"$haystack")" -eq 1 ]] || {
    printf 'FAIL: contract missing or duplicated: %s\n' "$needle" >&2
    exit 1
  }
}

job_block="$(job_block publish-darwin-arm64)"
[[ -n "$job_block" ]] || { echo 'FAIL: Darwin publisher job is missing' >&2; exit 1; }
for contract in \
  'runs-on: macos-14' \
  'contents: write' \
  'id-token: write' \
  'CANDIDATE_TAG: ${{ inputs.tag || github.ref_name }}' \
  'if [[ ! "${CANDIDATE_TAG}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then' \
  "printf 'VERSION=%s\\n' \"\${CANDIDATE_TAG}\" >> \"\$GITHUB_ENV\"" \
  "printf 'tag=%s\\n' \"\${CANDIDATE_TAG}\" >> \"\$GITHUB_OUTPUT\"" \
  'ref: ${{ steps.release_tag.outputs.tag }}' \
  'BUILD_ID="${VERSION}" task build:darwin-release' \
  'test "$("${BIN_DIR}/mecated" --version)" = "mecated ${VERSION}"' \
  'test "$("${BIN_DIR}/mecatui" --version)" = "mecatui ${VERSION}"' \
  'cosign sign-blob --yes --bundle "${ARCHIVE}.bundle" "${ARCHIVE}"' \
  'cosign verify-blob "${ARCHIVE}"' \
  '--certificate-identity "https://github.com/${{ github.repository }}/.github/workflows/release.yml@refs/tags/${VERSION}"' \
  '--certificate-oidc-issuer https://token.actions.githubusercontent.com' \
  'gh release create "${VERSION}" --verify-tag --generate-notes --title "${VERSION}"' \
  'gh release upload "${VERSION}" --clobber'; do
  require_once "$job_block" "$contract"
done
[[ "$(<"$workflow")" != *'validate-release-tag'* ]] || {
  echo 'FAIL: Darwin tag validation must not couple existing publishers' >&2
  exit 1
}
permission_keys="$(awk '
  /^    permissions:$/ { in_permissions = 1; next }
  in_permissions && /^    [[:alnum:]_-]+:/ { exit }
  in_permissions && /^      [[:alnum:]_-]+:/ {
    key = $1
    sub(/:$/, "", key)
    print key
  }
' <<<"$job_block")"
[[ "$permission_keys" == $'contents\nid-token' ]] || {
  printf 'FAIL: unexpected Darwin publisher permissions:\n%s\n' "$permission_keys" >&2
  exit 1
}
publish_step="$(awk '
  /- name: Publish verified GitHub Release assets$/ { in_step = 1 }
  in_step && /^      - name:/ && $0 !~ /Publish verified GitHub Release assets$/ { exit }
  in_step { print }
' <<<"$job_block")"
require_once "$publish_step" 'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}'
for asset in '"${ARCHIVE}"' '"${ARCHIVE}.sha256"' '"${ARCHIVE}.bundle"'; do
  require_once "$publish_step" "$asset"
done
require_once "$publish_step" '--clobber'
[[ "$(grep -Fc 'GH_TOKEN:' <<<"$job_block")" -eq 1 ]] || {
  echo 'FAIL: GH_TOKEN must be scoped only to the release publication step' >&2
  exit 1
}
sign_line="$(grep -nF 'cosign sign-blob --yes' <<<"$job_block" | cut -d: -f1)"
verify_line="$(grep -nF 'cosign verify-blob "${ARCHIVE}"' <<<"$job_block" | cut -d: -f1)"
upload_line="$(grep -nF 'gh release upload "${VERSION}"' <<<"$job_block" | cut -d: -f1)"
[[ "$sign_line" -lt "$verify_line" && "$verify_line" -lt "$upload_line" ]] || {
  echo 'FAIL: publisher must sign and verify before upload' >&2
  exit 1
}
printf 'Darwin release contract: all checks passed\n'
