# Apple gönderim durumu — 5 Ekim 2026

## iOS: incelemeye gönderildi

SchoolAsist iOS **1.0.0 (5)**, 5 Ekim 2026 saat **19:07 Europe/Istanbul**
Apple incelemesine gönderildi. Canlı App Store Connect durumu:
**Waiting for Review**. Gönderim ön kontrolünde eksik alan kalmadı.
Yayın **manuel**: Apple onayından sonra ayrıca yayın işlemi yapılacak.

- Türkçe mağaza bilgileri, Education kategorisi ve 4+ yaş derecelendirmesi kaydedildi.
- Fiyat ücretsiz; dağıtım Türkiye.
- Altı iPhone 6.5 inç (1284×2778) ve altı iPad 13 inç (2064×2752) görsel yüklendi.
- Görsel sırası: Panel → Akademik → Operasyon → Raporlar → Finans → Giriş.
- Build 5, inceleme hesabı ve kullanıcı tarafından onaylanan iletişim bilgileri kaydedildi.
- Gizlilik beyanındaki 16 veri türü kaynak envanteri/manifestle karşılaştırıldı:
  App Functionality, kullanıcıyla ilişkili, reklam takibi yok.
- Kullanıcının son doğruluk/mevzuat/güncelleme kabulü onayından sonra
  gizlilik beyanı Publish edildi; Published durumu görüldü.
- Kullanıcı üçüncü taraf içerik haklarını doğruladı; Content Rights kaydedildi.

Kanıt: `outputs/app-store/ios-waiting-for-review-2026-10-05.png`.
Gizlilik kanıtı: `outputs/app-store/privacy-published.png`.
Görsel dosyaları ve SHA-256 manifesti:
`outputs/app-store/user-screenshots-2026-10-05/upload-manifest.json`.

## macOS: build 1 yüklendi; build 2 ve başvuru tamamlanacak

- Ayrı kayıt: SchoolAsist Desktop, Apple ID 6819349061, bundle com.courseintellect.desktop.
- Mac Installer Distribution sertifikası ve App ID oluşturuldu; Mac App Store profili hazır.
- Universal Intel + Apple Silicon PKG build 1 imzaları doğrulandı, Apple paket doğrulaması geçti ve upload başarılı.
- Build 1 teslim UUID: 0ede7895-7869-42b6-a9f9-6c9ae294c739.
- Kullanıcı açık onayıyla bu Mac test cihazı olarak kaydedildi ve yalnız bu uygulamaya ait geliştirme profili oluşturuldu.
- Development ile imzalanmış build 1 test kopyasında apple.admin girişi, pano, servis seferi ve Settings hesap/kurum silme alanları görüldü. Gerçek silme çalıştırılmadı.
- Kullanıcı açık onayıyla yalnız demo hesabında KVKK bilgilendirme teyidi ve kullanım koşulları kabul edildi; opsiyonel izinler kapalı tutuldu.
- Servis yönetimindeki sabit “API bekliyor” harita alanı tespit edilip mevcut sefer konumlarını gösteren ServiceLiveMap ile düzeltildi. SignalR ile yenilenen liveTrips kullanılır; konumsuz/geçersiz koordinatlar gösterilmez. CSP yalnız OpenStreetMap frame kaynağını ekler.
- TypeScript kontrolü ve üretim derlemesi geçti. Build 2 PKG imzalı hazır; henüz Apple’a yüklenmedi.
- Build 2: desktop/dist/appstore/SchoolAsist-2.pkg. SHA256: b578356556ce80cb533e97127c61e460d10e3f89d6735e1a13a3a68443d5ee8b.
- Build 2 test kopyası: outputs/mac-sandbox-test/build-2/SchoolAsist.app. Açıldı; şu anda giriş ekranında. Güncel harita henüz runtime olarak doğrulanmadı.
- Türkçe metadata, inceleme hesabı/iletişim, Education, 4+ ve ücretsiz fiyatlandırma hazır; ülke Türkiye, yayın manuel.
- Mac gizlilik URL’si kaydedildi. Manifestteki 15 veri türü seçildi; amaç/ilişkilendirme/takip ayrıntıları henüz tamamlanmadı, Publish yapılmadı.
- Mac ekran görüntüleri yüklenmedi; Mac review gönderilmedi.

Devam promptu: docs/apple-store-continuation-prompt-2026-10-05.md.

## Önceki kontrollerin kapsamı

Demo yönetici girişi HTTP 200 ve mustChangePassword=false; account-deletion/mine,
institution-deletion/mine ve servis rotaları HTTP 200; hukuk onayı sorgusu HTTP 204.
Bunlar önceki salt okunur kontrollerdir; gerçek silme finalizer/veri temizliği
akışının uçtan uca çalıştırıldığı anlamına gelmez. Bu mağaza işlemlerinde
backend deploy/restart yapılmadı. iOS IPA bütünlüğü ve SHA-256 daha önce doğrulandı.

Makine okunur sonuç: `outputs/apple-submission-readiness-latest.json`.

## Güncelleme — 5 Ekim 2026 (ikinci oturum)

Veli tarafı çevrimiçi (kart) ödeme kaldırıldı — App Store uyumu:
- Mobil: sahte kart formu `veli_online_odeme_page.dart` ve yalnız ondan erişilen
  `veli_odeme_makbuz_page.dart` silindi; iki giriş butonu (`veli_home_page.dart`
  "Online Ödeme", `veli_odeme_page.dart` "Online Ödeme Yap") kaldırıldı. Ödeme
  sekmesi (özet/taksit/geçmiş, gerçek veriden) ve `VeliFinancePage` korundu.
  `flutter analyze` temiz; artık mock kart alanı yok.
- Masaüstü: `ParentPayments.tsx` içindeki "Kayıtlı Kartlarım — kayıtlı
  kartlarınızla hızlı ve güvenli ödeme yapın" placeholder tile'ı kaldırıldı
  (grid 2 sütun). "Kredi/Banka Kartı" tile'ı dürüstçe "çevrimiçi ödeme
  kullanılamıyor" diyen bilgi; korundu. `tsc` temiz.
- iOS build 5 kararı (kullanıcı): build 5 incelemede kalır. Apple'a verilen demo
  hesap apple.admin (Yönetici); veli ödeme ekranına ulaşamaz, ekran
  görüntülerinde de yok → bu sorundan red riski düşük. Kaldırma bir sonraki iOS
  sürümünde yayınlanır (yeniden gönderim değil). iOS gönderimine dokunulmadı.
- Mac build 2 için desktop değişikliği yeniden derleme gerektirmez: Mac reviewer
  apple.admin (Yönetici) ile girer, ParentPayments'a ulaşamaz. Build 2 inceleme
  için geçerli; desktop veli değişikliği sonraki desktop build'ine girer.

Mac build 2 Apple doğrulaması: `xcrun altool --validate-app -t macos` →
**VERIFY SUCCEEDED with no errors** (5 Ekim 2026 23:02 İstanbul). Henüz upload
yapılmadı. Sıra gereği, upload/gönderim öncesi servis haritasının runtime
doğrulaması (GUI) ve Mac ekran görüntüleri bekliyor.

## Güncelleme 2 — 5 Ekim 2026 (Mac runtime + upload)

- Build 2 Apple doğrulaması ve YÜKLEMESİ başarılı: `xcrun altool --upload-app -t macos`
  → **UPLOAD SUCCEEDED**, Delivery UUID `c17c066a-5328-45a6-90b5-675f6d8e422f`
  (5 Ekim 23:37 İstanbul). Apple işlemesi ~15-60 dk; sonra sürüme bağlanabilir.
- Servis haritası runtime doğrulandı (dev-imzalı build 2 test kopyası, apple.admin):
  Servis Takip ekranında gömülü OpenStreetMap gerçek İstanbul karoları + yeşil araç
  işareti + OSM telifi + "Son konum: 5.10.2026 12:10:05" ile yüklendi; rota
  "TEST • Apple İnceleme Sabah Rotası (simülasyon)" etiketli (gerçek GPS gibi
  sunulmuyor). Kanıt: outputs/app-store/mac-build2-runtime-2026-10-05/.
- 5 Mac ekran görüntüsü alındı (2880×1800, 16:10): panel, akademik, operasyon,
  finans, servis. outputs/app-store/mac-screenshots-2026-10-05/ (+SHA256SUMS.txt).
  Henüz ASC'ye yüklenmedi. Veri seyrek (apple.admin demo).

### Mac için kalan (ASC — tarayıcı)
- 5 ekran görüntüsünü ASC'ye yükle.
- App Privacy: 15 veri türünün amaç/linked/tracking'ini tamamla + Publish
  (Publish öncesi kullanıcı onayı gerekir).
- İşleme bitince build 2'yi sürüm 1.2.4'e seç; export compliance.
- Add for Review + Submit (kullanıcı onayı gerekir).
- NOT: Claude-in-Chrome eklentisi bu oturumda BAĞLI DEĞİL → ASC DOM otomasyonu yok;
  ya eklenti bağlanmalı ya ekran-GUI otomasyonu kullanılmalı.

## Güncelleme 3 — 6 Ekim 2026 (Mac İNCELEMEYE GÖNDERİLDİ ✅)

ASC (Claude-in-Chrome eklentisi bağlandı) üzerinden tamamlanan Mac adımları:
- **5 Mac ekran görüntüsü yüklendi** (2880×1800): panel, akademik, operasyon, finans,
  servis. ASC'de "5 of 10 Screenshots" doğrulandı.
- **App Privacy PUBLISHED** (kullanıcı açık onayıyla): 15 veri türü, her biri yalnız
  "App Functionality" amacı, Linked=Yes (kullanıcı kimliğine bağlı), Tracking=No.
  Manifest (PrivacyInfo.appstore.xcprivacy) ile birebir. "Published by Oğuzhan Mindivanli".
- **Build 2 (1.2.4 (2))** sürüme bağlandı.
- **Export compliance**: App Encryption Documentation → "None of the algorithms
  mentioned above" (yalnız OS'un sağladığı HTTPS/TLS + keychain; muaf). iOS
  Info.plist ITSAppUsesNonExemptEncryption=false ile tutarlı. "Missing Compliance" temizlendi.
- Yayın **manuel** (iOS ile tutarlı).
- **Add for Review + Submit for Review** (kullanıcı açık onayıyla): "1 Item Submitted".
  Durum UI'da **"1.2.4 Waiting for Review"** olarak görüldü ve doğrulandı.
- Gönderim: 6 Ekim 2026 ~00:31 İstanbul. Kanıt: outputs/app-store/mac-waiting-for-review-2026-10-06.jpg.

### Durum
- iOS 1.0.0 (5): Waiting for Review (değiştirilmedi).
- macOS 1.2.4 (2): **Waiting for Review** (yeni).
- Her iki başvuru da manuel yayın; Apple onayından sonra ayrıca yayınlanacak.
- Red garanti edilemez. Apple inceleme ~48 saat içinde e-posta ile bildirir.

### Açık/kalan notlar
- Veli online (kart) ödeme kaldırma kodu worktree'de (commit edilmedi); sonraki
  iOS/desktop build'lerine girecek. Mevcut incelemedeki build'leri etkilemez
  (reviewer apple.admin=Yönetici, veli ödeme ekranına ulaşamaz).
- Mac ekran görüntüleri apple.admin demo kurumundan (veri seyrek).
