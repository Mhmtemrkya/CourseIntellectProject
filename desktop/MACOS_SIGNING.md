# macOS İmzalama ve Notarization

SchoolAsist masaüstü DMG'sini, kullanıcıların Gatekeeper uyarısı almadan
kurabilmesi için **Developer ID ile imzalayıp Apple'a notarize ettirmek**
gerekir. Yapılandırma hazırdır; yalnız Apple Developer kimlik bilgilerini
sağlayıp tek komut çalıştırırsınız.

## Ön koşullar (bir kez)

1. **Apple Developer Program üyeliği** (yıllık ~$99) — https://developer.apple.com/programs/
2. **Developer ID Application sertifikası** (geliştirme sertifikası DEĞİL):
   - Xcode → Settings → Accounts → hesabınızı seçin → *Manage Certificates…*
   - **+** → **Developer ID Application** → oluştur.
   - Kontrol: `security find-identity -v -p codesigning | grep "Developer ID Application"`
3. **Notarization kimliği** — iki yöntemden biri:
   - **Apple ID yöntemi:** appleid.apple.com → *Uygulamaya özel şifre* oluşturun.
   - **API anahtarı yöntemi (CI için önerilir):** App Store Connect → Users and
     Access → Integrations → Keys → **+** ile bir anahtar (.p8) oluşturun.

> Not: Yapılandırma zaten hardened runtime, kamera/mikrofon entitlements ve
> `NSCameraUsageDescription`/`NSMicrophoneUsageDescription` içerir
> (`src-tauri/Entitlements.plist`, `src-tauri/Info.plist`). Notarization için
> gereken bunlardır.

## Build

Ortam değişkenlerini ayarlayıp tek komut:

```bash
# İmza kimliği (boş bırakılırsa keychain'den otomatik bulunur)
export APPLE_SIGNING_IDENTITY="Developer ID Application: Adiniz (TEAMID)"

# Notarization — YÖNTEM A: Apple ID
export APPLE_ID="apple-hesabiniz@ornek.com"
export APPLE_PASSWORD="uygulamaya-ozel-sifre"
export APPLE_TEAM_ID="TEAMID"

# Notarization — YÖNTEM B: API anahtarı (A yerine)
# export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# export APPLE_API_KEY="XXXXXXXXXX"
# export APPLE_API_KEY_PATH="/mutlak/yol/AuthKey_XXXXXXXXXX.p8"

npm run desktop:build:signed
```

Tauri bu değişkenler varken DMG'yi Developer ID + hardened runtime ile imzalar,
Apple'a gönderip notarize eder ve bileti pakete "staple" eder. Çıktı:
`src-tauri/target/release/bundle/dmg/`.

## Doğrulama

```bash
DMG=src-tauri/target/release/bundle/dmg/SchoolAsist_*_aarch64.dmg
spctl -a -t open --context context:primary-signature -v "$DMG"   # accepted
xcrun stapler validate "$DMG"                                     # validated
```

## Sık karşılaşılanlar

- **"Developer ID Application sertifikası bulunamadı":** Elinizde yalnız *Apple
  Development* sertifikası var; bu dağıtım için kullanılamaz — yukarıdaki 2.
  adımı yapın.
- **Notarization reddi (Invalid):** `xcrun notarytool log <submission-id>
  --apple-id … --team-id …` ile ayrıntıya bakın; genellikle imzasız ikili
  veya eksik hardened runtime kaynaklıdır (bu repo yapılandırması bunları
  otomatik halleder).
- **CI/CD:** Sertifikayı `.p12` olarak base64'leyip `APPLE_CERTIFICATE` ve
  `APPLE_CERTIFICATE_PASSWORD` env'leriyle sağlayabilirsiniz; Tauri geçici bir
  keychain'e alır. API anahtarı yöntemiyle birlikte tam otomatik pipeline olur.

## Windows

Windows tarafında imza için Authenticode sertifikası gerekir; `tauri.conf.json`
→ `bundle.windows.certificateThumbprint` (veya `signCommand`) ile ayarlanır ve
`nsis` hedefi imzalanır. macOS notarization'dan bağımsızdır.
