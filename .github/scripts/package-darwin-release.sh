#!/usr/bin/env bash
# Build a reproducible, versioned macOS arm64 release archive from two binaries.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 VERSION BIN_DIR DIST_DIR" >&2
  exit 2
fi
version="$1"
bin_dir="$2"
dist_dir="$3"

if [[ ! "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "invalid release version: $version" >&2
  exit 2
fi
for binary in mecated mecatui; do
  if [[ ! -f "$bin_dir/$binary" || ! -x "$bin_dir/$binary" ]]; then
    echo "missing executable: $bin_dir/$binary" >&2
    exit 2
  fi
done

package="mecatl-${version}-darwin-arm64"
archive="$dist_dir/${package}.tar.gz"
staging="$dist_dir/$package"
mkdir -p "$dist_dir"
if [[ -e "$archive" || -e "${archive}.sha256" || -e "$staging" ]]; then
  echo "release output already exists for $package" >&2
  exit 2
fi
mkdir "$staging"
cp "$bin_dir/mecated" "$bin_dir/mecatui" "$staging/"
chmod 0755 "$staging/mecated" "$staging/mecatui"
# Fixed mtimes and gzip -n keep repeated packaging byte-identical.
touch -t 197001010000 "$staging/mecated" "$staging/mecatui" "$staging"
tar -cf "${archive%.gz}" -C "$dist_dir" "$package"
gzip -n "${archive%.gz}"
archive_name="$(basename "$archive")"
if command -v shasum >/dev/null 2>&1; then
  (cd "$dist_dir" && shasum -a 256 "$archive_name") > "${archive}.sha256"
else
  (cd "$dist_dir" && sha256sum "$archive_name") > "${archive}.sha256"
fi

rm "$staging/mecated" "$staging/mecatui"
rmdir "$staging"
printf '%s\n' "$archive"
