#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP="$ROOT_DIR/scripts/courseintellect-uploads-backup"
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/uploads/nested" "$work/backups"
printf 'alpha\n' > "$work/uploads/a file.txt"
printf 'beta-data' > "$work/uploads/nested/b.txt"
chmod 0750 "$work/backups"

cat > "$work/bin/rsync" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
src="${@: -2:1}" dst="${@: -1}"
mkdir -p "$dst"
cp -a "$src"/. "$dst"/
if [[ "${MOCK_RSYNC_CORRUPT:-0}" == 1 ]]; then printf 'corrupt' >> "$dst/a file.txt"; fi
MOCK
chmod +x "$work/bin/rsync"

run_backup() {
  env PATH="$work/bin:$PATH" \
    COURSE_INTELLECT_UPLOADS_ROOT="$work/uploads" \
    COURSE_INTELLECT_UPLOADS_BACKUP_ROOT="$work/backups" \
    COURSE_INTELLECT_UPLOADS_BACKUP_ID="${1:-snapshot}" \
    MOCK_RSYNC_CORRUPT="${MOCK_RSYNC_CORRUPT:-0}" \
    bash "$BACKUP"
}

output="$(run_backup snapshot)"
[[ "$output" == "Uploads backup created: $work/backups/snapshot" ]] || fail "unexpected success output"
snapshot="$work/backups/snapshot"
[[ -f "$snapshot/MANIFEST.sha256" && -f "$snapshot/MANIFEST.meta" ]] || fail "manifest artifacts missing"
[[ "$(stat -c '%a:%U:%G' "$work/backups")" == '700:root:root' ]] || fail "backup parent is not 0700 root:root"
[[ "$(stat -c '%a:%U:%G' "$snapshot")" == '700:root:root' ]] || fail "snapshot root is not 0700 root:root"
expected_count=0
expected_bytes=0
while IFS= read -r -d '' file; do
  ((expected_count += 1))
  ((expected_bytes += $(stat -c '%s' -- "$file")))
done < <(find "$work/uploads" -type f -print0)
grep -Fxq "files=$expected_count" "$snapshot/MANIFEST.meta" || fail "manifest file count mismatch"
grep -Fxq "bytes=$expected_bytes" "$snapshot/MANIFEST.meta" || fail "manifest byte count mismatch"
(
  cd "$snapshot/data"
  sha256sum --check ../MANIFEST.sha256 >/dev/null
) || fail "published checksum manifest does not verify"

MOCK_RSYNC_CORRUPT=1
if run_backup corrupt >"$work/failure.out" 2>"$work/failure.err"; then
  fail "source/snapshot parity failure unexpectedly succeeded"
fi
[[ ! -e "$work/backups/corrupt" ]] || fail "failed snapshot was published"
[[ ! -s "$work/failure.out" ]] || fail "failed backup emitted a success path"

printf 'Uploads backup success, parity-failure, and permission tests passed.\n'
