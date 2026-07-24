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

# ── Kalıcı kimlik bilgisi dosyası ────────────────────────────────────────────
# Kimlik bilgilerini her build'de elle export etmek yerine bir kez
# scripts/signing.env.local dosyasına yazın (GITIGNORE'dadır, asla commit edilmez).
# Şablon: scripts/signing.env.local.example
SIGNING_ENV="scripts/signing.env.local"
if [ -f "$SIGNING_ENV" ]; then
  echo "→ Kimlik bilgileri yükleniyor: $SIGNING_ENV"
  # shellcheck disable=SC1090
  set -a; . "$SIGNING_ENV"; set +a
fi

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

# ── Notarization kimliğini ERKEN doğrula ────────────────────────────────────
# 20 dakikalık build'in SONUNDA "401 Invalid credentials" almak yerine, Apple'a
# hafif bir sorgu atıp kimlik bilgilerini saniyeler içinde doğrularız. En sık
# hata: APPLE_PASSWORD'ün normal Apple ID parolası olması (uygulamaya özel olmalı).
echo "→ Apple notarization kimlik bilgileri doğrulanıyor (build'den önce)..."
NOTARY_OK=1
if [ "$HAS_APPLEID" -eq 1 ]; then
  NOTARY_OUT="$(xcrun notarytool history \
    --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" 2>&1)" || NOTARY_OK=0
else
  NOTARY_OUT="$(xcrun notarytool history \
    --key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER" 2>&1)" || NOTARY_OK=0
fi
if [ "$NOTARY_OK" -eq 0 ]; then
  echo ""
  echo "HATA: Apple notarization kimlik doğrulaması BAŞARISIZ — build başlatılmadı."
  echo "  Apple yanıtı: $NOTARY_OUT"
  echo ""
  if [ "$HAS_APPLEID" -eq 1 ]; then
    echo "  EN OLASI NEDEN: APPLE_PASSWORD normal Apple ID parolanız (401 buradan gelir)."
    echo "  ÇÖZÜM:"
    echo "   1) https://appleid.apple.com > Oturum aç > 'Uygulamaya Özel Parolalar' > yeni üret"
    echo "      (biçim: xxxx-xxxx-xxxx-xxxx)"
    echo "   2) scripts/signing.env.local içinde APPLE_PASSWORD'ü bu parolayla değiştir."
    echo "   3) APPLE_ID (e-posta) ve APPLE_TEAM_ID doğru mu kontrol et (security find-identity çıktısındaki TEAMID)."
  else
    echo "  App Store Connect API anahtarı geçersiz: APPLE_API_ISSUER / APPLE_API_KEY (Key ID) /"
    echo "  APPLE_API_KEY_PATH (.p8) değerlerini kontrol et."
  fi
  echo ""
  echo "  Notarize etmeden sadece çalışan bir DMG istiyorsan: npm run desktop:build:unsigned"
  exit 1
fi
echo "  ✓ Notarization kimlik bilgileri geçerli."

# ── Build ───────────────────────────────────────────────────────────────────
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
export CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
export CARGO_HTTP_TIMEOUT=600
export CARGO_NET_RETRY=10
export REACT_APP_COURSE_INTELLECT_ENV=production

# Desktop/iCloud File Provider altında üretilen .app paketlerine macOS,
# codesign'ın reddettiği FinderInfo/resource-fork öznitelikleri ekleyebiliyor.
# Cargo/Tauri paketleme hedefini File Provider dışına alarak bu yarışı kökten
# engelliyoruz. İstenirse mutlak bir SCHOOLASIST_MACOS_TARGET_DIR ile ezilebilir.
export CARGO_TARGET_DIR="${SCHOOLASIST_MACOS_TARGET_DIR:-/private/tmp/schoolasist-tauri-target}"
case "$CARGO_TARGET_DIR" in
  /*) ;;
  *)
    echo "HATA: CARGO_TARGET_DIR mutlak bir yol olmalıdır: $CARGO_TARGET_DIR"
    exit 1
    ;;
esac
mkdir -p "$CARGO_TARGET_DIR"

# DMG arka planı (mevcut akışla aynı)
swift scripts/generate-dmg-background.swift

# Bu script tauri'yi doğrudan çağırdığı için npm'in pre-hook'u devreye girmez;
# ortam temizliği (provenance + bağlı kalmış DMG diskleri) burada elle yapılır.
bash scripts/macos-build-preflight.sh

# create-dmg, Finder ile geçici diskin hazır olması arasında macOS'a özgü
# kesintili bir yarış yaşayabiliyor (AppleScript -1728 / bundle_dmg.sh).
# İmza veya kaynak hatasını gizlemeden, yalnız paketleme akışını temizleyip en
# fazla üç kez deneriz. Böylece aynı komut kullanıcı müdahalesi olmadan güvenilir
# biçimde sonuçlanır.
BUILD_OK=0
for BUILD_ATTEMPT in 1 2 3; do
  if node ./node_modules/@tauri-apps/cli/tauri.js build --bundles dmg; then
    BUILD_OK=1
    break
  fi

  if [ "$BUILD_ATTEMPT" -lt 3 ]; then
    echo "UYARI: DMG paketleme denemesi $BUILD_ATTEMPT başarısız; bağlı geçici diskler temizlenip yeniden deneniyor..."
    bash scripts/macos-build-preflight.sh
    sleep $((BUILD_ATTEMPT * 3))
  fi
done

if [ "$BUILD_OK" -ne 1 ]; then
  echo "HATA: DMG üç denemede de paketlenemedi."
  exit 1
fi

# Yanlışlıkla imzasız/notarize edilmemiş bir dosyanın müşteriye gönderilmesini
# engellemek için build başarılı olsa bile Apple güven zincirini ayrıca doğrula.
bash scripts/verify-macos-distribution.sh "$CARGO_TARGET_DIR"

DMG_PATH="$(find "$CARGO_TARGET_DIR" -type f -path '*/bundle/dmg/*.dmg' -print -quit)"
OUTPUT_DIR="$PWD/dist/macos"
mkdir -p "$OUTPUT_DIR"
FINAL_DMG="$OUTPUT_DIR/$(basename "$DMG_PATH")"

# Notarize edilmiş DMG'yi proje içine metadata taşımadan kopyala. DMG içindeki
# imzalı ve stapled .app aynen korunur; yalnızca dış dosyanın Finder öznitelikleri
# engellenir.
ditto --noextattr --noqtn "$DMG_PATH" "$FINAL_DMG"
xattr -c "$FINAL_DMG" 2>/dev/null || true
hdiutil verify "$FINAL_DMG" >/dev/null

echo ""
echo "✓ Developer ID ile imzalanmış ve Apple tarafından notarize edilmiş DMG hazır:"
echo "  $FINAL_DMG"
echo "  Bu dosya diğer Mac'lerde xattr veya Terminal komutu gerektirmez."
