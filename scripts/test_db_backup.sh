#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP="$ROOT_DIR/scripts/courseintellect-db-backup"
fail() { echo "FAIL: $*" >&2; exit 1; }
[[ -x "$BACKUP" ]] || fail "versioned database backup helper is missing or not executable"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"
printf 'not-a-real-password\n' > "$work/db-password"
chmod 0600 "$work/db-password"

cat > "$work/bin/pg_dump" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'mock custom dump payload\n'
MOCK
cat > "$work/bin/pg_restore" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == --list ]]
[[ -s "${2:-}" ]]
MOCK
chmod +x "$work/bin/pg_dump" "$work/bin/pg_restore"

output="$(
  PATH="$work/bin:$PATH" \
  COURSE_INTELLECT_DB_BACKUP_ROOT="$work/backups" \
  COURSE_INTELLECT_DB_PASSWORD_FILE="$work/db-password" \
  COURSE_INTELLECT_DB_BACKUP_ID=20260824T000000Z \
  "$BACKUP"
)"
expected="$work/backups/courseintellect_prod-20260824T000000Z.dump"
[[ "$output" == "Database backup created: $expected" ]] || fail "unexpected canonical output"
[[ -s "$expected" && -s "$expected.sha256" ]] || fail "backup artifacts missing"
(cd "$work/backups" && sha256sum -c "$(basename "$expected").sha256" >/dev/null)
[[ "$(stat -c '%a:%U:%G' "$work/backups")" == '700:root:root' ]] || fail "backup root permissions are unsafe"
[[ "$(stat -c '%a:%U:%G' "$expected")" == '600:root:root' ]] || fail "dump permissions are unsafe"
[[ "$(stat -c '%a:%U:%G' "$expected.sha256")" == '600:root:root' ]] || fail "checksum permissions are unsafe"

if PATH="$work/bin:$PATH" \
   COURSE_INTELLECT_DB_BACKUP_ROOT="$work/backups" \
   COURSE_INTELLECT_DB_PASSWORD_FILE="$work/db-password" \
   COURSE_INTELLECT_DB_BACKUP_ID='../escape' \
   "$BACKUP" >/dev/null 2>&1; then
  fail "unsafe backup id was accepted"
fi

echo "Database backup output, integrity, and permission tests passed."
