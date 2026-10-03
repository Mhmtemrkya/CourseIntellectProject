# Kurum başvurusu ve uygulamadan erişim

2026-10-03. Kullanıcının onayladığı kurum kayıt tasarımı uygulandı. Bu çalışma yereldir; canlı yayınlama yapılmadı.

## Tasarım

`app/kurum-kaydi/page.tsx` ve `registration.module.css`, özel başvuru dosyası görselini ve gerçek HTML formunu birlikte kullanır. Kurum bilgileri ile yetkili bilgileri ayrı gruplardır. Kurumsal bilgiler ve adres/iletişim, isteğe bağlı iki native disclosure bölümünde saklanır. Hata varsa ilgili bölüm açılır, hata alana bağlanır ve odak ilk hatalı alana gider. Mobil alanlar en az 16px metin kullanır. Tasarım kısa giriş animasyonu kullanır ve reduced motion tercihini izler; sürekli 3D render veya efekt döngüsü yoktur.

Kayıt sayfaları için minimal footer kullanılır. Resmi logo ortak navigasyon ve footer üzerinden korunur.

## Görsel

Başvuru dosyası, zarf, kâğıt şerit ve onay mührü ayrı bir görsel olarak **builtin-imagegen** ile yeniden üretildi; onaylanan sayfa görselinden kesilmedi. Gerçek metinler ve başvuru aşaması başlıkları HTML'dir.

- `public/images/registration-art/application.webp`: 1536 × 1024, 380232 bayt.
- `public/images/registration-art/application-mobile.webp`: 900 × 600, 92334 bayt.
- `docs/registration-art-prompts.json`: istem, kaynak ve çıktı dosyaları.

## Uygulamadan giriş

Genel web navigasyonundaki giriş bağlantısı Uygulamalar bağlantısıyla değiştirildi. Rol sayfaları ve ortak CTA aynı indirme sayfasına yönlenir. Uygulamalar sayfasındaki Web seçeneği ve indirmeden önce web giriş zorunluluğu kaldırıldı; yalnız yayınlanmış ve güvenli HTTPS veya `/downloads/` adresleri gösterilir. İndirme bağlantısı yoksa bunun yerine açık bir bilgi mesajı vardır. Masaüstü/mobil açıklamaları ve metadata güncellendi.

`/giris`, `/giris/parola` ve `/giris/sifremi-unuttum` statik export ile uyumlu bir istemci yönlendirmesiyle `/indir` sayfasını açar; bu adresler artık giriş/parola formu oluşturmaz. JavaScript yoksa da uygulama bağlantısı ve açıklama görünür. Platform yöneticisinin `/admin/login` ekranı ve uygulamaların başlattığı `/auth/pkce` akışı korunur.

Backend onay e-postası ve kurulum belgesi masaüstü/mobil uygulamalardan giriş yapılmasını söyler. İndirme hedefi `Registration:ApplicationDownloadUrl`, varsayılan `https://schoolasist.com/indir` olur. Eski `Registration:LoginUrl` bu iletişimlerde kullanılmaz. URL mevcut güvenli mutlak adres doğrulamasından geçer.

## Başvuru ve güvenlik

Mevcut anonim başvuru endpoint'i, honeypot, KVKK kontrolü, captcha token gönderimi/yenilemesi, alan maskeleri ve backend doğrulaması korunur. Ücretsiz dönemde plan veya şifre gönderilmez. Kayıt kapalıysa form devre dışıdır ve nedenini gösterir. Üretimde kayıt açık olduğunda site anahtarının zorunlu olması korunur; üretim güvenlik bayrakları veya site anahtarları değiştirilmedi.

Doğrulama gerekli yanıtı mevcut doğrulama ekranını gösterir. Doğrulama gerekmeyen yanıt için ayrı `received` durumu eklendi; bu durum e-posta adresinin doğrulandığını yanlış biçimde iddia etmez. Başvuru API'sinin başarılı yanıtı tek başına yönetici onayı sayılmaz.

## Kontroller

- Son Next.js üretim derlemesi ve TypeScript kontrolü: başarılı, 48 sayfa.
- Değişen TSX dosyalarının ESLint kontrolü ve `git diff --check`: başarılı.
- Backend TenantSelfRegistrationTests ve InstitutionFieldRulesTests: 85 başarılı, 0 başarısız. Onay e-postasında indirme adresi ve uygulamadan giriş metni kontrol edildi.
- Mevcut kurum yönetimi Node testleri: 5 başarılı, 0 başarısız.
- 1440, 768, 390 ve 320 piksel genişlikte form kontrol edildi. Dar ekranda açık isteğe bağlı bölümler ve alan odağı sonrası yatay taşma bulunmadı.
- Boş form, telefon normalizasyonu, KVKK eksikliği, kapalı bölümdeki MEB kodu hatası, sunucu hatası sonrası tekrar deneme ve iki başarılı yanıt çeşidi test edildi.
- Yerel test API'sine gönderilen örnek başvuruda plan ve şifre bulunmadığı, telefonun normalleştiği ve KVKK alanının gönderildiği doğrulandı. Gerçek kurum kaydı veya e-posta oluşturulmadı.
- Üç eski giriş adresinin `/indir` sayfasına yönlenmesi, şifre formu bulunmaması ve indirme sayfasında sadece Mobil/Masaüstü seçenekleri bulunması tarayıcıda doğrulandı.

Önizleme sırasında yalnızca geliştirme sürecinde kayıt bayrağı açık tutuldu ve API adresi yerel fixture sunucusuna yöneltildi. Bu fixture gerçek e-posta göndermez; kontrol bittikten sonra durdurulur. Canlı kayıt/e-posta işleyişi bu tasarım önizlemesinden ayrı olarak, dağıtım ortamının gerçek captcha ve API ayarlarıyla çalışır.

Gerçek tarayıcı görüntüleri:

`/Users/oguzhanmindivanli/.codex/visualizations/2026/09/29/01a0ed54-d984-7560-b5ec-0dafde399263/schoolasist-registration/`
