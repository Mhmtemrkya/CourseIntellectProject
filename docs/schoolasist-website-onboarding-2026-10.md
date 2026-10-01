# SchoolAsist site ve kurum başvurusu

Yeni site; ana sayfa, platform, deneyim, on bir rol sayfası, uygulamalar, destek,
iletişim, kurum kaydı, doğrulama, giriş, zorunlu parola değişimi, parola sıfırlama
talebi ve yasal bilgi sayfalarını içerir. Ürün sahneleri keskinliğini koruyan SVG
bileşenleridir; başlıklar, gezinme, galeriler ve gerçek formlar HTML bileşenleridir.
gerçek müşteri verisi, müşteri adı, fiyat, başarı iddiası veya AI vaadi göstermez.
Marka görseli mevcut `public/images/logo.png` dosyasıdır.

## Başvuru akışı

1. Ücretsiz başvuru, CAPTCHA ve sunucu doğrulamasından geçer. Gerçek kurum hesabı
   oluşturulmadan ayrı başvuru tablosuna kaydedilir.
2. SHA-256 özeti saklanan, 32 rastgele baytlık kod için doğrulama e-postası hazırlanır.
   Kod bağlantının fragment bölümündedir; sunucu URL günlüğüne veya Referer'e gitmez.
   Eski sorgu parametreli bağlantılar da desteklenir. Sayfa açılırken kod URL'den
   kaldırılır; kayıt/doğrulama/giriş/destek sayfalarında analitik bileşeni çalışmaz.
3. Doğrulama ve "Başvurunuz başarıyla alınmıştır" bildirimi aynı veritabanı
   işlemi içinde kaydedilir. Eşzamanlı doğrulama birden fazla bildirim üretmez.
4. Üretimde doğrulanmamış başvuru onaylanamaz. Platform yöneticisinin onayı;
   kurum, kurum yöneticisi, geçici parola özeti ve onay e-postası kuyruğunu aynı
   işlemde oluşturur. Müşteri numarası ve süreli geçici parola e-postada iletilir.
5. Web girişi bootstrap oturumunu yalnız sekme oturumunda tutar. Kullanıcı
   geçici parolasını kanıtlayıp yeni parolasını belirlemeden normal oturum açılmaz.
   Parola değişince eski oturumlar iptal olur; yeni parola ile yeniden giriş gerekir.
6. Kurum erişiminin kapatılması mevcut backend kurum erişim denetimini kullanır.
   Müşteri numarası destek yönlendirmesidir; kimlik doğrulaması veya veri erişim
   yetkisi sağlamaz. İletişim ve destek uçları CAPTCHA ve hız sınırı uygular.

## E-posta kuyruğu

`OnboardingEmail` tablosu; alıcı, HTML, doğrulama kodu ve geçici parola içeren
payload'u ASP.NET Core Data Protection ile korur. Payload loglara veya Hangfire
argümanlarına yazılmaz. Her olay benzersiz anahtarla kaydedilir. Arka plan servisi
30 saniyede bir çalışır; veritabanı lease'i aynı kaydın birden fazla worker tarafından
işlenmesini engeller. Hatalarda 2, 4, 8… en fazla 60 dakika aralıkla yeniden dener.
SMTP denemesi 90 saniyeyle sınırlıdır. Süresi dolmuş veya yenilenmiş kimlik bilgileri
gönderilmez. Tamamlanan gönderimlerin şifreli payload'u da silinir.

SMTP ile veritabanı tek transaction paylaşamaz. SMTP kabulünden hemen sonra süreç
kesilirse aynı bildirim tekrar ulaşabilir. Kuyruk "SMTP kabul etti" bilgisini tutar;
bu, alıcının gelen kutusuna teslim veya e-postayı okuma garantisi değildir.

## Üretim yapılandırması

- Migration: `20261001094712_AddOnboardingEmailOutbox`.
- API: `Registration:Enabled=true`, `Billing:Enabled=false`.
- Site: `NEXT_PUBLIC_REGISTRATION_ENABLED=true`,
  `NEXT_PUBLIC_BILLING_ENABLED=false`, gerçek `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  ve üretim API adresi. CAPTCHA secret yalnız API'de tutulur. Kayıt kapalıyken
  destek/iletişim CAPTCHA'sı site anahtarıyla çalışmaya devam eder.
- SMTP: `Email:Smtp:Host`, `Port` (STARTTLS için genellikle 587), `UseSsl=true`,
  `User`, secret store üzerinden `Password`, `Email:From`, `Email:FromName`.
  Üretimde TLS kapalı SMTP kabul edilmez. Alan adının SPF/DKIM/DMARC ayarları ve
  gerçek teslim testi SMTP sağlayıcısıyla ayrıca doğrulanmalıdır.
- `Email:Outbox:KeyDirectory` / `Email__Outbox__KeyDirectory`: sürüm klasörleri
  dışında, yalnız API servis kullanıcısının okuyabildiği kalıcı bir dizin kullanın
  (örnek `/var/lib/courseintellect/onboarding-keys`). Web kökü, uploads veya Git
  deposu içine koymayın. Unix dizin izinleri 0700 olarak ayarlanır. Anahtarları
  ayrı güvenli yedekleyin; silinmeleri bekleyen e-postaların çözülmesini engeller.
  Çok sunucuda aynı güvenli key ring ve application name gerekir. Dizin verilmezse
  servis kullanıcısının LocalApplicationData/SchoolAsist/DataProtectionKeys dizini
  kullanılır. Dosya izinleri, key ring'in disk şifrelemesi yerine geçmez.
- Doğrulama ve giriş URL'leri mutlak HTTPS olmalıdır. Yerel HTTP yalnız Development
  ve loopback adreslerinde kabul edilir.
- Canlıya geçmeden önce migration, kalıcı key ring ve SMTP yapılandırmasını birlikte
  uygulayın. Test alıcısı ile doğrulama → alındı → onay e-postalarını gözden geçirin.

İletişim bilgileri kullanıcı tarafından sağlandı: Maydanoz Yazılım,
info@schoolasist.com, 0850 242 84 25. Önceki örnek fiziksel adres kaldırıldı.
Mevcut genel yasal metinler yalnız görsel olarak düzenlenip bu bilgilerle güncellendi;
bu çalışma hukuki uygunluk denetimi veya güvenlik sertifikasyonu değildir.

## Doğrulama (1 Ekim 2026)

- Backend derlemesi: 0 hata, 0 uyarı. Tam test paketi: 569 başarılı, 0 başarısız.
  Gerçek PostgreSQL testleri ayrı test veritabanı gerektirir; yerel toplam bunların
  çalıştığını kanıtlamaz. Yeni kontroller e-posta kuyruğu, eski kodların gönderilmemesi, doğrulama sonrası
  tek bildirim, CAPTCHA, SMTP TLS ve MVC alan doğrulamasını kapsar.
- Site üretim derlemesi ve değişen sayfalarda ESLint başarılı. 44 statik rota
  üretildi (son tasarım sürümü 49 rota). Desktop TypeScript ve web üretim derlemesi başarılı.
- Yerel tarayıcıda desktop/mobil görünüm, mobil menü, rol sekmeleri, ürün galerisi,
  kurum türü seçimi, isteğe bağlı başvuru alanları, destek araması ve eksik kodun
  doğrulama hata ekranı incelendi. Mobilde yatay taşma görülmedi.
- Canlı veritabanına migration uygulanmadı ve site yayınlanmadı. Gerçek SMTP
  gelen kutusu teslimi henüz test edilmedi. Kayıt formunun yerel önizlemesi
  Development ayarları kullanır; üretimde gerçek CAPTCHA anahtarı gerekir.

Data Protection key persistence davranışı için:
[Microsoft dokümantasyonu](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-8.0).
Aydınlatma ve açık rıza ayrımı için:
[KVKK Kurulu açıklaması](https://www.kvkk.gov.tr/Icerik/5420/2018-90).
