# SchoolAsist kart sistemi

Desktop ve uygulama web arayüzü aynı React bileşenlerini kullanır. Mobil Flutter
karşılıkları `card_system.dart` ve `school_card.dart` içindedir.

- Özetler: `KpiCard` / `VividMetricCard`; doygun renk, büyük değer, başlıktaki
  ikonun dekoratif kabartma görünümü. Dekorlar ekran okuyucudan ve tıklamalardan
  çıkarılmıştır; gerçek veri veya grafik yerine geçmez.
- Liste, form ve detaylar: `Card`, `SchoolCard`, `AdminPanel`, `AccountingPanel`;
  tema zemini, renkli başlık/kenar ve hafif renk geçişi. İçeriğin ve kontrollerin
  kontrastı korunur.
- Ders kaynakları: mevcut ders paleti korunur; ortak yüzey dili uygulanır.
- Eski bağımsız özetler ve mobil içerik kartları ortak bileşen/yüzeylere taşındı.

Başlıklar rolün kendisine değil, kartın içeriğine göre eşlenir: tahsilat/başarı
yeşil; gecikme/risk mercan; ders/kayıt mavi; sınav/ödev/rehberlik mor;
yoklama/servis turkuaz; randevu/hedef/menü amber. Çağrının verdiği açık ton,
örneğin negatif nakit akışı, bu otomatik eşlemenin önüne geçer. React içerik
kartları başlık yoksa aktif modülün tonunu kullanır.

Izgaralar dar ekranda sadeleşir. Değer ve açıklama içerikleri sabit örnekler veya
üretilmiş grafiklerle değiştirilmez. Tıklama, izin ve API davranışları korunur.
Hareket azaltma tercihinde ortak React özetlerinin giriş ve sayma animasyonu
kapatılır.

Yerel React geliştirme sunucusunda `/__card-preview`, dokuz rolün ortak kartlarını
temsili verilerle gösterir. Bu giriş yalnız development ortamında açıktır;
üretim uygulamasında oturum/rol denetimlerini atlayan bir önizleme yolu yoktur.

Kontroller: desktop tip kontrolü ve üretim derlemesi; ortak palet testleri;
Flutter analizi; küçük ekran/büyütülmüş yazı, kart tıklaması, form düzenleme ve
metin kontrastı widget testleri. Görsel inceleme ortak bileşen örneklerini kapsar;
her yetkili sayfa ve fiziksel cihaz ayrı ayrı uçtan uca test edilmemiştir.
