> Güncel uygulama ve dağıtım durumu: [5 Ekim 2026 raporu](apple-store-preparation-2026-10-05.md). Bu dosya önceki tasarım/hazırlık geçmişini içerir.

# SchoolAsist Apple mağaza hazırlığı — 2026-10-04

## Sonuç

iOS `0.1.0 (2)` imzalı TestFlight IPA export'u tamamlandı ve doğrulandı.
Mevcut Tauri masaüstü uygulamasına ayrı Mac App Store kanalı eklendi. Gizlilik
manifestleri ve uygulama içi metinler güncellendi. **Mac imzalı PKG ve mağaza
gönderimine hazır olma durumu henüz doğrulanmış değildir.** Hesap silme eksiktir.

## iOS

Bundle `com.schoolasist.app`, Team `RM53R2ZT6Q`, minimum iOS 15.0. ExportOptions'daki
yanlış ekip ID'si düzeltildi; yöntem `app-store-connect` yapıldı. Gerçek uygulama
giriş noktasıyla production build `2` arşivlendi:
`mobile/build/ios/archive/Runner.xcarchive` (yaklaşık 252 MB).

IPA export denemeleri (`-allowProvisioningUpdates` dahil) `No Accounts`,
`No signing certificate "iOS Distribution" found` ve eksik `com.schoolasist.app`
App Store profili hatalarıyla durdu. Keychain ve Xcode Manage Certificates'te
Apple Development/Developer ID var, Apple Distribution yok. Mevcut SchoolAsist
profilinin türü cihaz geliştirme; App Store distribution profili değil.

Xcode'daki mevcut hesabın oturumu düzeltilmeli; doğru ekip için Apple Distribution
sertifikası/private key ve iOS App Store Connect profili sağlanmalı. Sertifikalar
iptal edilmedi/değiştirilmedi; Apple'a paket yüklenmedi. Sonra mevcut arşiv
`bash scripts/export_ios_testflight.sh` ile yeniden derlemeden export edilir.
IPA doğrulayıcısı build/team/bundle, imza, profil türü/süresi, debug yetkisinin
kapalı olması, production APNs ve manifesti kontrol eder. Arşiv tek başına IPA değildir.

Son durum: kullanıcı Apple Distribution sertifikasını/private key'i oluşturdu.
Organizer üzerinden iOS Team Store Provisioning Profile alındı ve yerel export
başarılı oldu. Sonrasında CLI export da başarıyla tekrarlandı. Uygulama
`com.schoolasist.app`, sürüm `0.1.0`, build `2`; Apple Distribution imzası,
`aps-environment=production`, `get-task-allow=false`, `beta-reports-active=true`
ve 16 uygulama veri kategorisi doğrulandı. Paket yaklaşık 49 MB:
`outputs/app-store/SchoolAsist-iOS-0.1.0-2/SchoolAsist.ipa`.
SHA-256/versiyon/boyut bilgileri aynı klasörde `verification-summary.json`.
Apple'a yüklenmedi. Organizer uygulama kaydı oluşturma adımı gösterdi; paket
hazırlığında bu adım geçildi. Upload öncesinde App Store Connect kaydı gerekir.

Betik yerel manuel profili yalnız doğru sertifika, ekip, bundle, süre ve production
push eşleşiyorsa seçer. Xcode-managed profiller manuel imzalama ile kullanılamadığı
için otomatik modda kalır. Export'ta sürüm/build otomatik değiştirilmez.

## Mac App Store

`desktop/src-tauri/tauri.appstore.conf.json` ayrı kanalıdır. Identifier mevcut
`com.courseintellect.desktop`; bu kimliğe ait Apple Developer/App Store Connect
macOS kaydının varlığı doğrulanmadı. iOS ile universal purchase bağlantısı kurulmadı.

Mağaza kanalı: app bundle, Education kategorisi, App Sandbox, ağ istemcisi,
kamera/mikrofon ve kullanıcı seçimiyle dosya erişimi. Gerçek profilin uygulama/ekip
kimlikleri sandbox entitlements'a eklenir. Native updater/process pluginleri
çıkarılır; ayrı capability kümesi updater/restart izinlerini içermez. React
güncelleyicisi harici sunucuya bağlanmaz. Mevcut DMG kanalı güncelleyiciyi korur.

```bash
export MAS_PROVISIONING_PROFILE="/mutlak/yol/SchoolAsist-Mac-App-Store.provisionprofile"
export MAS_SIGNING_IDENTITY="Apple Distribution: <sertifika adı> (RM53R2ZT6Q)"
export MAS_INSTALLER_IDENTITY="3rd Party Mac Developer Installer: <sertifika adı> (RM53R2ZT6Q)"
cd desktop
npm run desktop:build:appstore -- 2
```

`Mac Installer Distribution:` isimli installer sertifikası da desteklenir.
App Store Connect'te kullanılmamış build numarası seçilmeli. Universal Rust hedefleri
`aarch64-apple-darwin` ve `x86_64-apple-darwin` olmalı. Betik profilin ekip/bundle/
süre/distribution türü/sertifika eşleşmesini ve private key içeren installer
kimliğini doğrular. Sandbox, profil ve manifesti kontrol ederek `productbuild`
ile `desktop/dist/appstore/SchoolAsist-<build>.pkg` üretir. Upload yapılmaz.

Apple Distribution artık mevcut; Mac Installer Distribution sertifikası ve uygun
macOS store profili hâlâ eksik olduğundan PKG üretilmedi. Gerçek sandbox çalıştırma
testi yapılmadı: Keychain oturumu,
dosya seçme/indirme, kamera/mikrofon, deep link ve canlı ders imzalı paketle denenmeli.

## Gizlilik denetimi

Önceki iOS manifestinde veri kategorileri boştu. iOS'a 16, masaüstüne 15 uygulama
veri kategorisi eklendi. Uygulama kayıtları hesapla bağlantılı; amaç uygulama işlevi.
Repo içinde reklam takibi görülmedi. Mac'te mobil FCM DeviceID ve Firebase SDK
manifestleri kullanılmaz; ayrı `PrivacyInfo.appstore.xcprivacy` paketlenir.

| Kategori | Kodda görülen kullanım |
| --- | --- |
| Ad/e-posta/telefon/adres | AppUser, StudentProfile, StaffProfile ve kayıt ekranları |
| Kullanıcı kimliği/diğer veriler | User ID/kullanıcı adı, TC, doğum tarihi, eğitim kayıtları |
| Diğer finans bilgileri | Maaş, taksit, borç/bakiye, muhasebe API'leri |
| Satın alma geçmişi | Kurum tahsilatları ve kantin siparişleri |
| Kesin konum | Mobil sürücü GPS/sefer akışı, masaüstünde durak koordinat kaydı |
| Mesaj/fotoğraf-video/ses/diğer içerik | MessageApiService, profil/ödev/soru ekleri |
| Destek talepleri | SupportTicketsApiService |
| Ürün etkileşimi | Eğitim içerik ilerlemesi ve operasyon kayıtları |
| Cihaz kimliği (iOS) | Hesaba kaydedilen FCM bildirim tokenı/cihaz kaydı |

Gerçek iOS arşivindeki 28 manifestin birleşiminde 17 veri türü var. Firebase SDK'ları
**OtherDataTypes** ve **OtherDiagnosticData** için analytics amaçları da bildiriyor.
App Store Connect'te yalnız uygulama manifestine bakılarak “analytics/teşhis yok”
seçilmemeli. JSON: `outputs/app-store/ios-archive-privacy-inventory.json`. Bu dosya
manifestlerin birleşimidir; son etiketler Xcode Organizer > Generate Privacy Report
ve production SDK ayarlarıyla kontrol edilmeli. Manifest App Store Connect formunu
otomatik doldurmaz. Sağlık raporu türü backend kursiyer şemasında var; istemci
kullanımı bulunmadı. Bu modül açılırsa sağlık verisi beyanı yeniden değerlendirilmelidir.

İki istemcideki metne sefer konumu, medya ekleri, OpenStreetMap ve FCM eklendi.
İstemci/backend yasal sürümü `2026-10-04.kvkk.v2` olarak eşleştirildi. Production
backend deploy edilmedi: yeni istemcinin onayı eski backend'e kaydedilemez. Yeni
backend ve eski istemci güncellemeleri birlikte planlanmalı. Gerçek veri sorumlusu,
saklama süreleri, sağlayıcı kullanımı ve canlı web gizlilik politikasının bu
envanterle eşleşmesi gönderimden önce tamamlanmalı.

## Hesap silme doğrulaması

Mobil login'de herkese açık kişisel kayıt formu yok. Yöneticiler uygulamada kullanıcı,
öğrenci/veli ve personel hesabı oluşturabiliyor. Web kurum başvurusu ve anonim
`tenants/register` endpoint'i de var. Bu nedenle “sadece login, silme gerekmez”
varsayımıyla gönderim yapılmamalı.

Kullanıcı uygulama içinden kendi hesabını silmeyi başlatamıyor. Admin
`DELETE /api/users/{id}` sadece AppUser satırını kaldırıyor; öğrenci/personel
profilleri, mesaj/medya, eğitim, sefer ve finans kayıtlarının kapsamlı silinmesini
sağlamıyor. Pasife alma da silme değildir.

Gönderim için tüm rollerde Profil > Hesabı Sil akışı; kimlik doğrulama ve açık onay;
sunucuda oturum/kurum kapsamı kontrolü; token/push iptali; ilişkili kişisel veri/medya
silme veya anonimleştirme; sonuç bildirimi gerekir. Kurum sahibi hesabında sahiplik
aktarımı ve yasal olarak tutulacak finans kayıtları ayrıca tasarlanmalı. Manuel
işleme varsa süre/durum kullanıcıya gösterilmeli. Yalnız destek/e-posta yönlendirmesi
Apple'ın genel şartını karşılamaz. **Bu denetimde gerçek kullanıcı verisi silinmedi;
hesap silme implementasyonu yapılmadı ve uyum sağlandı olarak işaretlenmedi.**

İlişki envanteri ve uygulanacak akış [hesap silme tasarımında](account-deletion-design.md).
Xcode profilleri yenilendiğinde de SchoolAsist için yalnız development profili
görüldü. Mac betiğinin Cargo argümanı gerçek Tauri CLI kontrolünde
`-- --no-default-features` olarak düzeltildi.

## Doğrulama

- iOS release archive ve son Organizer/CLI distribution export başarılı; ilk
  denemeler dağıtım varlıkları eksikken başarısızdı. Son IPA imzası/profili doğrulandı.
- Flutter analyze, desktop TypeScript, Rust default/MAS cargo check başarılı.
- Desktop updater testleri 2/2; backend gizlilik onayı + servis takibi 11/11 geçti.
- Tauri schema, plist ve shell sözdizimi kontrolleri geçti.
- Ek doğrulama: gerçek Tauri CLI ile production frontend + Apple Silicon native
  release derlemesi (`--no-bundle`) başarılı. Release ACL yalnız `mac-app-store`
  içeriyor; updater/restart izinleri yok. Bu çalışma imzalı sandbox paketi değildir;
  Intel/universal paket ve gerçek sandbox çalıştırması henüz doğrulanmadı.
- İmzalı Mac PKG, gerçek cihazda background GPS/production push, hesap silme ve
  App Store Connect son beyanları henüz tamamlanmadı.

## Resmi kaynaklar

- [Apple — Hesap silme](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple — Privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)
- [Apple — App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Tauri — App Store dağıtımı](https://v2.tauri.app/distribute/app-store/)
