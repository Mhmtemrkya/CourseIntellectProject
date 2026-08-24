#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failures=0

fail() { printf 'FAIL: %s\n' "$1" >&2; failures=$((failures + 1)); }
ok() { printf 'OK: %s\n' "$1"; }
require_command() { command -v "$1" >/dev/null 2>&1 && ok "$1 is installed." || fail "$1 is required."; }

[[ "${COURSE_INTELLECT_DB:-}" == *"Host="* ]] && ok "Production database connection is present." || fail "COURSE_INTELLECT_DB is missing or invalid."
[[ "${COURSE_INTELLECT_PUBLIC_API_URL:-}" == https://* ]] && ok "Public API URL uses HTTPS." || fail "COURSE_INTELLECT_PUBLIC_API_URL must be HTTPS."
[[ "${COURSE_INTELLECT_PUBLIC_SITE_URL:-}" == https://* ]] && ok "Public site URL uses HTTPS." || fail "COURSE_INTELLECT_PUBLIC_SITE_URL must be HTTPS."

uploads="${COURSE_INTELLECT_UPLOADS_ROOT:-}"
if [[ -z "$uploads" || "$uploads" != /* ]]; then
  fail "COURSE_INTELLECT_UPLOADS_ROOT must be an absolute persistent path."
elif [[ "$uploads" == "$ROOT_DIR"* ]]; then
  fail "Uploads root must be outside the source and release directories."
else
  mkdir -p "$uploads"
  probe="$uploads/.courseintellect-write-probe-$$"
  if touch "$probe" 2>/dev/null; then rm -f "$probe"; ok "Persistent uploads path is writable."; else fail "Persistent uploads path is not writable."; fi
fi

registration_enabled="${Registration__Enabled:-false}"
if [[ "$registration_enabled" == "true" ]]; then
  [[ -n "${COURSE_INTELLECT_CAPTCHA_SECRET:-}" ]] \
    && ok "Public registration is enabled and backend captcha secret is configured." \
    || fail "Registration__Enabled=true requires COURSE_INTELLECT_CAPTCHA_SECRET."
  [[ -n "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}" ]] \
    && ok "Marketing Turnstile site key is configured for the public registration form." \
    || fail "Registration__Enabled=true requires NEXT_PUBLIC_TURNSTILE_SITE_KEY."
elif [[ "$registration_enabled" == "false" ]]; then
  ok "Public registration is disabled; captcha credentials are not required."
else
  fail "Registration__Enabled must be exactly true or false."
fi

# Rejected-tenant deletion is deliberately opt-in. Production rollout requires it
# to remain explicitly false rather than relying only on the application default.
[[ "${TenantCleanup__Enabled:-}" == "false" ]] \
  && ok "Tenant cleanup is explicitly disabled." \
  || fail "TenantCleanup__Enabled must be exactly false for production deployment."

smtp_host="${Email__Smtp__Host:-${COURSE_INTELLECT_SMTP_HOST:-}}"
smtp_port="${Email__Smtp__Port:-${COURSE_INTELLECT_SMTP_PORT:-587}}"
smtp_user="${Email__Smtp__User:-${COURSE_INTELLECT_SMTP_USER:-}}"
smtp_from="${Email__From:-${COURSE_INTELLECT_SMTP_FROM:-}}"
smtp_ssl="${Email__Smtp__UseSsl:-${COURSE_INTELLECT_SMTP_USE_SSL:-}}"
if [[ -n "$smtp_host" ]]; then
  [[ "$smtp_ssl" == "true" ]] && ok "SMTP TLS is enabled." || fail "COURSE_INTELLECT_SMTP_USE_SSL / Email__Smtp__UseSsl must be true when SMTP is configured."
  [[ "$smtp_port" == "465" || "$smtp_port" == "587" ]] && ok "SMTP uses a TLS submission port." || fail "SMTP port must be 465 or 587."
  [[ -n "$smtp_from" && "$smtp_from" == *@* ]] && ok "SMTP sender address is configured." || fail "Email__From / COURSE_INTELLECT_SMTP_FROM must be a valid sender address."
  if [[ -n "$smtp_user" && -z "${COURSE_INTELLECT_SMTP_PASSWORD:-}" && -z "${Email__Smtp__Password:-}" ]]; then
    fail "COURSE_INTELLECT_SMTP_PASSWORD is required when an SMTP user is configured."
  else
    ok "SMTP authentication configuration is consistent."
  fi
else
  ok "SMTP is intentionally not configured; registration remains unverified until configured."
fi

require_command curl
require_command nginx
if command -v nginx >/dev/null 2>&1; then
  nginx -t >/dev/null 2>&1 && ok "Existing nginx proxy configuration is valid." || fail "nginx -t failed."
fi

if [[ "${COURSE_INTELLECT_PREFLIGHT_SKIP_NETWORK:-}" != "1" && "${COURSE_INTELLECT_PUBLIC_API_URL:-}" == https://* ]]; then
  status_url="${COURSE_INTELLECT_PUBLIC_API_URL%/}/api/system/status"
  curl --fail --silent --show-error --max-time 15 "$status_url" >/dev/null \
    && ok "Production API proxy health endpoint is reachable." \
    || fail "Production API proxy prerequisite failed: $status_url"
fi

if (( failures > 0 )); then
  printf 'Production preflight failed with %d blocking issue(s).\n' "$failures" >&2
  exit 1
fi
printf 'Production preflight completed successfully.\n'
