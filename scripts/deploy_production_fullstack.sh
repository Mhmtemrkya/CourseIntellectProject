#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKETING_DIR="courseintellectmarketingwebsite (1)"

usage() {
  cat <<'USAGE'
Usage: deploy_production_fullstack.sh --deploy

Builds backend and marketing from one exact Git SHA, runs all release gates,
verifies a fresh backup, applies migrations, then switches both release pointers
with rollback protection. It does not deploy unless --deploy is passed.

Required environment:
  TARGET_SHA, COURSE_INTELLECT_RELEASES_ROOT
  COURSE_INTELLECT_BACKEND_CURRENT, COURSE_INTELLECT_MARKETING_CURRENT
  COURSE_INTELLECT_BACKEND_SERVICE, COURSE_INTELLECT_ENV_FILE
  COURSE_INTELLECT_BACKUP_COMMAND, COURSE_INTELLECT_NGINX_SNIPPET_DIR
  COURSE_INTELLECT_PUBLIC_API_URL, COURSE_INTELLECT_PUBLIC_SITE_URL
  COURSE_INTELLECT_DB, COURSE_INTELLECT_UPLOADS_ROOT
  COURSE_INTELLECT_CAPTCHA_SECRET, NEXT_PUBLIC_TURNSTILE_SITE_KEY
  TenantCleanup__Enabled=false
USAGE
}

[[ "${1:-}" == "--deploy" && $# -eq 1 ]] || { usage; exit 2; }

required=(
  TARGET_SHA COURSE_INTELLECT_RELEASES_ROOT COURSE_INTELLECT_BACKEND_CURRENT
  COURSE_INTELLECT_MARKETING_CURRENT COURSE_INTELLECT_BACKEND_SERVICE
  COURSE_INTELLECT_ENV_FILE COURSE_INTELLECT_BACKUP_COMMAND
  COURSE_INTELLECT_NGINX_SNIPPET_DIR COURSE_INTELLECT_PUBLIC_API_URL
  COURSE_INTELLECT_PUBLIC_SITE_URL COURSE_INTELLECT_DB COURSE_INTELLECT_UPLOADS_ROOT
  COURSE_INTELLECT_CAPTCHA_SECRET NEXT_PUBLIC_TURNSTILE_SITE_KEY
)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { printf '%s is required.\n' "$name" >&2; exit 2; }
done
[[ "${TenantCleanup__Enabled:-}" == "false" ]] || { echo "TenantCleanup__Enabled=false is required." >&2; exit 2; }
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "TARGET_SHA must be a full 40-character SHA." >&2; exit 2; }

git -C "$ROOT_DIR" cat-file -e "$TARGET_SHA^{commit}"
[[ "$(git -C "$ROOT_DIR" rev-parse "$TARGET_SHA^{commit}")" == "$TARGET_SHA" ]] || { echo "TARGET_SHA did not resolve exactly." >&2; exit 2; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Source worktree must be clean before deployment." >&2; exit 2; }

ENV_FILE="$COURSE_INTELLECT_ENV_FILE"
[[ -f "$ENV_FILE" ]] || { echo "External environment file is missing." >&2; exit 2; }
bash -n "$ENV_FILE"
env_checksum_before="$(sha256sum "$ENV_FILE" | cut -d' ' -f1)"
uploads_inode_before="$(stat -c '%d:%i' "$COURSE_INTELLECT_UPLOADS_ROOT")"

RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${TARGET_SHA:0:12}"
RELEASE_ROOT="$COURSE_INTELLECT_RELEASES_ROOT/$RELEASE_ID"
BACKEND_RELEASE="$RELEASE_ROOT/backend"
MARKETING_RELEASE="$RELEASE_ROOT/marketing"
BACKEND_READY_MARKER="$COURSE_INTELLECT_RELEASES_ROOT/.backend-ready"
MARKETING_READY_MARKER="$COURSE_INTELLECT_RELEASES_ROOT/.marketing-ready"
LOCK_FILE="$COURSE_INTELLECT_RELEASES_ROOT/.deploy.lock"
mkdir -p "$COURSE_INTELLECT_RELEASES_ROOT"
[[ ! -e "$RELEASE_ROOT" ]] || { echo "Release directory already exists: $RELEASE_ROOT" >&2; exit 1; }
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is in progress." >&2; exit 1; }

# A failed earlier run must never leave an activatable marker behind.
rm -f "$BACKEND_READY_MARKER" "$MARKETING_READY_MARKER"
BUILD_ROOT="$(mktemp -d)"
SOURCE_ROOT="$BUILD_ROOT/source"
mkdir -p "$SOURCE_ROOT" "$BACKEND_RELEASE" "$MARKETING_RELEASE"
old_backend="$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT" 2>/dev/null || true)"
old_marketing="$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT" 2>/dev/null || true)"
activation_started=0
nginx_changed=0
NGINX_BACKUP="$BUILD_ROOT/nginx-backup"
mkdir -p "$NGINX_BACKUP"

restore_nginx() {
  (( nginx_changed == 1 )) || return 0
  for name in schoolasist-security.conf schoolasist-security-headers.conf; do
    if [[ -f "$NGINX_BACKUP/$name" ]]; then
      install -m 0644 "$NGINX_BACKUP/$name" "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name"
    else
      rm -f "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name"
    fi
  done
  nginx -t >/dev/null && systemctl reload nginx || true
}

rollback_activation() {
  local rc=$?
  trap - ERR
  if (( activation_started == 1 )); then
    if [[ -n "$old_backend" ]]; then
      atomic_link "$old_backend" "$COURSE_INTELLECT_BACKEND_CURRENT"
    else
      rm -f "$COURSE_INTELLECT_BACKEND_CURRENT"
    fi
    if [[ -n "$old_marketing" ]]; then
      atomic_link "$old_marketing" "$COURSE_INTELLECT_MARKETING_CURRENT"
    else
      rm -f "$COURSE_INTELLECT_MARKETING_CURRENT"
    fi
    systemctl restart "$COURSE_INTELLECT_BACKEND_SERVICE" || true
  fi
  restore_nginx
  rm -f "$BACKEND_READY_MARKER" "$MARKETING_READY_MARKER"
  rm -rf "$BUILD_ROOT"
  echo "Deployment failed; previous pointers and nginx snippets were restored." >&2
  exit "$rc"
}
trap rollback_activation ERR INT TERM

atomic_link() {
  local target="$1" pointer="$2" temporary="${pointer}.new.$$"
  ln -s "$target" "$temporary"
  mv -Tf "$temporary" "$pointer"
}

verify_backup() {
  local path="$1"
  [[ "$path" == /* ]] || { echo "Backup path must be absolute." >&2; return 1; }
  [[ -s "$path" ]] || { echo "Backup is missing or empty: $path" >&2; return 1; }
  case "$path" in
    *.gz) gzip -t "$path" ;;
    *.dump|*.backup) pg_restore --list "$path" >/dev/null ;;
    *.sql) grep -Eq '^(--|CREATE|INSERT|COPY|SET|SELECT)' "$path" ;;
    *) echo "Unsupported backup format: $path" >&2; return 1 ;;
  esac
  sha256sum "$path"
}

# Export a clean immutable source tree from exactly TARGET_SHA; both components
# are therefore guaranteed to share provenance even if the checkout later moves.
(cd "$ROOT_DIR" && git archive "$TARGET_SHA") | tar -x -C "$SOURCE_ROOT"
[[ "$(git -C "$ROOT_DIR" rev-parse "$TARGET_SHA")" == "$TARGET_SHA" ]]

# Configuration/proxy/captcha/SMTP safety gate. This checks existing nginx before
# any candidate snippet is installed.
bash "$SOURCE_ROOT/scripts/production_preflight.sh"

# Backend gate and immutable publish.
dotnet restore "$SOURCE_ROOT/backend/CourseIntellect.sln"
dotnet build "$SOURCE_ROOT/backend/CourseIntellect.sln" --no-restore --configuration Release /p:UseAppHost=false
dotnet test "$SOURCE_ROOT/backend/CourseIntellect.Tests/CourseIntellect.Tests.csproj" --no-build --configuration Release --verbosity normal
dotnet publish "$SOURCE_ROOT/backend/CourseIntellect.Api/CourseIntellect.Api.csproj" --no-build --configuration Release --output "$BACKEND_RELEASE" /p:UseAppHost=false
printf '%s\n' "$TARGET_SHA" > "$BACKEND_RELEASE/DEPLOYED_COMMIT"
printf '%s\n' "$BACKEND_RELEASE" > "$BACKEND_READY_MARKER"

# Marketing gate and static export. NODE_ENV plus the public site key make the
# Turnstile build-time validation execute here.
pushd "$SOURCE_ROOT/$MARKETING_DIR" >/dev/null
npm ci --include=dev
npm run lint
npx tsc --noEmit
npm audit --audit-level=high
NODE_ENV=production npm run build
popd >/dev/null
cp -a "$SOURCE_ROOT/$MARKETING_DIR/out/." "$MARKETING_RELEASE/"
printf '%s\n' "$TARGET_SHA" > "$MARKETING_RELEASE/DEPLOYED_COMMIT"
printf '%s\n' "$MARKETING_RELEASE" > "$MARKETING_READY_MARKER"

[[ "$(cat "$BACKEND_RELEASE/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
[[ "$(cat "$MARKETING_RELEASE/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]

# Backup happens just in time after every build/test gate and before migration.
backup_output="$(bash -c "$COURSE_INTELLECT_BACKUP_COMMAND")"
backup_path="$(printf '%s\n' "$backup_output" | awk 'NF { value=$0 } END { print value }')"
verify_backup "$backup_path"

# Install reviewed snippets with a reversible copy, validate the effective proxy,
# then apply migrations only after clean builds and a verified backup.
mkdir -p "$COURSE_INTELLECT_NGINX_SNIPPET_DIR"
for name in schoolasist-security.conf schoolasist-security-headers.conf; do
  [[ -f "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" ]] && cp -a "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/$name" "$NGINX_BACKUP/$name"
done
install -m 0644 "$SOURCE_ROOT/$MARKETING_DIR/deploy/nginx-security.conf" "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/schoolasist-security.conf"
install -m 0644 "$SOURCE_ROOT/$MARKETING_DIR/deploy/nginx-security-headers.conf" "$COURSE_INTELLECT_NGINX_SNIPPET_DIR/schoolasist-security-headers.conf"
nginx_changed=1
nginx -t

COURSE_INTELLECT_BACKUP_CONFIRMED=YES CONFIRM_PRODUCTION_MIGRATION=APPLY \
  bash "$SOURCE_ROOT/scripts/apply_production_migrations.sh"

# The two pointer replacements are serialized under one deploy lock and treated
# as one activation transaction: any switch/restart/health failure restores both.
activation_started=1
atomic_link "$BACKEND_RELEASE" "$COURSE_INTELLECT_BACKEND_CURRENT"
atomic_link "$MARKETING_RELEASE" "$COURSE_INTELLECT_MARKETING_CURRENT"
systemctl restart "$COURSE_INTELLECT_BACKEND_SERVICE"
systemctl reload nginx
curl --fail --silent --show-error --max-time 20 "${COURSE_INTELLECT_PUBLIC_API_URL%/}/api/system/status" >/dev/null
curl --fail --silent --show-error --max-time 20 "${COURSE_INTELLECT_PUBLIC_SITE_URL%/}/" >/dev/null

[[ "$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT")" == "$BACKEND_RELEASE" ]]
[[ "$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT")" == "$MARKETING_RELEASE" ]]
[[ "$(cat "$(readlink -f "$COURSE_INTELLECT_BACKEND_CURRENT")/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
[[ "$(cat "$(readlink -f "$COURSE_INTELLECT_MARKETING_CURRENT")/DEPLOYED_COMMIT")" == "$TARGET_SHA" ]]
[[ "$(sha256sum "$ENV_FILE" | cut -d' ' -f1)" == "$env_checksum_before" ]]
[[ "$(stat -c '%d:%i' "$COURSE_INTELLECT_UPLOADS_ROOT")" == "$uploads_inode_before" ]]

trap - ERR INT TERM
rm -f "$BACKEND_READY_MARKER" "$MARKETING_READY_MARKER"
rm -rf "$BUILD_ROOT"
printf 'Full-stack deployment complete: %s (%s)\n' "$TARGET_SHA" "$RELEASE_ROOT"
