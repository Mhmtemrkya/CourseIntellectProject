# Mağaza Yükleme Kılavuzu (App Store + Google Play)

Uygulamanın teknik yapılandırması yüklemeye hazırdır. Kalan adımlar **sizin
Apple/Google hesaplarınıza ait imza kimlikleri** ve mağaza panellerindeki
listeleme bilgileridir — bunlar koda gömülemez, siz sağlarsınız.

## Mevcut durum (denetlendi)

| Öğe | Android | iOS |
|-----|---------|-----|
| Paket / Bundle kimliği | `com.courseintellect.student` ✓ | `com.courseintellect.student` ✓ |
| Görünen ad | SchoolAsist ✓ | SchoolAsist ✓ |
| Sürüm | `0.1.0+1` (pubspec) ✓ | 1.0 (build 1) ✓ |
| Hedef SDK / min sürüm | targetSdk 36 ✓ / min Flutter | iOS 15.0 ✓ |
| Launcher ikonları | üretildi ✓ | üretildi ✓ |
| İzin açıklamaları | manifest tam ✓ | Info.plist tam ✓ |
| Şifreleme beyanı | — | `ITSAppUsesNonExemptEncryption=false` ✓ |
| **Release imzası** | **keystore GEREKLİ** ⚠ | Distribution profili GEREKLİ ⚠ |

> **Paket adı notu:** Kimlik `com.courseintellect.student` (eski marka) —
> derin link şeması, API ve dahili anahtarlarla tutarlı. Mağazada kullanıcı
> **SchoolAsist** adını görür; paket adı iç kimliktir. **İlk yüklemeden sonra
> paket adı DEĞİŞTİRİLEMEZ**, o yüzden şimdiden değiştirmek isterseniz (ör.
> `com.schoolasist.app`) ilk yüklemeden ÖNCE karar verin.

---

## Google Play (Android)

### 1. Upload keystore (bir kez — İYİ YEDEKLEYİN)

```bash
keytool -genkey -v -keystore ~/schoolasist-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

`android/key.properties` oluşturun (`.gitignore`'da, repoya girmez —
`key.properties.example`'ı kopyalayıp doldurun):

```
storeFile=/Users/KULLANICI/schoolasist-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

> `build.gradle.kts` `key.properties` varsa release'i bu anahtarla imzalar,
> yoksa debug'a düşer (Play bunu reddeder). Anahtarı KAYBETMEYİN — Play App
> Signing kullansanız bile upload anahtarı gerekir.

### 2. App Bundle üret

```bash
flutter build appbundle --release
# çıktı: build/app/outputs/bundle/release/app-release.aab
```

### 3. Play Console

- Yeni uygulama → dil, ad (SchoolAsist), kategori.
- **Play App Signing**'i açın (önerilir).
- `.aab`'yi Internal testing → Production yoluyla yükleyin.
- **Data safety** formu: topladığınız veriler (ad, e-posta, konum-servis,
  kamera) beyan edilmeli.
- **Background location** izni için ayrı gerekçe formu doldurulur (servis
  şoförü canlı takibi) — video/açıklama istenebilir.
- Ekran görüntüleri (telefon + tablet), 512×512 ikon, feature graphic
  (1024×500), gizlilik politikası URL'si (siteyle uyumlu).

---

## App Store (iOS)

### 1. İmza (Xcode otomatik)

- `project.pbxproj`: `CODE_SIGN_STYLE=Automatic`, `DEVELOPMENT_TEAM` set.
- Apple Developer Program üyeliği gerekir; Xcode otomatik Distribution
  sertifikası + provisioning profile üretir.

### 2. Archive + yükle

```bash
flutter build ipa --release
# veya Xcode: ios/Runner.xcworkspace → Product > Archive > Distribute App
```

`build/ios/archive` → Xcode Organizer → **Distribute App** → App Store Connect.
(CLI: `xcrun altool`/`notarytool` yerine Transporter veya `xcrun altool`.)

### 3. App Store Connect

- Yeni uygulama → SchoolAsist, bundle `com.courseintellect.student`.
- Ekran görüntüleri (6.7", 6.5", iPad), açıklama, anahtar kelimeler,
  destek/gizlilik URL'leri, **App Privacy** (toplanan veriler) formu.
- Konum "Always" ve kamera kullanımı review'da gerekçelendirilir
  (servis takibi / sınav gözetimi) — Info.plist açıklamaları hazır.
- Şifreleme sorusu Info.plist beyanıyla otomatik "muaf" geçer.

---

## Yayından önce önerilenler (opsiyonel, engel değil)

- Sürümü `1.0.0+1` yapmak (pubspec `version:`) — mağazalarda 1.0.0 daha temiz.
- `flutter build appbundle --analyze-size` ile boyut kontrolü.
- Gerçek cihazda release build ile duman testi (özellikle bildirim/konum/kamera
  izin akışları ve derin link/PKCE girişi).
- R8/ProGuard küçültme (isMinifyEnabled) — plugin kuralları test edilmeden
  açılmamalı; şu an kapalı ve güvenli.
