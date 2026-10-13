# Apple incelemesi için servis demo akışı

Uygulama: SchoolAsist, bundle `com.schoolasist.app`, Apple ID `6819080463`.
Demo kurum: SchoolAsist Demo Okulu. İnceleme parolası App Store Connect'te
inceleme hesabı alanına girilmelidir; bu dosya parola veya token içermez.

- Yönetici hesabı: `apple.admin`. Yönetici panelinde Servis Takip açılır.
  Test aracı, şoför profili, aktif sabah rotası ve Demo ÖĞRENCİ ataması vardır.
- Veli hesabı: `apple.veli`. Günlük okul hizmetlerinden Servis Takip açılır.
  Harita, araç/durak işaretleri, son konum, mesafe ve tahmini varış görülür.
- Öğrenci hesabı: `apple.ogrenci`. Aynı demo öğrencinin servis ataması vardır.
- Ayrı şoför hesabı yoktur; `apple.admin` için şoför profili hazırlanmıştır.
  Yönetici Servis Takip içindeki Şoför Ekranı, sefer/yoklama/GPS akışını açar.

Rota ve durak adlarındaki TEST/simülasyon etiketi inceleme verisini belirtir.
Demo haritasının son konumu sentetiktir; gerçek öğrencilerin konumu değildir.
Bugünün seferi tamamlanmadıkça aktif durum görülebilir. Başka gün inceleme
başlatılırsa yönetici Şoför Ekranı üzerinden yeni günün seferini başlatmalıdır.
Telefon GPS'i yalnız kullanıcının konum izni ve açık test onayıyla başlatılmalı,
test bitince GPS Durdur kullanılmalıdır. Son konum zamanı eskiyse canlı hareket
olduğu varsayılmamalıdır. Mesafe kuş uçuşu, ETA yaklaşık hesaplamadır.

5 Ekim 2026: iPhone 15 üzerinde harita, konum yenilemesi, biniş durumu ve gerçek
GPS gönderimi doğrulandı; GPS durduruldu. Kilitli cihazda sürekli hareket takibi
ve APNs/FCM bildirimin cihaza teslimi ayrıca doğrulanmalıdır.

Gönderim engeli: canlı hesap ve kurum silme uçları 404 döndürüyor. Güncel
backend ve migration dağıtılıp uçlar doğrulanmadan App Review gönderilmemelidir.
