#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKETING_DIR="$ROOT_DIR/courseintellectmarketingwebsite (1)"

run_config() {
  local registration_flag="${1-__unset__}"
  shift || true
  if [[ "$registration_flag" == "__unset__" ]]; then
    env -u NEXT_PUBLIC_REGISTRATION_ENABLED -u NEXT_PUBLIC_TURNSTILE_SITE_KEY \
      NODE_ENV=production node -e "import('./next.config.mjs')" "$@"
  else
    env -u NEXT_PUBLIC_TURNSTILE_SITE_KEY \
      NODE_ENV=production NEXT_PUBLIC_REGISTRATION_ENABLED="$registration_flag" \
      node -e "import('./next.config.mjs')" "$@"
  fi
}

pushd "$MARKETING_DIR" >/dev/null
run_config >/dev/null

missing_key_output="$(mktemp)"
invalid_flag_output="$(mktemp)"
trap 'rm -f "$missing_key_output" "$invalid_flag_output"' EXIT

if run_config true >"$missing_key_output" 2>&1; then
  echo "Enabled registration config unexpectedly accepted a missing Turnstile site key." >&2
  exit 1
fi
grep -Fq 'NEXT_PUBLIC_TURNSTILE_SITE_KEY is required' "$missing_key_output"

if run_config TRUE >"$invalid_flag_output" 2>&1; then
  echo "Invalid registration flag unexpectedly passed production config validation." >&2
  exit 1
fi
grep -Fq 'NEXT_PUBLIC_REGISTRATION_ENABLED must be exactly true or false' "$invalid_flag_output"
popd >/dev/null

printf 'Registration configuration behavior tests passed.\n'
