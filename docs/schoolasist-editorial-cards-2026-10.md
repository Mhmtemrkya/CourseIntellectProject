# SchoolAsist — ürün kartları, 1 Ekim 2026

Apple MacBook Pro sayfasının büyük görselli keşif galerisi, macOS içerik kartları ve küçük galeri kontrol alanları incelendi: https://www.apple.com/macbook-pro/

SchoolAsist için özgün SVG kompozisyonları ve mevcut resmi logo kullanıldı. Apple görselleri veya videoları projeye aktarılmadı.

## Uygulama

- Ana sayfa, platform ve mevcut rol galerileri büyük, yuvarlatılmış ürün sahnelerine dönüştürüldü. Eğitim, iletişim, finans, gelişim ve operasyon için farklı zeminler ve kompozisyonlar var.
- Kart üzerindeki `+` kontrolü Radix Dialog ile ayrıntılı inceleme açıyor. Pencere üç açıklama, ürün görseli ve mevcut rol özellik sayfasına bağlantı içeriyor. Escape kapanışı, odak döngüsü, açan karta odak dönüşü ve bağımsız pencere kaydırması destekleniyor.
- Galeri sınırları gerçek kaydırma genişliğine göre hesaplanıyor. Son karttan sonra sahte boşluk yok; önceki/sonraki kontroller sınırda devre dışı. Kullanıcının etkileşimi otomatik oynatmayı duraklatıyor.
- Görseller ilk görünümde kısa ve kademeli olarak yerleşiyor. Fareyle üzerine gelindiğinde küçük yakınlaşma, inceleme penceresinde giriş geçişi var. Mevcut kaydırmaya bağlı sahneler korundu. Hareket azaltma tercihinde yeni animasyonlar da devre dışı.
- 11 rolün dizin kartları yeniden düzenlendi: rol adı, açıklama, üç kısa özellik, şeffaf zeminde cihaz önizlemesi ve katalogdaki özellik başlıklarının sayısı. Bu sayılar tekil sistem işlem sayısı değildir.
- Mobilde açıklama ve ürün görseli normal belge akışında yerleşiyor; uzun metin ekran önizlemesiyle çakışmıyor. Mevcut tüm ayrıntılı rol katalogları ve arama işlevleri korundu.

## Doğrulama

- TypeScript kontrolü, değişen TS/TSX dosyalarının ESLint kontrolü ve üretim derlemesi başarılı; 49 statik sayfa üretildi.
- Gerçek tarayıcıda masaüstü, 390×844 mobil ve 320×740 dar ekran kontrol edildi. Yatay sayfa taşması bulunmadı.
- 11 rol kartının mobil metin/görsel aralığı 20 piksel ve tüm önizlemelerin CSS zemini şeffaf doğrulandı. Masaüstü dizin iki sütun, mobil tek sütun.
- Galeri son boşluğu masaüstünde yaklaşık 58, mobilde 20 piksel normal kenar boşluğu. Sonraki düğmesi son konumda kapalı.
- İnceleme penceresinde Tab odağı içeride kalıyor; Escape kapatıyor ve odak açan karta dönüyor. Mobil pencere yatay taşmıyor.
- Finans kartının ayrıntı bağlantısı `/deneyim/muhasebe/` sayfasına ulaştı; mevcut 20 özellik başlığı görünür.
- Kontrol edilen yerel sayfalarda tarayıcı hata/uyarı kaydı yok. Yeni hareket azaltma kuralları kodda doğrulandı; işletim sistemi tercihi değiştirilmedi.

Çalışma yerel önizleme ve kaynak dosyalarındadır; bu turda canlı sunucuya dağıtım veya Git push yapılmadı.

Ekran görüntüleri: `schoolasist-editorial-card-audit` dizini, mevcut Codex görselleştirme çalışma alanında.
