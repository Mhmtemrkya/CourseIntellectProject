#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DEPLOY="$ROOT_DIR/scripts/deploy_production_fullstack.sh"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

make_fixture() {
  local fixture="$1"
  mkdir -p "$fixture/repo/scripts" "$fixture/repo/backend" \
    "$fixture/repo/courseintellectmarketingwebsite (1)/deploy" "$fixture/bin" \
    "$fixture/etc" "$fixture/nginx" "$fixture/uploads" "$fixture/releases" \
    "$fixture/old/backend" "$fixture/old/marketing"
  cp "$SOURCE_DEPLOY" "$fixture/repo/scripts/deploy_production_fullstack.sh"
  cp "$ROOT_DIR/scripts/production_preflight.sh" "$fixture/repo/scripts/production_preflight.sh"
  cp "$ROOT_DIR/scripts/apply_production_migrations.sh" "$fixture/repo/scripts/apply_production_migrations.sh"
  cp "$ROOT_DIR/courseintellectmarketingwebsite (1)/deploy/nginx-security.conf" \
    "$fixture/repo/courseintellectmarketingwebsite (1)/deploy/nginx-security.conf"
  cp "$ROOT_DIR/courseintellectmarketingwebsite (1)/deploy/nginx-security-headers.conf" \
    "$fixture/repo/courseintellectmarketingwebsite (1)/deploy/nginx-security-headers.conf"
  printf 'old backend\n' > "$fixture/old/backend/DEPLOYED_COMMIT"
  printf 'old marketing\n' > "$fixture/old/marketing/DEPLOYED_COMMIT"
  ln -s "$fixture/old/backend" "$fixture/backend-current"
  ln -s "$fixture/old/marketing" "$fixture/marketing-current"
  printf 'old security\n' > "$fixture/nginx/schoolasist-security.conf"
  printf 'old headers\n' > "$fixture/nginx/schoolasist-security-headers.conf"
  printf 'TenantCleanup__Enabled=false\nRegistration__Enabled=false\n' > "$fixture/etc/backend.env"
  printf 'COURSE_INTELLECT_CAPTCHA_SECRET="mock-secret-must-not-appear"\n' > "$fixture/etc/backend-secrets.env"
  chmod 0600 "$fixture/etc/backend.env" "$fixture/etc/backend-secrets.env"

  git -C "$fixture/repo" init -q
  git -C "$fixture/repo" config user.email release-test@example.invalid
  git -C "$fixture/repo" config user.name release-test
  git -C "$fixture/repo" add .
  git -C "$fixture/repo" commit -qm fixture
  FIXTURE_SHA="$(git -C "$fixture/repo" rev-parse HEAD)"

  cat > "$fixture/bin/dotnet" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'dotnet %s\n' "$*" >> "$MOCK_LOG"
if [[ "$*" == *"database update"* && "${MOCK_MIGRATION_FAIL:-0}" == 1 ]]; then
  exit 41
fi
out=""
while (($#)); do
  if [[ "$1" == "--output" ]]; then out="$2"; shift 2; else shift; fi
done
if [[ -n "$out" ]]; then mkdir -p "$out"; printf 'published\n' > "$out/CourseIntellect.Api.dll"; fi
MOCK

  cat > "$fixture/bin/npm" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'npm %s\n' "$*" >> "$MOCK_LOG"
if [[ "${1:-}" == "run" && "${2:-}" == "build" ]]; then
  mkdir -p out/kurum-kaydi/dogrula
  printf '%s %s\n' "$NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_TURNSTILE_SITE_KEY" > out/index.html
  printf '%s\n' "$NEXT_PUBLIC_API_URL" > out/kurum-kaydi/index.html
  printf '%s\n' "$NEXT_PUBLIC_TURNSTILE_SITE_KEY" > out/kurum-kaydi/dogrula/index.html
  [[ -z "${MOCK_MUTATE_ENV_FILE:-}" ]] || printf '# changed during build\n' >> "$MOCK_MUTATE_ENV_FILE"
  if [[ -n "${MOCK_REPLACE_UPLOADS_BACKUP:-}" ]]; then
    replacement="${MOCK_REPLACE_UPLOADS_BACKUP}.replacement"
    printf '#!/usr/bin/env bash\ntouch "%s"\n' "$MOCK_TOCTOU_SENTINEL" > "$replacement"
    chmod 0755 "$replacement"
    mv -f "$replacement" "$MOCK_REPLACE_UPLOADS_BACKUP"
  fi
fi
MOCK

  cat > "$fixture/bin/npx" <<'MOCK'
#!/usr/bin/env bash
printf 'npx %s\n' "$*" >> "$MOCK_LOG"
MOCK

  cat > "$fixture/bin/nginx" <<'MOCK'
#!/usr/bin/env bash
printf 'nginx %s\n' "$*" >> "$MOCK_LOG"
exit 0
MOCK

  cat > "$fixture/bin/systemctl" <<'MOCK'
#!/usr/bin/env bash
printf 'systemctl %s\n' "$*" >> "$MOCK_LOG"
exit 0
MOCK

  cat > "$fixture/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'curl %s\n' "$*" >> "$MOCK_LOG"
if [[ "${MOCK_FAIL_NEW_HEALTH:-0}" == 1 ]]; then
  current="$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT" 2>/dev/null || true)"
  [[ "$current" == "$MOCK_OLD_BACKEND" ]] || exit 22
fi
status="${MOCK_HEALTH_STATUS:-200}"
if [[ "${MOCK_REDIRECT_NEW_HEALTH:-0}" == 1 ]]; then
  current="$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT" 2>/dev/null || true)"
  [[ "$current" == "$MOCK_OLD_BACKEND" ]] || status=307
fi
printf '%s' "$status"
MOCK

  cat > "$fixture/bin/install" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
args=("$@")
src="${args[${#args[@]}-2]}" dst="${args[${#args[@]}-1]}"
printf 'install %s -> %s\n' "$src" "$dst" >> "$MOCK_LOG"
if [[ "${MOCK_INSTALL_FAIL_ONCE:-0}" == 1 && "$src" == *'/source/'*nginx-security-headers.conf && ! -e "$MOCK_INSTALL_FAILED_MARKER" ]]; then
  : > "$MOCK_INSTALL_FAILED_MARKER"
  exit 42
fi
cp "$src" "$dst"
chmod 0644 "$dst"
MOCK

  cat > "$fixture/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK

  cat > "$fixture/bin/pg_restore" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK

  cat > "$fixture/backup" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'backup\n' >> "$MOCK_LOG"
printf 'safe sql dump\n' | gzip -c > "$MOCK_BACKUP_PATH"
printf 'Database backup created: %s\n' "$MOCK_BACKUP_PATH"
MOCK
  cat > "$fixture/uploads-backup" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'uploads-backup\n' >> "$MOCK_LOG"
[[ "${MOCK_UPLOADS_BACKUP_FAIL:-0}" != 1 ]] || exit 47
snapshot="$MOCK_UPLOADS_SNAPSHOT"
mkdir -p "$snapshot/data"
printf 'upload-data' > "$snapshot/data/file.bin"
(
  cd "$snapshot/data"
  sha256sum ./file.bin > ../MANIFEST.sha256
)
printf 'files=1\nbytes=11\n' > "$snapshot/MANIFEST.meta"
[[ "${MOCK_UPLOADS_CORRUPT_MANIFEST:-0}" != 1 ]] || printf 'files=9\nbytes=999\n' > "$snapshot/MANIFEST.meta"
chmod 0700 "$(dirname "$snapshot")" "$snapshot"
printf 'Uploads backup created: %s\n' "$snapshot"
[[ "${MOCK_UPLOADS_OUTPUT_INJECTION:-0}" != 1 ]] || printf '/tmp/attacker-controlled\n'
MOCK
  chmod +x "$fixture/bin/"* "$fixture/backup" "$fixture/uploads-backup"
  cp "$fixture/bin/dotnet" "$fixture/bin/dotnet-ef"
}

run_deploy() {
  local fixture="$1"
  shift
  env \
    PATH="$fixture/bin:$PATH" \
    MOCK_LOG="$fixture/actions.log" \
    MOCK_BACKUP_PATH="$fixture/database backup.sql.gz" \
    MOCK_UPLOADS_SNAPSHOT="$fixture/uploads-snapshots/snapshot" \
    MOCK_OLD_BACKEND="$fixture/old/backend" \
    MOCK_INSTALL_FAILED_MARKER="$fixture/install-failed" \
    TARGET_SHA="$FIXTURE_SHA" \
    COURSE_INTELLECT_RELEASES_ROOT="$fixture/releases" \
    COURSE_INTELLECT_BACKEND_CURRENT="$fixture/backend-current" \
    COURSE_INTELLECT_MARKETING_CURRENT="$fixture/marketing-current" \
    COURSE_INTELLECT_BACKEND_SERVICE=courseintellect-backend.service \
    COURSE_INTELLECT_ENV_FILE="$fixture/etc/backend.env" \
    COURSE_INTELLECT_SECRETS_ENV_FILE="$fixture/etc/backend-secrets.env" \
    COURSE_INTELLECT_BACKUP_EXECUTABLE="$fixture/backup" \
    COURSE_INTELLECT_UPLOADS_BACKUP_EXECUTABLE="$fixture/uploads-backup" \
    COURSE_INTELLECT_UPLOADS_BACKUP_ROOT="$fixture/uploads-snapshots" \
    COURSE_INTELLECT_EF_TOOL="$fixture/bin/dotnet-ef" \
    COURSE_INTELLECT_NGINX_SNIPPET_DIR="$fixture/nginx" \
    COURSE_INTELLECT_PUBLIC_API_URL=https://maydanozasist.schoolasist.com \
    COURSE_INTELLECT_PUBLIC_SITE_URL=https://schoolasist.com \
    COURSE_INTELLECT_DB='Host=database;Database=courseintellect_prod' \
    COURSE_INTELLECT_UPLOADS_ROOT="$fixture/uploads" \
    COURSE_INTELLECT_CAPTCHA_SECRET=test-secret \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=test-public-site-key \
    TenantCleanup__Enabled=false \
    COURSE_INTELLECT_PREFLIGHT_SKIP_NETWORK=1 \
    "$@" \
    bash "$fixture/repo/scripts/deploy_production_fullstack.sh" --deploy
}

assert_old_state() {
  local fixture="$1"
  [[ "$(readlink -f "$fixture/backend-current")" == "$fixture/old/backend" ]] || fail "backend pointer was not restored"
  [[ "$(readlink -f "$fixture/marketing-current")" == "$fixture/old/marketing" ]] || fail "marketing pointer was not restored"
  [[ "$(<"$fixture/nginx/schoolasist-security.conf")" == "old security" ]] || fail "nginx security snippet was not restored"
  [[ "$(<"$fixture/nginx/schoolasist-security-headers.conf")" == "old headers" ]] || fail "nginx header snippet was not restored"
  if [[ -d "$fixture/releases/backend" && -d "$fixture/releases/marketing" ]]; then
    [[ -z "$(find "$fixture/releases/backend" "$fixture/releases/marketing" -mindepth 1 -maxdepth 1 -print -quit)" ]] \
      || fail "failed immutable release directories were not removed"
  fi
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

success="$work/success"
make_fixture "$success"
success_output="$(run_deploy "$success" 2>&1)"
[[ "$success_output" != *'mock-secret-must-not-appear'* ]] || fail "deployment output leaked a secret value"
backend_target="$(readlink -f "$success/backend-current")"
marketing_target="$(readlink -f "$success/marketing-current")"
[[ "$backend_target" == "$success/releases/backend/"* ]] || fail "backend release layout is incompatible"
[[ "$marketing_target" == "$success/releases/marketing/"* ]] || fail "marketing release layout is incompatible"
[[ "$(<"$backend_target/DEPLOYED_COMMIT")" == "$FIXTURE_SHA" ]] || fail "backend provenance marker mismatch"
[[ "$(<"$marketing_target/DEPLOYED_COMMIT")" == "$FIXTURE_SHA" ]] || fail "marketing provenance marker mismatch"
grep -Fq 'npm audit --omit=dev --audit-level=high' "$success/actions.log" || fail "production-only npm audit was not run"
db_backup_line="$(grep -n '^backup$' "$success/actions.log" | cut -d: -f1)"
uploads_backup_line="$(grep -n '^uploads-backup$' "$success/actions.log" | cut -d: -f1)"
migration_line="$(grep -n 'dotnet database update' "$success/actions.log" | cut -d: -f1)"
(( db_backup_line < uploads_backup_line && uploads_backup_line < migration_line )) \
  || fail "database and uploads backups did not both complete before migration"

uploads_failure="$work/uploads-backup-failure"
make_fixture "$uploads_failure"
if run_deploy "$uploads_failure" MOCK_UPLOADS_BACKUP_FAIL=1; then fail "uploads backup failure unexpectedly succeeded"; fi
assert_old_state "$uploads_failure"
! grep -Fq 'dotnet database update' "$uploads_failure/actions.log" || fail "migration ran after uploads backup failure"

unsafe_uploads_executable="$work/unsafe-uploads-executable"
make_fixture "$unsafe_uploads_executable"
chmod 0775 "$unsafe_uploads_executable/uploads-backup"
if run_deploy "$unsafe_uploads_executable"; then fail "group-writable uploads backup executable unexpectedly passed validation"; fi
assert_old_state "$unsafe_uploads_executable"
! [[ -f "$unsafe_uploads_executable/actions.log" ]] \
  || ! grep -Fq '^uploads-backup$' "$unsafe_uploads_executable/actions.log" \
  || fail "unsafe uploads backup executable was invoked"

corrupt_uploads="$work/corrupt-uploads-manifest"
make_fixture "$corrupt_uploads"
if run_deploy "$corrupt_uploads" MOCK_UPLOADS_CORRUPT_MANIFEST=1; then fail "corrupt uploads manifest unexpectedly succeeded"; fi
assert_old_state "$corrupt_uploads"
! grep -Fq 'dotnet database update' "$corrupt_uploads/actions.log" || fail "migration ran after uploads parity failure"

output_injection="$work/uploads-output-injection"
make_fixture "$output_injection"
if run_deploy "$output_injection" MOCK_UPLOADS_OUTPUT_INJECTION=1; then fail "uploads output injection unexpectedly succeeded"; fi
assert_old_state "$output_injection"
! grep -Fq 'dotnet database update' "$output_injection/actions.log" || fail "migration ran after uploads output injection"

toctou_executable="$work/uploads-executable-toctou"
make_fixture "$toctou_executable"
toctou_sentinel="$toctou_executable/TOCTOU_EXECUTED"
run_deploy "$toctou_executable" \
  MOCK_REPLACE_UPLOADS_BACKUP="$toctou_executable/uploads-backup" \
  MOCK_TOCTOU_SENTINEL="$toctou_sentinel" >/dev/null
[[ ! -e "$toctou_sentinel" ]] || fail "replacement uploads executable won the validation/execution race"
[[ -f "$toctou_executable/uploads-snapshots/snapshot/MANIFEST.sha256" ]] \
  || fail "validated uploads executable descriptor was not invoked"

migration="$work/migration-failure"
make_fixture "$migration"
if run_deploy "$migration" MOCK_MIGRATION_FAIL=1; then fail "migration failure unexpectedly succeeded"; fi
assert_old_state "$migration"

after_switch="$work/health-failure"
make_fixture "$after_switch"
if run_deploy "$after_switch" MOCK_FAIL_NEW_HEALTH=1; then fail "health failure unexpectedly succeeded"; fi
assert_old_state "$after_switch"

redirect_health="$work/redirect-health-failure"
make_fixture "$redirect_health"
if run_deploy "$redirect_health" MOCK_REDIRECT_NEW_HEALTH=1; then fail "HTTP redirect health unexpectedly succeeded"; fi
assert_old_state "$redirect_health"

first_activation="$work/first-activation-failure"
make_fixture "$first_activation"
rm -f "$first_activation/backend-current" "$first_activation/marketing-current"
if run_deploy "$first_activation" MOCK_FAIL_NEW_HEALTH=1; then fail "first-activation health failure unexpectedly succeeded"; fi
[[ ! -e "$first_activation/backend-current" && ! -L "$first_activation/backend-current" ]] || fail "failed first activation left a backend pointer"
[[ ! -e "$first_activation/marketing-current" && ! -L "$first_activation/marketing-current" ]] || fail "failed first activation left a marketing pointer"
[[ "$(<"$first_activation/nginx/schoolasist-security.conf")" == "old security" ]] || fail "first-activation rollback lost nginx security"
[[ "$(<"$first_activation/nginx/schoolasist-security-headers.conf")" == "old headers" ]] || fail "first-activation rollback lost nginx headers"
[[ -z "$(find "$first_activation/releases/backend" "$first_activation/releases/marketing" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail "failed first-activation releases remain"

toctou="$work/environment-toctou"
make_fixture "$toctou"
if run_deploy "$toctou" MOCK_MUTATE_ENV_FILE="$toctou/etc/backend.env"; then fail "environment mutation unexpectedly succeeded"; fi
assert_old_state "$toctou"
! grep -Fq '^backup$' "$toctou/actions.log" || fail "backup ran after environment provenance changed"

partial_nginx="$work/nginx-install-failure"
make_fixture "$partial_nginx"
if run_deploy "$partial_nginx" MOCK_INSTALL_FAIL_ONCE=1; then fail "partial nginx install unexpectedly succeeded"; fi
assert_old_state "$partial_nginx"

injection="$work/injection"
make_fixture "$injection"
sentinel="$injection/INJECTED"
if run_deploy "$injection" COURSE_INTELLECT_BACKUP_EXECUTABLE="$injection/backup;touch $sentinel"; then
  fail "backup command string unexpectedly passed validation"
fi
[[ ! -e "$sentinel" ]] || fail "backup command string was shell-evaluated"

env_injection="$work/environment-injection"
make_fixture "$env_injection"
env_sentinel="$env_injection/ENV_INJECTED"
printf 'UNUSED_LITERAL=$(touch %s)\n' "$env_sentinel" >> "$env_injection/etc/backend-secrets.env"
env_output="$(run_deploy "$env_injection" 2>&1)"
[[ ! -e "$env_sentinel" ]] || fail "environment value was shell-evaluated"
[[ "$env_output" != *'mock-secret-must-not-appear'* ]] || fail "environment-loading output leaked a secret value"

printf 'Mocked success and failure-path deployment tests passed.\n'
