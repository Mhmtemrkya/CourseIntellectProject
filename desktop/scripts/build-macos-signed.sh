#!/usr/bin/env bash
# SchoolAsist macOS imzalı + notarize DMG üretimi.
#
# Gizli hiçbir bilgi burada saklanmaz; imza kimliği ve notarization
# kimlik bilgileri ortam değişkenlerinden okunur. Kullanım:
#
#   # 1) İmza kimliği (Developer ID Application). Boşsa keychain'den otomatik bulunur.
#   export APPLE_SIGNING_IDENTITY="Developer ID Application: Adiniz (TEAMID)"
#
#   # 2a) Notarization — Apple ID yöntemi:
#   export APPLE_ID="apple-hesabiniz@ornek.com"
#   export APPLE_PASSWORD="uygulamaya-ozel-sifre"   # appleid.apple.com'dan
#   export APPLE_TEAM_ID="TEAMID"
#
#   # 2b) VEYA App Store Connect API anahtarı yöntemi (CI için önerilir):
#   export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#   export APPLE_API_KEY="XXXXXXXXXX"
#   export APPLE_API_KEY_PATH="/mutlak/yol/AuthKey_XXXXXXXXXX.p8"
#
#   # 3) Çalıştır:
#   npm run desktop:build:signed
#
# Tauri, bu değişkenler varsa DMG'yi Developer ID + hardened runtime ile imzalar
# ve build sırasında otomatik notarize edip staple eder.

set -euo pipefail

cd "$(dirname "$0")/.."

# ── İmza kimliği ────────────────────────────────────────────────────────────
if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "APPLE_SIGNING_IDENTITY set edilmemiş — keychain'den Developer ID aranıyor..."
  DETECTED="$(security find-identity -v -p codesigning 2>/dev/null \
    | grep -oE 'Developer ID Application: [^"]+' | head -1 || true)"
  if [ -n "$DETECTED" ]; then
    export APPLE_SIGNING_IDENTITY="$DETECTED"
    echo "Bulundu: $APPLE_SIGNING_IDENTITY"
  else
    echo "HATA: 'Developer ID Application' sertifikası bulunamadı."
    echo "  → Apple Developer Program üyeliği + Developer ID Application sertifikası gerekir."
    echo "  → Xcode > Settings > Accounts > Manage Certificates ile oluşturabilirsiniz."
    exit 1
  fi
fi

# ── Notarization kimlik bilgisi kontrolü (dağıtımda zorunlu) ────────────────
HAS_APPLEID=0; HAS_APIKEY=0
[ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ] && HAS_APPLEID=1
[ -n "${APPLE_API_ISSUER:-}" ] && [ -n "${APPLE_API_KEY:-}" ] && [ -n "${APPLE_API_KEY_PATH:-}" ] && HAS_APIKEY=1
if [ "$HAS_APPLEID" -eq 0 ] && [ "$HAS_APIKEY" -eq 0 ]; then
  echo "HATA: Notarization kimlik bilgisi yok; dağıtılabilir DMG üretilmedi."
  echo "  (APPLE_ID+APPLE_PASSWORD+APPLE_TEAM_ID veya API key üçlüsünü set edin.)"
  echo "  Notarize edilmemiş paket diğer Mac'lerde Gatekeeper tarafından engellenir."
  exit 1
fi

if [ "$HAS_APIKEY" -eq 1 ] && [ ! -f "$APPLE_API_KEY_PATH" ]; then
  echo "HATA: APPLE_API_KEY_PATH dosyası bulunamadı: $APPLE_API_KEY_PATH"
  exit 1
fi

case "$APPLE_SIGNING_IDENTITY" in
  "Developer ID Application:"*) ;;
  *)
    echo "HATA: App Store dışı DMG için 'Developer ID Application' sertifikası gerekir."
    echo "  Bulunan/seçilen kimlik: $APPLE_SIGNING_IDENTITY"
    exit 1
    ;;
esac

if ! security find-identity -v -p codesigning 2>/dev/null | grep -Fq "\"$APPLE_SIGNING_IDENTITY\""; then
  echo "HATA: İmza kimliği private key ile birlikte Keychain'de bulunamadı."
  echo "  $APPLE_SIGNING_IDENTITY"
  exit 1
fi

# ── Build ───────────────────────────────────────────────────────────────────
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
export CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
export CARGO_HTTP_TIMEOUT=600
export CARGO_NET_RETRY=10
export REACT_APP_COURSE_INTELLECT_ENV=production

# DMG arka planı (mevcut akışla aynı)
swift scripts/generate-dmg-background.swift

# Bu script tauri'yi doğrudan çağırdığı için npm'in pre-hook'u devreye girmez;
# ortam temizliği (provenance + bağlı kalmış DMG diskleri) burada elle yapılır.
bash scripts/macos-build-preflight.sh

node ./node_modules/@tauri-apps/cli/tauri.js build --bundles dmg

# Yanlışlıkla imzasız/notarize edilmemiş bir dosyanın müşteriye gönderilmesini
# engellemek için build başarılı olsa bile Apple güven zincirini ayrıca doğrula.
APP_PATH="src-tauri/target/release/bundle/macos/SchoolAsist.app"
DMG_PATH="$(find src-tauri/target/release/bundle/dmg -maxdepth 1 -type f -name '*.dmg' -print0 \
  | xargs -0 ls -1t | head -1)"

if [ ! -d "$APP_PATH" ] || [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
  echo "HATA: Doğrulanacak uygulama veya DMG bulunamadı."
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -Fq "Authority=Developer ID Application:"
spctl --assess --type execute --verbose=4 "$APP_PATH"
xcrun stapler validate "$APP_PATH"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo ""
echo "✓ Developer ID ile imzalanmış ve Apple tarafından notarize edilmiş DMG hazır:"
echo "  $DMG_PATH"
echo "  Bu dosya diğer Mac'lerde xattr veya Terminal komutu gerektirmez."
