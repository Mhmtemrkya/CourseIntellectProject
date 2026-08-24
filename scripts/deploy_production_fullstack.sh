#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKETING_DIR="courseintellectmarketingwebsite (1)"
RETIRED_API_HOST="api.courseintellect.com"

usage() {
  cat <<'USAGE'
Usage: deploy_production_fullstack.sh --deploy

Builds backend and marketing from one exact Git SHA, runs all release gates,
verifies a fresh backup, applies migrations, then switches both release pointers
with rollback protection. It does not deploy unless --deploy is passed.

Production-layout defaults:
  releases: /opt/courseintellect/releases/{backend,marketing}/<release-id>
  pointers: /opt/courseintellect/{backend-current,marketing-current}
  config:   /etc/courseintellect/{backend.env,backend-secrets.env}
  service:  courseintellect-backend.service
  backup:   /usr/local/sbin/courseintellect-db-backup

Required deployment inputs not normally stored in the config files:
  TARGET_SHA, COURSE_INTELLECT_PUBLIC_API_URL, COURSE_INTELLECT_PUBLIC_SITE_URL
Required production settings include COURSE_INTELLECT_DB,
COURSE_INTELLECT_UPLOADS_ROOT, Registration__Enabled, and
TenantCleanup__Enabled=false. Captcha credentials are required only when
public registration is explicitly enabled.
USAGE
}

[[ "${1:-}" == "--deploy" && $# -eq 1 ]] || { usage; exit 2; }
(( EUID == 0 )) || { echo "Production deployment must run as root." >&2; exit 2; }

: "${COURSE_INTELLECT_RELEASES_ROOT:=/opt/courseintellect/releases}"
: "${COURSE_INTELLECT_BACKEND_CURRENT:=/opt/courseintellect/backend-current}"
: "${COURSE_INTELLECT_MARKETING_CURRENT:=/opt/courseintellect/marketing-current}"
: "${COURSE_INTELLECT_BACKEND_SERVICE:=courseintellect-backend.service}"
: "${COURSE_INTELLECT_ENV_FILE:=/etc/courseintellect/backend.env}"
: "${COURSE_INTELLECT_SECRETS_ENV_FILE:=/etc/courseintellect/backend-secrets.env}"
: "${COURSE_INTELLECT_BACKUP_EXECUTABLE:=/usr/local/sbin/courseintellect-db-backup}"
: "${COURSE_INTELLECT_EF_TOOL:=/opt/courseintellect-tools/dotnet-ef}"
: "${COURSE_INTELLECT_NGINX_SNIPPET_DIR:=/etc/nginx/snippets}"

# Load assignment-only environment files without shell evaluation. This accepts
# KEY=value plus single/double-quoted values (including spaces), but never executes
# substitutions, commands, shell options, functions, or output from the files.
declare -A env_checksums=()
load_env_file() {
  local env_file="$1" line name value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] \
      || { echo "An external environment file contains a non-assignment entry." >&2; return 1; }
    name="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case "$name" in
      IFS|PATH|CDPATH|ENV|BASH_ENV|BASHOPTS|SHELLOPTS|GLOBIGNORE)
        echo "An external environment file attempts to change shell control state." >&2
        return 1
        ;;
    esac
    if [[ "$value" == \"* ]]; then
      [[ ${#value} -ge 2 && "$value" == *\" ]] \
        || { echo "An external environment file contains an unterminated quoted value." >&2; return 1; }
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'* ]]; then
      [[ ${#value} -ge 2 && "$value" == *\' ]] \
        || { echo "An external environment file contains an unterminated quoted value." >&2; return 1; }
      value="${value:1:${#value}-2}"
    fi
    printf -v "$name" '%s' "$value"
    export "$name"
  done < "$env_file"
}

for env_file in "$COURSE_INTELLECT_ENV_FILE" "$COURSE_INTELLECT_SECRETS_ENV_FILE"; do
  [[ "$env_file" == /* && -f "$env_file" && ! -L "$env_file" ]] \
    || { echo "A required external environment file is missing or unsafe." >&2; exit 2; }
  [[ "$(stat -c '%u' "$env_file")" == 0 ]] \
    || { echo "External environment files must be owned by root." >&2; exit 2; }
  mode="$(stat -c '%a' "$env_file")"
  (( (8#$mode & 0022) == 0 )) \
    || { echo "External environment files must not be group/world writable." >&2; exit 2; }
  if ! load_env_file "$env_file"; then
    echo "An external environment file could not be loaded." >&2
    exit 2
  fi
  env_checksums["$env_file"]="$(sha256sum "$env_file" | cut -d' ' -f1)"
done

required=(
  TARGET_SHA COURSE_INTELLECT_PUBLIC_API_URL COURSE_INTELLECT_PUBLIC_SITE_URL
  COURSE_INTELLECT_DB COURSE_INTELLECT_UPLOADS_ROOT Registration__Enabled
)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { printf '%s is required.\n' "$name" >&2; exit 2; }
done
if [[ "$Registration__Enabled" == "true" ]]; then
  for name in COURSE_INTELLECT_CAPTCHA_SECRET NEXT_PUBLIC_TURNSTILE_SITE_KEY; do
    [[ -n "${!name:-}" ]] || { printf '%s is required when Registration__Enabled=true.\n' "$name" >&2; exit 2; }
  done
elif [[ "$Registration__Enabled" != "false" ]]; then
  echo "Registration__Enabled must be exactly true or false." >&2
  exit 2
fi
[[ "${TenantCleanup__Enabled:-}" == "false" ]] \
  || { echo "TenantCleanup__Enabled=false is required." >&2; exit 2; }
[[ "${COURSE_INTELLECT_PUBLIC_API_URL%/}" == "https://maydanozasist.schoolasist.com" \
   && "${COURSE_INTELLECT_PUBLIC_SITE_URL%/}" == "https://schoolasist.com" ]] \
  || { echo "Public URLs must match the established CourseIntellect production origins." >&2; exit 2; }
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] \
  || { echo "TARGET_SHA must be a full lowercase 40-character SHA." >&2; exit 2; }
[[ "$COURSE_INTELLECT_RELEASES_ROOT" == /* && "$COURSE_INTELLECT_RELEASES_ROOT" != "/" ]] \
  || { echo "COURSE_INTELLECT_RELEASES_ROOT must be a safe absolute path." >&2; exit 2; }
[[ "$COURSE_INTELLECT_BACKEND_CURRENT" == /* && "$COURSE_INTELLECT_MARKETING_CURRENT" == /* \
   && "$COURSE_INTELLECT_BACKEND_CURRENT" != "$COURSE_INTELLECT_MARKETING_CURRENT" ]] \
  || { echo "Release pointers must be distinct absolute paths." >&2; exit 2; }
for pointer in "$COURSE_INTELLECT_BACKEND_CURRENT" "$COURSE_INTELLECT_MARKETING_CURRENT"; do
  if [[ -L "$pointer" ]]; then
    [[ -e "$pointer" ]] || { echo "Existing release pointer is dangling." >&2; exit 2; }
  else
    [[ ! -e "$pointer" ]] || { echo "Existing release pointers must be symbolic links." >&2; exit 2; }
  fi
done
resolved_uploads="$(readlink -m "$COURSE_INTELLECT_UPLOADS_ROOT")"
resolved_releases="$(readlink -m "$COURSE_INTELLECT_RELEASES_ROOT")"
[[ "$resolved_uploads" != "$ROOT_DIR" && "$resolved_uploads" != "$ROOT_DIR/"* \
   && "$resolved_uploads" != "$resolved_releases" && "$resolved_uploads" != "$resolved_releases/"* ]] \
  || { echo "Persistent uploads must be outside source and release trees." >&2; exit 2; }
[[ "$COURSE_INTELLECT_BACKUP_EXECUTABLE" == /* && -f "$COURSE_INTELLECT_BACKUP_EXECUTABLE" \
   && ! -L "$COURSE_INTELLECT_BACKUP_EXECUTABLE" && -x "$COURSE_INTELLECT_BACKUP_EXECUTABLE" ]] \
  || { echo "Backup executable must be an absolute executable regular file, not a command string." >&2; exit 2; }

[[ "$(stat -c '%u' "$COURSE_INTELLECT_BACKUP_EXECUTABLE")" == 0 \
   && $((8#$(stat -c '%a' "$COURSE_INTELLECT_BACKUP_EXECUTABLE") & 0022)) -eq 0 ]] \
  || { echo "Backup executable must be root-owned and not group/world writable." >&2; exit 2; }
[[ "$COURSE_INTELLECT_EF_TOOL" == /* && -f "$COURSE_INTELLECT_EF_TOOL" \
   && ! -L "$COURSE_INTELLECT_EF_TOOL" && -x "$COURSE_INTELLECT_EF_TOOL" ]] \
  || { echo "EF tool must be an absolute executable regular file." >&2; exit 2; }

[[ "$(stat -c '%u' "$COURSE_INTELLECT_EF_TOOL")" == 0 \
   && $((8#$(stat -c '%a' "$COURSE_INTELLECT_EF_TOOL") & 0022)) -eq 0 ]] \
  || { echo "EF tool must be root-owned and not group/world writable." >&2; exit 2; }

for command_name in git tar flock dotnet npm npx gzip pg_restore sha256sum nginx systemctl curl; do
  command -v "$command_name" >/dev/null 2>&1 \
    || { printf '%s is required.\n' "$command_name" >&2; exit 2; }
done

git -C "$ROOT_DIR" cat-file -e "$TARGET_SHA^{commit}"
[[ "$(git -C "$ROOT_DIR" rev-parse "$TARGET_SHA^{commit}")" == "$TARGET_SHA" ]] \
  || { echo "TARGET_SHA did not resolve exactly." >&2; exit 2; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] \
  || { echo "Source worktree must be clean before deployment." >&2; exit 2; }

uploads_inode_before="$(stat -c '%d:%i' "$COURSE_INTELLECT_UPLOADS_ROOT")"
mkdir -p "$COURSE_INTELLECT_RELEASES_ROOT"
LOCK_FILE="$COURSE_INTELLECT_RELEASES_ROOT/.deploy.lock"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is in progress." >&2; exit 1; }

RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${TARGET_SHA:0:12}"
BACKEND_RELEASE="$COURSE_INTELLECT_RELEASES_ROOT/backend/$RELEASE_ID"
MARKETING_RELEASE="$COURSE_INTELLECT_RELEASES_ROOT/marketing/$RELEASE_ID"
READY_ROOT="$COURSE_INTELLECT_RELEASES_ROOT/.ready/$RELEASE_ID"
BACKEND_READY_MARKER="$READY_ROOT/backend"
MARKETING_READY_MARKER="$READY_ROOT/marketing"
mkdir -p "$COURSE_INTELLECT_RELEASES_ROOT/backend" "$COURSE_INTELLECT_RELEASES_ROOT/marketing" "$READY_ROOT"
[[ ! -e "$BACKEND_RELEASE" && ! -e "$MARKETING_RELEASE" ]] \
  || { echo "An immutable release directory already exists for $RELEASE_ID." >&2; exit 1; }
rm -f "$BACKEND_READY_MARKER" "$MARKETING_READY_MARKER"

BUILD_ROOT="$(mktemp -d)"
SOURCE_ROOT="$BUILD_ROOT/source"
NGINX_BACKUP="$BUILD_ROOT/nginx-backup"
mkdir -p "$SOURCE_ROOT" "$NGINX_BACKUP" "$BACKEND_RELEASE" "$MARKETING_RELEASE"
old_backend=""
old_marketing=""
if [[ -L "$COURSE_INTELLECT_BACKEND_CURRENT" ]]; then
  old_backend="$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT")"
fi
if [[ -L "$COURSE_INTELLECT_MARKETING_CURRENT" ]]; then
  old_marketing="$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT")"
fi
activation_started=0
nginx_changed=0

atomic_link() {
  local target="$1" pointer="$2" temporary
  temporary="${pointer}.new.$$"
  rm -f "$temporary"
  ln -s "$target" "$temporary"
  mv -Tf "$temporary" "$pointer"
}

external_state_unchanged() {
  local env_file
  for env_file in "${!env_checksums[@]}"; do
    [[ -f "$env_file" && ! -L "$env_file" \
       && "$(sha256sum "$env_file" | cut -d' ' -f1)" == "${env_checksums[$env_file]}" ]] \
      || { echo "External environment changed during deployment; refusing to continue." >&2; return 1; }
  done
  [[ "$(stat -c '%d:%i' "$COURSE_INTELLECT_UPLOADS_ROOT")" == "$uploads_inode_before" ]] \
    || { echo "Persistent uploads root changed during deployment; refusing to continue." >&2; return 1; }
}

wait_for_url() {
  local url="$1" attempts="${2:-12}" delay="${3:-5}" i
  for ((i=1; i<=attempts; i++)); do
    curl --fail --silent --show-error --max-time 20 "$url" >/dev/null 2>&1 && return 0
    (( i == attempts )) || sleep "$delay"
  done
  printf 'Health check did not become ready: %s\n' "$url" >&2
  return 1
}

restore_nginx() {
  (( nginx_changed == 1 )) || return 0
  local name failed=0
  for name in schoolasist-security.conf schoolasist-security-headers.conf; do
    if [[ -f "$NGINX_BACKUP/$name" ]]; then
      install -m 0644 "$NGINX_BACKUP/$name" "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" || failed=1
    else
      rm -f "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" || failed=1
    fi
  done
  (( failed == 0 )) && nginx -t >/dev/null && systemctl reload nginx
}

rollback_activation() {
  local rc="${1:-1}" rollback_failed=0
  trap - ERR INT TERM
  set +e
  if (( activation_started == 1 )); then
    if [[ -n "$old_backend" ]]; then
      atomic_link "$old_backend" "$COURSE_INTELLECT_BACKEND_CURRENT" || rollback_failed=1
    else
      rm -f "$COURSE_INTELLECT_BACKEND_CURRENT" || rollback_failed=1
    fi
    if [[ -n "$old_marketing" ]]; then
      atomic_link "$old_marketing" "$COURSE_INTELLECT_MARKETING_CURRENT" || rollback_failed=1
    else
      rm -f "$COURSE_INTELLECT_MARKETING_CURRENT" || rollback_failed=1
    fi
    systemctl restart "$COURSE_INTELLECT_BACKEND_SERVICE" || rollback_failed=1
  fi
  restore_nginx || rollback_failed=1
  if (( activation_started == 1 )); then
    if [[ -n "$old_backend" ]]; then
      [[ "$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT" 2>/dev/null || true)" == "$old_backend" ]] || rollback_failed=1
    else
      [[ ! -e "$COURSE_INTELLECT_BACKEND_CURRENT" && ! -L "$COURSE_INTELLECT_BACKEND_CURRENT" ]] || rollback_failed=1
    fi
    if [[ -n "$old_marketing" ]]; then
      [[ "$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT" 2>/dev/null || true)" == "$old_marketing" ]] || rollback_failed=1
    else
      [[ ! -e "$COURSE_INTELLECT_MARKETING_CURRENT" && ! -L "$COURSE_INTELLECT_MARKETING_CURRENT" ]] || rollback_failed=1
    fi
    [[ -z "$old_backend" ]] || wait_for_url "${COURSE_INTELLECT_PUBLIC_API_URL%/}/api/system/status" 6 2 || rollback_failed=1
    [[ -z "$old_marketing" ]] || wait_for_url "${COURSE_INTELLECT_PUBLIC_SITE_URL%/}/" 3 1 || rollback_failed=1
  fi
  # Never remove a candidate directory that a failed pointer restoration still
  # references; preserving a serving tree is safer than leaving a dangling link.
  [[ "$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT" 2>/dev/null || true)" == "$BACKEND_RELEASE" ]] \
    || rm -rf "$BACKEND_RELEASE"
  [[ "$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT" 2>/dev/null || true)" == "$MARKETING_RELEASE" ]] \
    || rm -rf "$MARKETING_RELEASE"
  rm -rf "$READY_ROOT" "$BUILD_ROOT"
  if (( rollback_failed == 0 )); then
    echo "Deployment failed; previous pointers and nginx snippets were restored." >&2
  else
    echo "CRITICAL: deployment failed and automatic rollback verification was incomplete." >&2
  fi
  (( rc != 0 )) || rc=1
  exit "$rc"
}
trap 'rollback_activation $?' ERR
trap 'rollback_activation 130' INT
trap 'rollback_activation 143' TERM

verify_backup() {
  local path="$1"
  [[ "$path" == /* ]] || { echo "Backup path must be absolute." >&2; return 1; }
  [[ -s "$path" && ! -L "$path" ]] || { echo "Backup is missing, empty, or a symlink: $path" >&2; return 1; }
  case "$path" in
    *.gz) gzip -t "$path" ;;
    *.dump|*.backup) pg_restore --list "$path" >/dev/null ;;
    *.sql) grep -Eq '^(--|CREATE|INSERT|COPY|SET|SELECT)' "$path" ;;
    *) echo "Unsupported backup format: $path" >&2; return 1 ;;
  esac
  sha256sum "$path"
}

# Both artifacts are built from this one immutable exact-SHA archive.
git -C "$ROOT_DIR" archive --format=tar "$TARGET_SHA" | tar -x -C "$SOURCE_ROOT"
[[ "$(git -C "$ROOT_DIR" rev-parse "$TARGET_SHA^{commit}")" == "$TARGET_SHA" ]]
bash "$SOURCE_ROOT/scripts/production_preflight.sh"

dotnet restore "$SOURCE_ROOT/backend/CourseIntellect.sln" --force --no-cache
dotnet build "$SOURCE_ROOT/backend/CourseIntellect.sln" --no-restore --no-incremental --configuration Release /p:UseAppHost=false
env -u COURSE_INTELLECT_UPLOADS_ROOT \
  -u COURSE_INTELLECT_DB \
  -u COURSE_INTELLECT_SMTP_PASSWORD \
  -u COURSE_INTELLECT_CAPTCHA_SECRET \
  -u Jwt__Key \
  ASPNETCORE_ENVIRONMENT=Development \
  DOTNET_ENVIRONMENT=Development \
  dotnet test "$SOURCE_ROOT/backend/CourseIntellect.sln" --no-build --configuration Release --verbosity normal
dotnet publish "$SOURCE_ROOT/backend/CourseIntellect.Api/CourseIntellect.Api.csproj" --no-build --no-restore --configuration Release --output "$BACKEND_RELEASE" /p:UseAppHost=false
printf '%s\n' "$TARGET_SHA" > "$BACKEND_RELEASE/DEPLOYED_COMMIT"
printf '%s\n' "$BACKEND_RELEASE" > "$BACKEND_READY_MARKER"

pushd "$SOURCE_ROOT/$MARKETING_DIR" >/dev/null
rm -rf .next out
npm ci --include=dev --no-audit --no-fund
npm run lint
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
NODE_ENV=production \
NEXT_PUBLIC_API_URL="$COURSE_INTELLECT_PUBLIC_API_URL" \
NEXT_PUBLIC_TURNSTILE_SITE_KEY="$NEXT_PUBLIC_TURNSTILE_SITE_KEY" \
  npm run build
[[ -f out/index.html && -f out/kurum-kaydi/index.html && -f out/kurum-kaydi/dogrula/index.html ]]
! grep -R -F -q -- "$RETIRED_API_HOST" out
! grep -R -F -q -- "https://api.example.invalid" out
grep -R -F -q -- "$COURSE_INTELLECT_PUBLIC_API_URL" out
grep -R -F -q -- "$NEXT_PUBLIC_TURNSTILE_SITE_KEY" out
popd >/dev/null
cp -a "$SOURCE_ROOT/$MARKETING_DIR/out/." "$MARKETING_RELEASE/"
printf '%s\n' "$TARGET_SHA" > "$MARKETING_RELEASE/DEPLOYED_COMMIT"
printf '%s\n' "$MARKETING_RELEASE" > "$MARKETING_READY_MARKER"

[[ "$(<"$BACKEND_RELEASE/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
[[ "$(<"$MARKETING_RELEASE/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
external_state_unchanged

# The backup executable is invoked directly: no shell reparsing or command injection.
backup_output="$("$COURSE_INTELLECT_BACKUP_EXECUTABLE")"
backup_path=""
while IFS= read -r backup_line; do
  case "$backup_line" in
    /*) backup_path="$backup_line" ;;
    'Database backup created: '/*) backup_path="${backup_line#Database backup created: }" ;;
  esac
done <<< "$backup_output"
[[ -n "$backup_path" ]] \
  || { echo "Backup executable did not report a recognized absolute backup path." >&2; false; }
verify_backup "$backup_path"

mkdir -p "$COURSE_INTELLECT_NGINX_SNIPPET_DIR"
for name in schoolasist-security.conf schoolasist-security-headers.conf; do
  [[ ! -L "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" ]] \
    || { echo "Existing nginx snippets must not be symbolic links." >&2; false; }
  [[ -f "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" ]] \
    && cp -a "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" "$NGINX_BACKUP/$name"
done
# Mark the proxy state dirty before the first write so even a partial install restores.
nginx_changed=1
install -m 0644 "$SOURCE_ROOT/$MARKETING_DIR/deploy/nginx-security.conf" "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/schoolasist-security.conf"
install -m 0644 "$SOURCE_ROOT/$MARKETING_DIR/deploy/nginx-security-headers.conf" "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/schoolasist-security-headers.conf"
nginx -t
external_state_unchanged

COURSE_INTELLECT_BACKUP_CONFIRMED=YES CONFIRM_PRODUCTION_MIGRATION=APPLY \
  bash "$SOURCE_ROOT/scripts/apply_production_migrations.sh"
external_state_unchanged

activation_started=1
atomic_link "$BACKEND_RELEASE" "$COURSE_INTELLECT_BACKEND_CURRENT"
atomic_link "$MARKETING_RELEASE" "$COURSE_INTELLECT_MARKETING_CURRENT"
systemctl restart "$COURSE_INTELLECT_BACKEND_SERVICE"
systemctl reload nginx
wait_for_url "${COURSE_INTELLECT_PUBLIC_API_URL%/}/api/system/status"
wait_for_url "${COURSE_INTELLECT_PUBLIC_SITE_URL%/}/"

[[ "$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT")" == "$BACKEND_RELEASE" ]]
[[ "$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT")" == "$MARKETING_RELEASE" ]]
[[ "$(<"$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT")/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
[[ "$(<"$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT")/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
external_state_unchanged

trap - ERR INT TERM
rm -rf "$READY_ROOT" "$BUILD_ROOT"
printf 'Full-stack deployment complete: %s (backend=%s marketing=%s)\n' \
  "$TARGET_SHA" "$BACKEND_RELEASE" "$MARKETING_RELEASE"
