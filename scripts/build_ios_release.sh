#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_NUMBER="${1:-}"
API_URL="${2:-https://maydanozasist.schoolasist.com}"
if [[ ! "$BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "Kullanım: bash scripts/build_ios_release.sh <App Store Connect'te kullanılmamış build numarası> [HTTPS API URL]" >&2
  exit 2
fi
python3 - "$API_URL" <<'PY'
import sys
from urllib.parse import urlparse
url = urlparse(sys.argv[1])
if url.scheme != 'https' or not url.hostname or url.username or url.password:
    sys.exit('HATA: Üretim API adresi, kimlik bilgisi içermeyen bir HTTPS URL olmalı.')
PY
cd "$PROJECT_ROOT/mobile"
BUILD_STARTED="$(date +%s)"
EXPORT_OPTIONS="$(python3 "$PROJECT_ROOT/scripts/prepare_ios_export_options.py")"
# Always build the application entry point, never the service smoke harness.
flutter build ipa --release --target lib/main.dart \
  --build-number "$BUILD_NUMBER" \
  --dart-define=COURSE_INTELLECT_ENV=production \
  --dart-define="COURSE_INTELLECT_API_URL=$API_URL" \
  --export-options-plist="$EXPORT_OPTIONS"

# Flutter can return success after archiving even when IPA export failed.
python3 "$PROJECT_ROOT/scripts/verify_ios_ipa.py" "$BUILD_NUMBER" "$BUILD_STARTED"
