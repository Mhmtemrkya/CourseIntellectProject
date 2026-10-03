# Destek sayfası ve ortak footer

Onaylanan turuncu/lacivert/krem tasarım, gerçek HTML alanları ve ayrı üretilen şeffaf görsellerle uygulandı. Referans sayfa görselleri kesilerek kullanılmadı.

## Yapı

- `SupportExperience`: destek üst sahnesi, kategori bağlantıları, Türkçe arama ve beş soruluk animasyonlu açılır yanıtlar.
- `SupportPage`: mevcut müşteri numarası formu ve iletişim formu. Kategoriler ve seçici aynı React durumunu kullanır.
- `SiteFooter`: ortak lacivert footer. Ana sayfa, platform, destek ve iletişimde kayıt çağrısı ve logo sahnesi de gösterilir; diğer sayfalarda mevcut sayfa çağrıları korunur.
- `PublicLayout` üzerindeki `site-top` hedefi, yapışkan başlık yerine sayfanın gerçek başlangıcını işaret eder.

## Görseller ve hareket

`public/images/support-footer-art/` içinde iki bağımsız alfa kanallı WebP sahne bulunur. Mobil kaynaklar 900px genişliğinde; destek yaklaşık 151KB, footer yaklaşık 97KB. Masaüstünde 1536×1024 kaynaklar kullanılır. Footer görseli geç yüklenir. Üretim istemleri, referans ve kaynak yolları `docs/support-footer-art-prompts.json` içindedir.

Bölümler bir kez görünürken giriş yapar; sahneler kaydırmaya bağlı sınırlı yükselme hareketi kullanır. SVG ışık çizgileri kaydırmayla tamamlanır. Soru açılışı ve bağlantı vurguları kısa geçişlerdir. Sürekli çalışan parçacık döngüsü veya yeni WebGL sahnesi eklenmedi. `prefers-reduced-motion` desteklenir.

## Form ve güvenlik

Destek POST `/api/public-support`, iletişim POST `/api/contactmessages` sözleşmeleri korunur. Genel formlar açıkça `token: null` kullanır. Mevcut alan sınırları, e-posta doğrulaması, bekleme kilidi, sunucu hatası ve başarı durumu korunur. Gerçek Turnstile tokenı gereken ortamda gönderim token alınana kadar kapalıdır; temsili doğrulama kutusu kullanılmaz.

Bu formlarda Turnstile `compact` boyutu kullanılır; 320px ekranlarda normal widget'ın 300px genişliği form içinden taşar. Boyut kaynağı: [Cloudflare widget configurations](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/). Diğer widget kullanımlarının varsayılan boyutu değişmez.

## Kontrol

- Odaklı ESLint ve üretim `next build --webpack` başarılı.
- Yerel, ayrı test derlemesi ve loopback API ile bekleme, 429 hata mesajı, tekrar gönderim, başarı ve boş yeni form doğrulandı. Gerçek destek sistemine test kaydı gönderilmedi. Test istekleri Authorization başlığı taşımadı.
- Gerçek sayfada kategori/seçici eşleşmesi, yerleşik alan doğrulaması, soru açma/kapama, arama ve boş sonuç sıfırlama kontrol edildi.
- 320, 390, 768 ve 1440px yerleşimleri tarayıcıda incelendi; yatay taşma görülmedi. Mobil menü ve yukarı dönüş çalışıyor. Ana sayfa ve platformda tek footer/kapanış bölümü var; iletişim alanları korundu. Destek sayfası konsolunda hata görülmedi. Gerçek ekranlar ve `verification.json`, `schoolasist-support-footer-implementation` önizleme klasörüne kaydedildi. Mevcut 7 sahne/rol/varlık testi de geçti.

Bu çalışma yerel uygulamadır; commit, push veya canlı dağıtım içermez.
