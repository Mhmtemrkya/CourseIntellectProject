# Rol deneyimleri — günlük akış tasarımı

2026-10-03. Yerel geliştirme; bu çalışma için yayınlama yapılmadı.

## Kapsam

`/deneyim` ve on rol alt sayfası yeni tasarımı kullanır. Deneyim sayfalarındaki ana sayfa açılışı kaldırıldı; ana sayfanın mevcut SchoolBrainExperience sahnesi korunur. Resmi SchoolAsist logosu ortak navigasyon ve footer üzerinden kullanılır.

Her rol sayfası role özel bir görselle açılır, üç adımlı günlük akış sunar, mevcut RoleCapabilityList kataloğunun tamamını arama ve ayrıntı pencereleriyle gösterir. İki sonraki rol bağlantısı deneyimin devamını sağlar. Günlük akışlar temsili verilerdir; herhangi bir canlı kurum kaydını okumaz veya değiştirmez. Kimlik doğrulama, yetkilendirme ve başvuru akışları bu tasarım değişikliğinin kapsamı dışındadır.

## Kaynaklar ve görseller

- `components/site/role-experience.tsx`: rol navigasyonu, günlük akış, özellik bölümü, diğer rol bağlantıları, deneyim dizini.
- `components/site/role-experience.module.css`: yerel stil ve responsive kurallar.
- `lib/role-day-stories.ts`: on rolün ayrı günlük anlatımları.
- `components/site/product-story.tsx`: mevcut sayfa yönlendirmelerine entegrasyon.
- `public/images/role-day-art/`: on ayrı role ait şeffaf WebP görsel ve mobil sürümleri.
- `docs/role-day-art-prompts.json`: bütün üretim istemleri ve kaynak dosyaları. Üretim modu: **builtin-imagegen**.

Görseller tek tek üretildi; onaylanan tam sayfa tasarımından kesilmedi. Desktop sürümleri 1536 × 1024, mobil sürümleri 900 × 600 piksel. Yalnızca format dönüştürme ve yeniden boyutlandırma uygulandı. Desktop dosyaları 300 KB, mobil dosyaları 120 KB altında. Hero görseli öncelikli, takip eden görseller lazy yüklenir. Mobil dosyaları 600 piksel ve altında picture kaynağıyla seçilir.

## Hareket ve erişilebilirlik

Görünürlük animasyonları bir kere çalışır. Hero ve pano scroll hareketi sınırlıdır; içerik adımı değiştiğinde kısa opacity/transform geçişi kullanılır. Yeni WebGL sahnesi, sürekli parçacık döngüsü veya otomatik carousel eklenmez. Reduced motion tercihi hareketleri kaldırır. Gerçek cihazlarda FPS ölçümü yapılmadı.

Günlük akış klavyede sol/sağ ok, Home ve End ile çalışır; tablist/tabpanel bağlantıları ve roving tabindex kullanılır. Diğer roller disclosure menüsü Escape ile kapanır ve odağı başlığa döndürür. Mevcut özellik pencerelerinin Escape, odağı geri verme ve içerik kaydırma davranışı korunur. Görsel içindeki çizimler etkileşimli kontrol olarak gösterilmez; gerçek bağlantı ve kontroller HTML arayüzündedir.

## Doğrulama

- Son `next build --webpack`: başarılı, TypeScript kontrolü ve 48 sayfa üretimi tamamlandı.
- Değişen TS/TSX dosyalarının ESLint kontrolü: başarılı.
- `git diff --check`: başarılı.
- Mevcut brain-flow, brain-role-coverage, brain-assets, cinematic-assets ve role-illustration-assets testleri: 7 başarılı, 0 başarısız.
- On rolün tamamı 1440 ve 390 piksel genişlikte açıldı; yatay taşma görülmedi. Her rolde üç günlük adım, doğru özellik başlıkları ve sıfır canvas doğrulandı.
- 320 piksel rehberlik/servis şoförü, 768 piksel yönetici görünümü ayrıca kontrol edildi.
- Mobil Veli özellik penceresi açma, Escape ile kapatma ve odağı geri verme doğrulandı.
- Yönetici günlük akış adımlarını fare ve klavye ile değiştirme, özellik arama, boş arama sonucu ve ayrıntı penceresi doğrulandı.
- Diğer roller menüsünden servis şoförüne geçiş ve menünün kapanması doğrulandı.

Özellik başlığı sayıları: yönetici 9, öğretmen 4, veli 4, öğrenci 4, muhasebe 4, idari personel 3, rehberlik 2, şube müdürü 9, yemekhane 1, servis şoförü 1. Bunlar grup başlıklarıdır; her grubun bütün özellikleri mevcut katalogdan ayrıntı penceresinde gösterilir.

Gerçek tarayıcı ekran görüntüleri ve responsive kontrol kayıtları:

`/Users/oguzhanmindivanli/.codex/visualizations/2026/09/29/01a0ed54-d984-7560-b5ec-0dafde399263/schoolasist-role-experiences/`
