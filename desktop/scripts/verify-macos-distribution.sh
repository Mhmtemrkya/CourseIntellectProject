#!/usr/bin/env bash
set -euo pipefail

SEARCH_ROOT="${1:-src-tauri/target}"

APP_PATH="$(find "$SEARCH_ROOT" -type d -path '*/bundle/macos/SchoolAsist.app' -print -quit)"
DMG_PATH="$(find "$SEARCH_ROOT" -type f -path '*/bundle/dmg/*.dmg' -print -quit)"

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "HATA: Doğrulanacak SchoolAsist.app bulunamadı: $SEARCH_ROOT"
  exit 1
fi

if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
  echo "HATA: Doğrulanacak DMG bulunamadı: $SEARCH_ROOT"
  exit 1
fi

echo "Uygulama imzası doğrulanıyor: $APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

SIGNATURE_INFO="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)"
printf '%s\n' "$SIGNATURE_INFO" | grep -Fq "Authority=Developer ID Application:"
printf '%s\n' "$SIGNATURE_INFO" | grep -Eq '^TeamIdentifier=[A-Z0-9]+$'

echo "Apple noter bileti ve Gatekeeper kabulü doğrulanıyor..."
xcrun stapler validate "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"

# Tauri noter biletini çalıştırılabilir .app paketine staple eder. Dış DMG bir
# taşıma kabıdır ve ayrıca staple edilmiş olmayabilir; güvenlik kararı DMG
# içindeki uygulama üzerinden doğrulanmalıdır.
hdiutil verify "$DMG_PATH"

MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/schoolasist-dmg.XXXXXX")"
DMG_MOUNTED=0

cleanup() {
  if [ "$DMG_MOUNTED" -eq 1 ]; then
    hdiutil detach "$MOUNT_POINT" -quiet || true
  fi
  rmdir "$MOUNT_POINT" 2>/dev/null || true
}
trap cleanup EXIT

echo "DMG içindeki son kullanıcı uygulaması doğrulanıyor..."
hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT_POINT" "$DMG_PATH" >/dev/null
DMG_MOUNTED=1

PACKAGED_APP="$MOUNT_POINT/SchoolAsist.app"
if [ ! -d "$PACKAGED_APP" ]; then
  echo "HATA: DMG içinde SchoolAsist.app bulunamadı."
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$PACKAGED_APP"
xcrun stapler validate "$PACKAGED_APP"
spctl --assess --type execute --verbose=4 "$PACKAGED_APP"

echo "✓ DMG; Developer ID imzası, noter bileti, Gatekeeper ve disk bütünlüğü kontrollerini geçti."
