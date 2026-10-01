# SchoolAsist — rol kataloğu ve kaydırma deneyimi

1 Ekim 2026

## Rol kapsamı

Tanıtımdaki altı kısa rol özeti genişletildi. Yönetici, öğretmen, veli, öğrenci, muhasebe, idari personel, rehberlik, şube müdürü, yemekhane, servis şoförü ve platform yöneticisi için ayrı statik deneyim sayfaları vardır. Ek/özel rollerin sabit bir özellik listesi olmadığı, kurumun tanımladığı modül ve işlem izinleriyle şekillendiği rol dizininde açıklanır.

Katalog kaynakları:

- `desktop/src/components/layout/ModernSidebar.tsx`: rol menüleri ve finans ekranlarının tam listesi.
- `desktop/src/App.tsx`: soru/içerik stüdyosu, teslim merkezi, pratik, favori, not ve rozet gibi menü dışı alt ekranlar.
- `desktop/src/lib/navigation/hubs.ts`: akademik, finans, kayıt, onay, İK, organizasyon ve arşiv grupları.
- `desktop/src/lib/permissions.ts`: yöneticiye özel işlemler ve rehberlik öğretmeninin ayrı menüsü.
- `backend/CourseIntellect.Domain/Enums/UserRole.cs`: şube müdürünün yönetici alanı ve şube kapsamı.
- `mobile/lib/services/role_router.dart`: rehberlik ve servis şoförünün özel yönlendirmesi.
- Rehberlik görüşme/randevu ekranları, yemekhane haftalık menüsü ve mobil şoför rota ekranı: profilin ayrıntılı işlemleri.

Özellikler `lib/role-capabilities.ts` içinde başlık/açıklama olarak tutulur. Tümü başlangıç HTML'sinde bulunur; arama Türkçe büyük/küçük harfleri gözetir. Grup bağlantıları doğru başlığa gider. Boş sonuçtan bütün listeye dönüş mümkündür. Rol sayfalarının başında tüm özelliklere doğrudan geçiş bağlantısı vardır.

Listeler erişim yetkisi vermez. Kurum modülü, izin ve veri kapsamı sınırlamaları sayfada açıklanır. Şube müdürü kataloğundan şube oluşturma, şube karşılaştırma ve kurum verisi indirme genel işlemleri çıkarılmıştır. Şoförün mobil profili ve platform yöneticisinin işletim rolü ayrı belirtilmiştir.

## Galeri ve hareket

Eski `%54` son boşluk kaldırıldı. Kaydırma konumları gerçek içerik genişliğine sınırlandırılır; aynı noktaya düşen konumlar birleştirilir. İlk/son konumda ilgili ok kapanır. ResizeObserver, ekran ve kart genişliği değişiminde konumları günceller. Oynatma görünürlük ve kullanıcı etkileşimine bağlı kalır.

Apple MacBook Pro referansının büyük ürün sahnesi ve sabit sahne yaklaşımı SchoolAsist'e uyarlanmıştır. Apple'a ait ürün görselleri, videoları veya kodu kullanılmaz; birebir MacBook video/3D render eşleşmesi iddia edilmez.

- Girişte ürün yakınlaşması ve başlığın kaydırmaya bağlı ayrılması.
- Ana sayfa, platform, rol dizini ve rol detaylarında üç aşamalı sabit ürün sahnesi.
- Kaydırma konumuna bağlı yakınlaşma, perspektif, dikey hareket ve çapraz sahne/metin geçişleri.
- Klavyeyle kullanılabilen bölüm göstergeleri; tıklanınca ilgili kaydırma konumuna geçiş.
- Mobilde küçük çoklu cihazlar yerine daha büyük telefon sahnesi.
- Özellik gruplarında bir defalık giriş animasyonu, rol seçiminde sahne ve sekme geçişi.
- Hareketi azalt düğmesiyle bütün sahnelerin normal belge akışında gösterilmesi.
- Sistem hareket tercihi için CSS ve Framer Motion desteği; bu tercih işletim sistemi değiştirilerek test edilmedi.

SVG ekranları temsili demo verisidir. Asıl SchoolAsist logo dosyası korunur.

## Doğrulama

- TypeScript ve değişen kaynak dosyalarının ilgili ESLint denetimi geçti.
- Üretim derlemesi 49 statik sayfayı üretti. Bir denemede derleme aracının yerel port kısıtı önbelleğe takıldı; geliştirme sunucusu durdurulup geçici önbellek ayrıldıktan sonra temiz üretim derlemesi geçti.
- 11 rol/profil sayfası masaüstünde ve 390 × 844 mobilde açıldı; yatay taşma görülmedi. Yönetici 65, öğretmen 27, veli 18, öğrenci 24, muhasebe 20, idari personel 20, rehberlik 12, şube müdürü 62, yemekhane 6, şoför 8 ve platform yöneticisi 12 özellik alanı gösterir. Sayılar bazı alt işlemleri tek alanda toplar; benzersiz sistem işlemi sayısı değildir.
- Galeri sonu masaüstünde sağ kenar boşluğuna, mobilde 20 piksel kenar boşluğuna dayanır; boş kart/sahte son alan yoktur.
- İkinci ve üçüncü sahneye geçişte sabit bölümün üstü masaüstünde 70, mobilde 62 pikseldir; ilgili sahne görünür, diğer sahneler saydamdır.
- Özellik arama, boş sonuç, listeye dönüş, mobil menü/Escape ve rol sekmesinde End tuşu kontrol edildi.
- Form gönderimi veya canlı kurum verisi kullanılmadı. Bu çalışma canlı sunucuya dağıtılmadı.

Görsel kanıtlar: `.codex/visualizations/2026/09/29/01a0ed54-d984-7560-b5ec-0dafde399263/schoolasist-motion-audit/`.
