# SchoolAsist referans uyarlaması — 1 Ekim 2026

18 onaylanan tasarım; ana sayfa, platform, deneyim, altı rol, uygulamalar,
destek, iletişim, kurum kaydı, doğrulama, giriş ve üç yasal belgeyle karşılaştırıldı.
Önceki CSS cihaz maketleri, genel rol şablonu ve farklı bölüm sıraları kaldırıldı.

## Uygulanan farklar

- Onaylanan sahnelerden 48 WebP varlık (toplam 1.39 MiB) çıkarıldı.
  Kaynak ve kırpma ölçüleri `public/images/showcase/sources.json` içinde.
  Tam sayfa görselleri web sayfasının yerine kullanılmıyor; cihaz ve tanıtım sahneleri varlık.
- Üç bağlantılı siyah başlık, merkezde gezinme, doğru marka, turuncu aktif çizgisi,
  büyük iki satırlı başlıklar, açık/koyu bölüm geçişleri ve kompakt footer eşlendi.
- Her rolün kendine özgü sahnesi, galeri oranları ve alt bölüm düzeni var.
  Öğrenci cihazının sol tabanı ve kurum kaydının alt yansıması da özgün kaynaktan alındı.
- Kurum kaydında 42/58 sütun, girişte 62/38 sütun; destek ve iletişimde sol açıklama,
  sağ gerçek form düzeni kullanıldı. İki isteğe bağlı kayıt bölümü ayrı açılır alanlar.
- Inter Variable yerel paket üzerinden sunulur; başlık ağırlıkları ve Türkçe karakterler
  üçüncü taraf font sunucusuna bağlı olmadan yüklenir.
- Galeri son karta ilerler, otomatik oynatma duraklatılabilir; rol sekmeleri,
  destek araması ve demo finans filtreleri çalışır. Hareket azaltma tercihi desteklenir.
- Gerçek SMTP, onay, geçici parola, CAPTCHA ve erişim denetimleri korunmuştur.
  Giriş için e-posta/kullanıcı adı desteklenmeye devam eder.

## Görsel kontrolün sınırları

Yasal sayfalarda çizimlerdeki sahte metin çizgileri yerine tam mevcut metin bulunur.
Kurum kaydı ve kullanım ücretsiz olduğu için eski ücretli paket/iade iddiaları güncellendi.
Doğrulama sayfası gerçek bağlantının durumunu gösterir; geçersiz bağlantı onaylanmış gibi
sunulmaz. Gerçek Turnstile bileşeni kullanılır; taslaktaki sahte CAPTCHA çizimi kopyalanmaz.
Mobil düzenler masaüstü kompozisyonunun 390 px uyarlamasıdır; mobil referans çizimi yoktur.
Bu çalışma piksel farkı ölçümü veya hukuki uygunluk/güvenlik sertifikası değildir.

## Kontroller

- 18 masaüstü ekranı kendi referans genişliğinde (972/1024/1536 px) incelendi.
- 18 mobil ekranı 390 × 844 px boyutunda kontrol edildi; yatay taşma ve eksik görsel yok.
- Galeri son kart/başa dönüş, rol sekmesi, mobil menü, destek araması/kategorisi,
  kayıt açılır bölümleri, giriş rolü/parola gösterimi ve demo finans filtreleri incelendi.
- TypeScript, değişen site alanları için ESLint ve üretim derlemesi başarılı;
  44 statik rota üretildi. Mevcut backend kodu bu tasarım uyarlamasında değiştirilmedi.

Yerel görsel kanıtlar `schoolasist-reference-audit` klasöründe; `index.html` karşılaştırma
ve mobil görünüm galerisi, `metrics.json`/`mobile-metrics.json` ölçüleri içerir.
Canlı sunucuya yayın yapılmadı; mevcut üretim CAPTCHA/SMTP ayarları hâlâ gereklidir.
