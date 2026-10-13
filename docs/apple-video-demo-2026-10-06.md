# Apple fiziksel cihaz videosu için demo — 6 Ekim 2026

Kurum: SchoolAsist Demo Okulu (`a0000000-0000-4000-8000-000000000001`).
Ek yönetici hesabı: `apple.video`. Parola kullanıcıya sohbet içinde iletildi.
Mevcut `apple.admin` ve diğer inceleme hesapları korunmuştur.
Bu çalışma canlı uygulamanın API'siyle yalnız demo kurum verilerini ekledi;
kod deploy, migration veya backend restart yapılmadı.

Hazırlanan örnekler:
- 9-A sınıfı, Demo ÖĞRENCİ ve matematik branşına bağlanan Demo ÖĞRETMEN.
- Hafta içi 09:00 ve 10:00 olmak üzere 10 ders programı satırı.
- 5–6 Ekim matematik yoklaması (katıldı), 85 ve 92 puanlı iki demo sınavı.
- Ders programı ve veli bilgilendirmesi için iki DEMO duyurusu.
- Bu haftanın beş öğle yemeği menüsü (sentetik).
- 12.000 TRY tutarlı, altı taksitli sentetik finans kaydı; gerçek ödeme yapılmadı.
- 6 Ekim aktif TEST sabah servis seferi; sentetik araç konumu ve biniş kaydı.

## Kayıt sırası

1. Fiziksel iPhone'un güncel iOS sürümünü ve TestFlight build'ini doğrula.
2. Ana ekranda kaydı başlat, SchoolAsist'i aç ve `apple.video` ile giriş yap.
3. İlk girişte hukuk/onay ekranı açılırsa kullanıcı gerekli seçimleri kendisi yapar.
4. Yönetici panelinden Ders Programı'nı, Raporlar'daki demo öğrenci detayını
   (not/yoklama), Cari Hesaplar'daki örnek taksitleri ve Duyurular'ı aç.
5. Servis Takip'ten bugünkü aktif TEST seferini ve haritayı göster.
   Konum gerçek GPS takibi değil, açıkça etiketlenmiş simülasyondur.
6. Veli akışı için `apple.veli` ile giriş yap; servis haritasını ve çocuğun
   akademik bilgilerini göster. Mevcut inceleme hesabında silme talebi oluşturma.
7. Tekrar `apple.video` ile giriş yap. Profilim → Hesabımı Sil üzerinden
   kişisel silme talebini ve başarı/durum ekranını göster. Kurum Sil kullanılmaz.
   Kalıcı silme bekleme süresinin 30 gün olduğunu açıkla; istenirse talep
   uygulamanın normal iptal akışından geri alınabilir.
8. Videoyu orijinal çözünürlükte aktar; WhatsApp sıkıştırılmış kopyasını kullanma.

Servis seferi güne bağlıdır. Başka gün kayıt alınırsa mevcut `apple.admin`
şoför profiliyle o günün TEST seferi başlatılmalıdır. Gerçek cihaz GPS'i bu
hazırlıkta açılmadı. Video canlı hareket ispatı olarak sunulmamalıdır.

Bu seed, uygulamaya içerik bildirme/engelleme özelliği eklemez. Bu akışların
varlığı ayrıca doğrulanmalı; Apple'a bulunmayan özellik beyan edilmemelidir.
Hesap silme talebi bu hazırlıkta oluşturulmadı; video için kullanıcı yapacaktır.

API doğrulaması: `outputs/apple-video-demo-verification-2026-10-06.json`.
Seed sonucu: `outputs/apple-video-demo-2026-10-06.json`.
