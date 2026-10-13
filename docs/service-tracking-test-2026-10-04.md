# Servis takip testi — 4 Ekim 2026

## Sonuç

8 backend testi ve 7 Flutter ekran testi geçti. Servis dosyalarının statik analizi hatasız tamamlandı. Testler geçici SQLite veritabanı ve sentetik ekran verileri kullandı; canlı kurum kayıtları değiştirilmedi.

Veli ve öğrenci ekranında OpenStreetMap haritası, durak ve araç işaretleri, mesafe, tahmini varış ve son konum zamanı bulunuyor. Şoför ekranındaki rota önizlemesi çizimdir; gerçek bir harita değildir. Mesafe kuş uçuşu, varış tahmini mesafe ve hız üzerinden hesaplanır; trafik/yol ağı kullanılmaz.

## Doğrulanan senaryolar

- Şoförün gönderdiği son konumun veli ve öğrenci durum sorgularına yansıması; mesafe ve ETA hesapları.
- Konum gelmeden önce durak bilgisi ve bekleme durumu.
- Sabah ve akşam seferlerinde başlatma, biniş, varış, tamamlanma, geçmiş ve bildirim çağrıları.
- Başka velinin kayıtları görememesi; başka şoförün konum gönderememesi; geçersiz koordinatların reddedilmesi.
- Flutter ekranında gerçek harita widget'ı, konum olayıyla işaretin hareketi, ilgisiz olayların yok sayılması.
- İlk konum sonradan geldiğinde araç ve durağın görünür kalması.
- Öğrenci akışı, boş atama durumu, yoklama güncellemesi ve 20 saniyelik sorgu yenilemesi.

İki hata giderildi: harita işareti etiketlerinin taşması ve konum değişiminden sonra harita kamerasının eski alanda kalması.

iPhone 16 / iOS 18.1 simülatöründe gerçek OpenStreetMap görsellerinin yüklendiği gözlendi. İki sentetik konum gönderildi; harita hem servis hem durağı görünür tuttu ve mesafe/ETA 14,2 km / 29 dk değerinden 1,4 km / 3 dk değerine güncellendi. Ekran görüntüsü: `outputs/service-tracking-ios-test.png`.

## Tekrar çalıştırma

```sh
dotnet test backend/CourseIntellect.Tests/CourseIntellect.Tests.csproj --no-restore --filter FullyQualifiedName~ServiceTrackingFlowTests
cd mobile
flutter test test/service_live_status_page_test.dart
flutter run -d DEVICE_ID -t tool/service_tracking_smoke.dart
```

Son komut, gerçek uygulama ekranını gerçek harita görselleriyle açar. Sefer ve konum olayları açıkça simüledir; üretim API'sine bağlanmaz. “Konum gönder” düğmesi iki örnek araç konumu arasında geçiş yapar.

## Henüz doğrulanmayanlar

Gerçek sunucu üzerinden şoför–veli uçtan uca oturumu, gerçek SignalR bağlantısındaki olay teslimi, fiziksel iPhone GPS'i, ekran kilitliyken/arka planda konum gönderimi ve APNs/FCM bildiriminin cihazda görünmesi bu testlerle doğrulanmış değildir. Bildirim testleri servis çağrılarını kaydeder; cihaz teslimini ölçmez.

Bunlar için aynı demo kurum/rotaya bağlı şoför, veli ve öğrenci hesaplarıyla sefer açılmalı. İki cihazda konum değişimi izlenmeli; şoför telefonu kilitlendikten sonra veli ekranındaki zaman/işaretin yenilendiği ve sefer tamamlanınca gönderimin durduğu kontrol edilmelidir.
