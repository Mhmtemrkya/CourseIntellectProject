#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failures=0

fail() { printf 'FAIL: %s\n' "$1" >&2; failures=$((failures + 1)); }
ok() { printf 'OK: %s\n' "$1"; }

[[ "${COURSE_INTELLECT_DB:-}" == *"Host="* ]] && ok "Production database connection is present." || fail "COURSE_INTELLECT_DB is missing or invalid."
[[ "${COURSE_INTELLECT_PUBLIC_API_URL:-}" == https://* ]] && ok "Public API URL uses HTTPS." || fail "COURSE_INTELLECT_PUBLIC_API_URL must be HTTPS."

uploads="${COURSE_INTELLECT_UPLOADS_ROOT:-}"
if [[ -z "$uploads" || "$uploads" != /* ]]; then
  fail "COURSE_INTELLECT_UPLOADS_ROOT must be an absolute persistent path."
elif [[ "$uploads" == "$ROOT_DIR"* ]]; then
  fail "Uploads root must be outside the application release directory."
else
  mkdir -p "$uploads"
  probe="$uploads/.courseintellect-write-probe-$$"
  if touch "$probe" 2>/dev/null; then rm -f "$probe"; ok "Persistent uploads path is writable."; else fail "Persistent uploads path is not writable."; fi
fi

if [[ "${COURSE_INTELLECT_PUBLIC_API_URL:-}" == https://* ]]; then
  status_url="${COURSE_INTELLECT_PUBLIC_API_URL%/}/api/system/status"
  if curl --fail --silent --show-error --max-time 15 "$status_url" >/dev/null; then ok "Production API health endpoint is reachable."; else fail "Production API health endpoint is unreachable: $status_url"; fi
fi

if (( failures > 0 )); then
  printf 'Production preflight failed with %d blocking issue(s).\n' "$failures" >&2
  exit 1
fi
printf 'Production preflight completed successfully.\n'
