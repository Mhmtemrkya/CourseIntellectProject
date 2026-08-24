#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFLIGHT="$ROOT_DIR/scripts/production_preflight.sh"
DEPLOY="$ROOT_DIR/scripts/deploy_production_fullstack.sh"
NGINX="$ROOT_DIR/courseintellectmarketingwebsite (1)/deploy/nginx-security.conf"
HEADERS="$ROOT_DIR/courseintellectmarketingwebsite (1)/deploy/nginx-security-headers.conf"

assert_contains() {
  local file="$1" pattern="$2"
  grep -Fq -- "$pattern" "$file" || { printf 'Missing %s in %s\n' "$pattern" "$file" >&2; exit 1; }
}

assert_not_contains() {
  local file="$1" pattern="$2"
  ! grep -Fq -- "$pattern" "$file" || { printf 'Unsafe %s in %s\n' "$pattern" "$file" >&2; exit 1; }
}

bash -n "$PREFLIGHT"
[[ -f "$DEPLOY" ]] || { echo "Missing full-stack production deploy helper" >&2; exit 1; }
bash -n "$DEPLOY"

assert_contains "$PREFLIGHT" 'COURSE_INTELLECT_CAPTCHA_SECRET'
assert_contains "$PREFLIGHT" 'NEXT_PUBLIC_TURNSTILE_SITE_KEY'
assert_contains "$PREFLIGHT" 'COURSE_INTELLECT_SMTP_USE_SSL'
assert_contains "$PREFLIGHT" 'COURSE_INTELLECT_SMTP_PASSWORD'
assert_contains "$PREFLIGHT" 'TenantCleanup__Enabled'
assert_contains "$PREFLIGHT" 'command -v nginx'
assert_contains "$PREFLIGHT" 'nginx -t'
assert_contains "$PREFLIGHT" '/api/system/status'

assert_contains "$DEPLOY" 'git -C "$ROOT_DIR" archive --format=tar "$TARGET_SHA"'
assert_contains "$DEPLOY" 'rm -f "$BACKEND_READY_MARKER" "$MARKETING_READY_MARKER"'
assert_contains "$DEPLOY" 'dotnet test'
assert_contains "$DEPLOY" 'npm run lint'
assert_contains "$DEPLOY" 'npm audit --omit=dev --audit-level=high'
assert_contains "$DEPLOY" 'verify_backup'
assert_contains "$DEPLOY" 'COURSE_INTELLECT_BACKUP_EXECUTABLE'
assert_contains "$DEPLOY" 'COURSE_INTELLECT_EF_TOOL'
assert_contains "$DEPLOY" 'load_env_file'
assert_not_contains "$DEPLOY" 'source "$env_file"'
assert_not_contains "$DEPLOY" 'bash -c "$COURSE_INTELLECT_BACKUP'
assert_contains "$DEPLOY" 'apply_production_migrations.sh'
assert_contains "$DEPLOY" 'rollback_activation'
assert_contains "$DEPLOY" 'rm -f "$COURSE_INTELLECT_BACKEND_CURRENT"'
assert_contains "$DEPLOY" 'rm -f "$COURSE_INTELLECT_MARKETING_CURRENT"'
assert_contains "$DEPLOY" 'Backup path must be absolute'
assert_contains "$DEPLOY" 'An immutable release directory already exists'
assert_contains "$DEPLOY" 'DEPLOYED_COMMIT'
assert_contains "$DEPLOY" 'TenantCleanup__Enabled=false'
assert_contains "$DEPLOY" 'nginx -t'
assert_contains "$DEPLOY" 'systemctl restart'
assert_contains "$DEPLOY" '/api/system/status'
assert_contains "$DEPLOY" 'NEXT_PUBLIC_API_URL="$COURSE_INTELLECT_PUBLIC_API_URL"'
assert_contains "$DEPLOY" 'BACKEND_RELEASE="$COURSE_INTELLECT_RELEASES_ROOT/backend/$RELEASE_ID"'
assert_contains "$DEPLOY" 'MARKETING_RELEASE="$COURSE_INTELLECT_RELEASES_ROOT/marketing/$RELEASE_ID"'

# CSP must authorize the Turnstile script, browser connection, and challenge frame.
assert_contains "$HEADERS" "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://challenges.cloudflare.com"
assert_contains "$HEADERS" 'connect-src'
assert_contains "$HEADERS" 'https://challenges.cloudflare.com'
assert_contains "$HEADERS" 'frame-src https://challenges.cloudflare.com'

# Header coverage includes slashless exact static-export routes as well as descendants.
assert_contains "$NGINX" 'location = /admin {'
assert_contains "$NGINX" 'location = /giris {'
assert_contains "$NGINX" 'X-Robots-Tag "noindex, nofollow"'

printf 'Release operations source assertions passed.\n'
