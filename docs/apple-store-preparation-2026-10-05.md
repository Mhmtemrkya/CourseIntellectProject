# Apple dağıtımı — güncel durum, 5 Ekim 2026

## Sonuç

Hesap/kurum silme incelemesindeki kod sorunları çalışma alanında düzeltildi.
iOS `1.0.0 (5)` Apple Distribution imzasıyla üretildi, Xcode Organizer üzerinden
Apple'a başarıyla yüklendi ve TestFlight işlemesi tamamlandı (`Ready to Submit`).
`SchoolAsist Dahili Test` grubuna eklendi; grup iki build içeriyor ve build 5
`Testing` durumunda. Apple uygulama kaydı: `SchoolAsist`, ID `6819080463`.
App Store Connect, mevcut hesap sahibinin iPhone 15 cihazı için `Installed
1.0.0 (5)` gösterdi. Build 5'teki çocuk listesi düzeltmesinin ekran testi bekleniyor.

Önceki build 4'te gerçek iPhone üzerinde servis haritası, konum yenilemesi, biniş
durumu ve gerçek GPS gönderimi doğrulandı. GPS durduruldu ve demo son konumu
tekrar sentetik konuma çevrildi. Build 5, veli çocuk listesi ve Türkçe servis
etiketi düzeltmelerini içerir; dört çocuk listesi regresyon testi ve yedi servis
haritası testi geçti. Ayrıntılar `service-tracking-test-2026-10-05.md` içindedir.

App Review gönderimi yapılmadı. Canlı hesap/kurum silme uçları hâlâ HTTP 404;
backend güncellenmeli. Store metadata/gizlilik/ekran görüntüleri tamamlanmalı.
Mac App Store yapılandırması ve web derlemesi hazır; uygun Mac sertifika/profil
olmadan imzalı Mac PKG üretilemedi.

## Silme düzeltmeleri

- Kişisel profil, kullanıcı adı, rol geçmişi, iletişim, soru/ödev metinleri, ekler,
  denetim IP/cihaz/detay alanları ve bağlı kayıtlar temizlenir. Kurum silmede
  kurum iletişim/kayıt alanları ve saklanan fatura karşı tarafı/notları da temizlenir.
- Temizlenecek yerel dosyalar kalıcı `deletion_file_tasks` kuyruğuna alınır.
  Dosya hatası başarı sayılmaz; `Failed` talepler yeniden denenir. Başka bir
  kullanıcının/kurumun da referans verdiği dosya korunur. Paylaşılan ders içeriği
  yalnız öğretmenin hesap silme talebi nedeniyle silinmez.
- `Processing` durumu ve atomik talep alma, aynı talebin iki çalışan tarafından
  eşzamanlı başlatılmasını önler. Başlayan silme iptal edilemez. Tamamlanma bildirimi
  ancak veri ve dosya temizliği başarılı olunca gönderilir.
- Eski ad/sınıf eşlemesi belirsizse talep tamamlandı gösterilmez. Platform kuyruğu
  inceleme gereken kişisel talepleri ve PII içermeyen hata kodunu gösterir.
  Gerçek kayıtların hangi kullanıcıya ait olduğunu bir operatör doğrulamalıdır;
  sistem isim çakışmasını tahmin ederek başkasının eğitim kaydını temizlemez.
- Tek yöneticinin personel olmadan da kişisel silme talebi açması sağlanır.
  Devir isteğe bağlıdır; kendine veya silme talebi olan kullanıcıya devir engellenir.
  Devralanın yönetici kapsamı ve oturum güvenlik sürümü güncellenir. Devir talep
  anında gerçekleşir; kişisel silmenin iptali yapılan yönetici devrini geri almaz.
- Sürücü ve yemekhane ana ekranlarında hesap silme girişi bulunur. Sürücü ekranının
  kapanırken `setState` çağırması düzeltildi. Parola alanları gönderme butonunu
  doğru yeniler; ilk kurum talebi öncesinde etki önizlemesi gösterilir.
- Parola doğrulayan talep uçları mevcut `auth` hız sınırına bağlandı.
  Mobil, masaüstü ve backend hukuk sürümü `2026-10-04.kvkk.v3` olarak eşleşir.
  Metinlerde 30 günün iptal penceresi olduğu, hukuki saklama süresi olmadığı açıklanır.

## Doğrulama

- Backend test paketinin tamamı: **661 geçti, 5 atlandı**. Atlanan PostgreSQL
  silme testlerinden ikisi ayrıca izole yerel PostgreSQL'de çalıştırıldı: **2 geçti**.
  Diğer üç PostgreSQL testi ayrı test veritabanı isteyen farklı eşzamanlılık senaryolarıdır.
- Yeni migration tüm şemayla iki ayrı izole PostgreSQL veritabanında uygulandı.
  Migration, eski `Failed` ile yeni aktif talep çakışmalarını sessizce silmek yerine
  indeksleri değiştirmeden durduracak bir ön kontrol içerir. Sentetik çakışan
  taleplerle bu kontrol ayrıca sınandı: migration durdu, iki talep de korundu;
  sentetik çakışma kaldırılınca migration başarıyla uygulandı.
- Mobil hesap silme ve servis haritası widget testleri: **11 geçti**.
  Değişen mobil dosyaların statik analizi temiz.
- Masaüstü TypeScript kontrolü, Mac App Store üretim web derlemesi ve harici
  güncelleyiciyi engelleyen iki test geçti.
- Marketing gizlilik/KVKK sayfaları lint ve TypeScript kontrolünden geçti.
- iOS IPA: bundle `com.schoolasist.app`, takım `RM53R2ZT6Q`, iOS 15 minimum,
  App Store provisioning, Apple Distribution imzası, production APNs,
  `get-task-allow=false` ve gizlilik manifesti doğrulandı.

Güncel paket: `outputs/app-store/SchoolAsist-iOS-1.0.0-5/SchoolAsist.ipa`.
Build 5 veli çocuk listesi ve Türkçe servis etiketi düzeltmelerini içerir.
İlk yükleme disk alanı hatası verdi; yeniden üretilebilir derleme önbellekleri
temizlendikten sonra aynı build 5 Apple'a başarıyla yüklendi.
Yükleme kanıtı: aynı klasörde `upload-complete.png`; TestFlight hazır durumunun
kanıtı aynı klasörde `testflight-ready.jpg`.
SHA-256 ve doğrulama durumu aynı klasörde `verification-summary.json` içindedir.
Backend kaynak değişiklikleri IPA'nın içine gömülmez; ayrıca dağıtılmalıdır.

## Apple yüklemesi ve canlı test hesapları

App Store Connect oturumu ve `com.schoolasist.app` uygulama kaydı tamamlandı.
Önceki `0.1.0 (3)` kayıtsız uygulama hatası aşıldı. Yeni `1.0.0 (4)` arşivi
Apple sunucu doğrulamasından geçti; Xcode “SchoolAsist 1.0.0 (4) uploaded”
sonucunu gösterdi. Bu, App Review onayı veya gerçek cihaz testi değildir.
TestFlight sayfasında yüklemeden sonraki ilk kontrolde build henüz görünmedi;
sonraki yenilemede `Version 1.0.0 / Build 4 / Ready to Submit` görüldü.

Kullanıcının paylaştığı seed çıktısı transaction'ın COMMIT ile tamamlandığını,
16 kaydın eklendiğini ve sekiz demo kullanıcısının bulunduğunu gösteriyor.
Demo kurum: `SchoolAsist Demo Okulu`; hesaplar `apple.admin`, `apple.muduryrd`,
`apple.sube`, `apple.ogretmen`, `apple.muhasebe`, `apple.yemekhane`, `apple.veli`,
`apple.ogrenci`. Parola App Review bilgisi olarak ayrıca girilmeli; bu raporda
parola veya erişim token'ı saklanmıyor.

Normal TLS doğrulamasıyla yapılan canlı kontroller:

- `apple.admin` login: HTTP 200, `primaryRole=Admin`,
  `mustChangePassword=false`, `subscriptionRequired=false`.
- `GET /api/account-deletion/mine`: HTTP **404**.
- `GET /api/institution-deletion/mine`: HTTP **404**.
- `GET /api/legal-consent/me`: HTTP 204.

5 Ekim ek kontrolünde sekiz demo hesabının tamamı HTTP 200 ile giriş yaptı;
her biri doğru demo kurumuna ve beklenen role bağlandı, `mustChangePassword=false`
döndü. Sonuçlar `outputs/apple-review-account-check-2026-10-05.json` içindedir.
Her rolün tüm mobil ekranları ayrıca sınanmadı. Bu çalışmada
canlı DB seed'i tekrar çalıştırılmadı, kod dağıtılmadı, servis yeniden başlatılmadı
ve canlı hesap/kurum silme talebi gönderilmedi.

Mac için Apple Distribution mevcut; **Mac Installer Distribution sertifikası ve
uygun macOS App Store provisioning profili hâlâ eksik**. Developer ID/DMG imzası
bu eksikleri karşılamaz. İmzalı universal PKG ve gerçek App Sandbox testi yoktur.

## Canlı dağıtım ve gönderim öncesi

1. Onaylı veri saklama politikasının finans/eğitim kayıtları için kapsamı ve süresi
   netleştirilmeli. Kalan satırların tamamının hukuken anonim olduğu iddia edilmez.
   Yedekler ve üçüncü taraf hizmetler de gerçek saklama/silme politikasında ele alınmalı.
2. Backend ve marketing güncel sürümle dağıtılmalı; yeni migration önce taze DB ve
   yükleme dosyası yedeğiyle prova edilmeli. Eski çakışan talepler ve inceleme gerektiren
   ad eşlemeleri kontrol edilmeli. Üretimde finalizer bayrakları, bekleyen talepler ve
   dosya izinleri doğrulanmalı. Bu çalışmada canlı hesap/kurum silinmedi ve dağıtım yapılmadı.
3. `1.0.0 (5)` için Apple işlemesi ve dahili test dağıtımı tamamlandı.
   iPhone 15 kurulumu ve temel servis akışları doğrulandı; iPad, kilitli cihazdaki
   sürekli GPS ve bildirim teslimi ayrıca doğrulanmalı. Sonraki IPA için daha önce kullanılmamış build numarası seçilmeli.
4. Mac sertifika/profili eklenmeli, PKG üretilmeli; Keychain oturumu, dosya seçimi,
   kamera/mikrofon, deep link ve canlı ders imzalı sandbox uygulamasında denenmeli.
5. İncelemeye ayrılmış kurum ve rol hesapları, gizlilik beyanları, destek/gizlilik
   URL'leri, ekran görüntüleri, yaş derecelendirmesi ve inceleme notları tamamlanmalı.
6. Gerçek iPhone/iPad üzerinde oturum, hesap silme, canlı servis konumu, kilitli
   cihazdaki GPS ve bildirim akışı denenmeli. Widget testleri bu cihaz testinin yerine geçmez.

Önceki inceleme ve dağıtım geçmişi: `account-deletion-review-2026-10-04.md`,
`apple-store-preparation-2026-10-04.md`.
