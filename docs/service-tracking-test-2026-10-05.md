# Servis takip — canlı API ve gerçek iPhone testi, 5 Ekim 2026

## Sonuç

TestFlight `1.0.0 (4)` uygulaması kullanıcının bağlı iPhone 15 cihazında iPhone
Yansıtma üzerinden test edildi. Canlı API'ye bağlı veli ekranında OpenStreetMap
haritası, araç/durak işaretleri, mesafe, ETA ve son konum zamanı doğrulandı.
Konum güncellemesinden sonra ekran yenileme düğmesine basılmadan araç işareti,
kamera, mesafe ve ETA değişti. Biniş işaretlemesinden sonra `Servise bindi`
durumu da otomatik göründü. SignalR ile 20 saniyelik sorgu yenilemesi arasında
hangi mekanizmanın değişikliği teslim ettiği ayrı ölçülmedi.

İlk iki harita konumu **sentetik test verisiydi**. Sonrasında fiziksel GPS de
sınandı (aşağıda).
Kullanıcının izninden sonra gerçek iPhone GPS gönderimi başlatıldı. Şoför
ekranı başarılı gönderim gösterdi; demo veli API'si sentetik olmayan yeni konumu
aldı. Test sonunda telefondaki `GPS Durdur` ile gönderim durduruldu. Koordinatlar
rapora veya test çıktısı dosyasına kaydedilmedi.
Arka plan/kilitli cihazda hareket sırasında sürekli konum ve APNs/FCM cihaz
teslimi henüz doğrulanmadı. GPS kapatıldıktan sonra demo haritasının son konumu
tekrar sentetik İstanbul test konumuna çevrildi.

## Demo kurumda hazırlanan veriler

Yalnızca `a0000000-0000-4000-8000-000000000001` kimlikli SchoolAsist Demo Okulu:

- `APPLE-TEST-01`, `34 TEST 001`, 16 kişilik test aracı.
- `apple.admin` mevcut hesabına şoför profili; yönetici rolü değişmedi.
  Bu profil yöneticinin mevcut `Şoför Ekranı` seçeneğinden test içindir;
  ayrı `apple.sofor` hesabı oluşturulmadı.
- `TEST • Apple İnceleme Sabah Rotası (simülasyon)`, aktif sabah rotası.
- `TEST • Demo Durağı`, sentetik İstanbul koordinatı.
- Mevcut `Demo ÖĞRENCİ` / `apple.veli` için servis ataması.
- Bugünün aktif demo seferi ve test biniş kaydı.

Kayıt kimlikleri `outputs/service-tracking-live-demo-2026-10-05.json` içinde.
Kaynak kod dağıtılmadı; backend yeniden başlatılmadı; SSH/DB seed çalıştırılmadı.
Kayıtlar uygulamanın mevcut canlı API uçlarından eklendi. Tekrar oluşturma sırasında
mevcut test aracı, rota, durak ve atama aranarak mükerrer kayıt önlendi.

## Doğrulanan sonuçlar

- Yönetici, veli ve öğrenci login ve servis durum uçları HTTP 200 döndü.
  Her oturumun demo kurum kimliği doğrulandı.
- İlk konum `41.02, 28.99`: API 1393 metre / 3 dakika;
  iPhone 1,4 km / 3 dakika gösterdi.
- İkinci konum `41.10, 29.10`: API 14191 metre / 29 dakika;
  iPhone 14,2 km / 29 dakika gösterdi. Harita her iki işareti görünür tuttu.
- Biniş API'si `Boarded` döndü; iPhone `Servise bindi` gösterdi.
- Öğrenci hesabının API durumu aynı atama/seferi gösterdi; öğrenci mobil ekranı
  bu çalışmada fiziksel cihaz üzerinde ayrıca açılmadı.

Kanıtlar:

- `outputs/service-iphone-live-map-near.png`
- `outputs/service-iphone-live-map-far.png`
- `outputs/service-iphone-live-map-boarded.png`

## Ek gözlemler ve kalan kontroller

Veli ana sayfasında `Aras ARSLAN / 1-A` görüldü; canlı veli `/api/students`
cevabı yalnız beklenen `Demo ÖĞRENCİ` kaydını içeriyor ve bu başka adı içermiyor.
Servis ekranı doğru Demo ÖĞRENCİ'yi gösterdi. Ana sayfadaki önbellek/seçili çocuk
akışı aşağıdaki düzeltmeyle sunucudan taze çocuk listesi alacak şekilde değiştirildi;
build 5 ile cihaz doğrulaması bekleniyor.
Build 4 sefer etiketi `InProgress` olarak görünüyor; build 5 için
`Sefer sürüyor` Türkçe metni eklendi. Bu gözlemler servis konum verisinin doğru güncellendiği
sonucunu değiştirmez, tüm uygulamanın gönderime hazır olduğunu kanıtlamaz.

Mesafe kuş uçuşudur. Haritadaki bağlantı çizgisi gerçek yol güzergâhı değildir;
ETA trafik/yol ağı kullanmaz. Bildirim sunucu çağrısı başarıyla tamamlandı;
bu, cihazda APNs/FCM tesliminin doğrulandığı anlamına gelmez.

## Testte bulunan mobil düzeltmeler

Çocuk seçimi artık önceki oturumun `StudentRegistryStore` önbelleğini kullanmıyor.
Veli oturumuyla sunucudan taze `/api/students` listesi alınıyor; ad/soyad ve ilk
iki öğrenci fallback'leri kaldırıldı. Yanıt sırasında hesap değişirse sonuç
atılır; oturumsuz ve yönetici oturumları veli seçicisini dolduramaz. Çocuk seçicide
hata durumunda yeniden deneme sunulur. Rastgele harici avatar kaldırıldı.
Servis `InProgress` etiketi `Sefer sürüyor` olarak gösterilir.

Dört oturum/çocuk listesi regresyon testi ve yedi servis haritası testi geçti
(**11 test**); değişen dosyaların Flutter analizi temiz. Bu değişiklikler
`1.0.0 (5)` TestFlight paketiyle cihazlara aktarılacak; build 4 bunları içermez.
