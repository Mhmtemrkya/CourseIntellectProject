#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

FAILURES=0

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

warn() {
  echo "WARN: $1" >&2
}

[[ -f android/key.properties ]] || fail "android/key.properties is missing. Configure the Play upload keystore before release."
[[ -f android/app/google-services.json ]] || warn "android/app/google-services.json is missing. Firebase push will be disabled on Android."
[[ -f ios/Runner/GoogleService-Info.plist ]] || warn "ios/Runner/GoogleService-Info.plist is missing. Firebase push will be disabled on iOS."
[[ -f ios/Runner/PrivacyInfo.xcprivacy ]] || fail "ios/Runner/PrivacyInfo.xcprivacy is missing."

grep -q "NSAllowsArbitraryLoads" ios/Runner/Info.plist && fail "NSAllowsArbitraryLoads must not be enabled for App Store release."
grep -q "<string>production</string>" ios/Runner/Runner.entitlements || fail "aps-environment must be production for App Store release."
grep -Eq "targetSdk = (3[5-9]|[4-9][0-9])" android/app/build.gradle.kts || fail "targetSdk must be 35 or higher for Play Store."

if [[ "${COURSE_INTELLECT_PROD_API_URL:-}" != https://* ]]; then
  fail "COURSE_INTELLECT_PROD_API_URL must be set to an HTTPS URL."
fi

flutter analyze

if (( FAILURES > 0 )); then
  echo "Store preflight failed with $FAILURES blocking issue(s)." >&2
  exit 1
fi

echo "Store preflight completed."
