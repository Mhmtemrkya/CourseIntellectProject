# SchoolAsist — görüntü netliği ve geçiş düzenlemesi

1 Ekim 2026

## Sorun ve çözüm

Önceki ürün sahneleri, 972–1024 piksel genişliğindeki sayfa tasarımlarından kesilmiş WebP görselleriydi. Bazı kart kesitleri yalnızca 209–349 piksel genişliğindeydi; masaüstünde ve yüksek piksel yoğunluğunda büyütülünce yazılar ve cihaz kenarları bulanıklaşıyordu. Sıkıştırma kalitesini yükseltmek kayıp ayrıntıyı geri getirmeyeceği için bu kesitlerin kullanımı kaldırıldı.

Ürün sahneleri artık `components/site/product-scene.tsx` içinde SVG olarak çiziliyor. Cihaz çerçeveleri, demo ekran metinleri, grafikler ve arayüz simgeleri çözünürlükten bağımsızdır. Kart başlıkları ve açıklamaları normal HTML metnidir. Yeni sahneler, önceki siyah/turuncu cihaz kompozisyonunu izleyen vektör yorumlardır; eski fotoğraf benzeri cihaz renderlerinin piksel eşleşmesi değildir. Asıl SchoolAsist logosu değiştirilmeden `/images/logo.png` üzerinden kullanılır. Demo verileri gerçek kurum verisi olarak sunulmaz.

Eski tasarım kesitleri kaynak olarak korunuyor; uygulama bileşenleri ve CSS bu WebP dosyalarını artık yüklemiyor.

## Düzen ve hareket

- Tek bölüm boşluğu ve kenar boşluğu sistemi; eşit genişlikte keşif kartları, tutarlı tipografi ve ayrı galeri kontrol satırı.
- İlk açılışta kademeli başlık/ürün sahnesi girişi ve sayfa değişiminde kısa geçiş. İçerik, bağlantılar ve formlar animasyon tamamlanana kadar bekletilmez.
- Kaydırmada küçük ürün sahnesi hareketi; bölüm ve kartların sırayla belirmesi; grafik çizgilerinin çizilmesi.
- Rol seçimi sırasında aynı zemin ve sahne yüksekliğinde geçiş, hareketli sekme göstergesi. Rol ekranı menüleri ve metinleri seçilen role göre değişir.
- Galeri yalnızca görünürken ilerler, üzerine gelindiğinde ve kullanıcı etkileşiminde durur; oynatma/duraklatma kontrolü vardır.
- Menü, buton ve kart hover geçişleri; mobil menü için Escape desteği; tablet menüsü için 900 piksel kırılımı.
- `prefers-reduced-motion` durumunda CSS hareketleri ve Lenis kapalıdır; galeri otomatik ilerlemez. Gözlemci animasyonları temizlenir. Bu tercih kaynak kodu üzerinden kontrol edildi; işletim sisteminin hareket tercihi değiştirilmedi.
- SSR sırasında React'in sahip olduğu DOM sınıfları değiştirilmez. Bölüm animasyonları Web Animations API ile uygulanır; bu, akış halinde yüklenen sayfalarda hydration çakışmasını önler.
- Kayıt ve giriş sayfaları da ortak site kabuğunu kullanır. Eski ürün yerleşimi kuralları `reference.css` içinden kaldırıldı; ürün sunumu `presentation.css`, işlevsel form/yasal stiller `reference.css` içinde toplandı.

## Doğrulama

- 18 sayfa 1280 piksel masaüstünde ve 390 × 844 telefonda açıldı: yatay taşma ve yüklenmeyen HTML görseli yok. Temiz tarayıcı oturumunda yeni konsol hatası yok.
- Mobil menü/Escape, rol seçimi/ok tuşları ve finans tablosu ödeme durumu filtresi kontrol edildi.
- TypeScript, değişen bileşenlerin ESLint kontrolü, `git diff --check` ve `npm run build` geçti; 44 statik rota üretildi.
- Üretim çıktısı ayrıca yerel statik sunucuda açıldı.
- Görsel kayıtlar: `.codex/visualizations/2026/09/29/01a0ed54-d984-7560-b5ec-0dafde399263/schoolasist-polish-audit`.

Bu çalışma sunucuya dağıtılmadı. Kayıt, onay ve e-posta hizmetlerinin davranışı değiştirilmedi; üretimdeki Turnstile ve kayıt açma kontrolleri korunuyor.
