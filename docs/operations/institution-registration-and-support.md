# Kurum kaydı ve destek akışı

Giriş ekranındaki **İletişime geçin / Destek** bağlantısı `schoolasist.com/destek` sayfasını açar. Mobilde `COURSE_INTELLECT_MARKETING_URL`, desktop/web'de `REACT_APP_MARKETING_URL` ile adres değiştirilebilir.

- Destek sayfasındaki **Ücretsiz kurum kaydı oluştur** bağlantısı `/kurum-kaydi` formuna gider. Ücretsiz dönemde paket seçilmez; onaya kadar kurum ve yönetici hesabı oluşturulmaz.
- Platform yöneticisi, `/admin/kurumlar` veya desktop platform panelinde tüm başvuruları, adres doğrulama durumlarıyla birlikte görür. Başvurular onaylanabilir veya reddedilebilir.
- Onayda kuruma benzersiz ve kalıcı `SA-` müşteri numarası atanır. SMTP üzerinden onay, yönetici kullanıcı adı ve süreli geçici parola gönderilir. İlk girişte parola değiştirilir.
- SMTP teslimi başarısızsa kurum onayı korunur; panel **Gönderilmedi** gösterir. **Kurulum belgesi** işlemi yeni bir geçici parola üretir ve e-postayı yeniden gönderir; eski geçici parola geçersiz olur. Kullanıcı kendi parolasını belirlediyse bu işlem reddedilir.
- **Erişimi kapat**, kurumun durumunu `suspended` yapar ve tüm kullanıcılarının yenileme oturumlarını iptal eder. Giriş, token yenileme ve mevcut JWT ile API işlemleri reddedilir. Hub işlemleri de kontrol edilir; açık canlı bağlantılar en fazla yaklaşık beş saniyede kapatılır. **Erişimi aç** sonrası yeni oturum açılabilir; iptal edilen yenileme oturumları yeniden etkinleştirilmez.
- Müşteri numarası onay e-postasında, kurum destek ekranında ve platform kurum listesinde görünür. Giriş yapılamadığında da `/destek` üzerinden sorun veya şikayet gönderilebilir.
- `/admin/destek` ve desktop platform destek paneli, müşteri numarası/e-posta ile arama, yanıt gönderme ve sonuçlandırmayı destekler. Harici başvurular kimlik doğrulanmamış olarak işaretlenir. Müşteri numarası kurum bilgilerini veya destek kayıtlarını okuma yetkisi vermez.
- Kurum içi destek kayıtları kurum adına göre değil, sabit kurum kimliğine göre ayrılır. Aynı isimdeki iki kurum birbirinin kayıtlarını göremez.

## Çalıştırma ayarları

Ücretsiz dönemde `Billing:Enabled=false`, `Subscription:GateEnabled=false` ve web derlemesinde `NEXT_PUBLIC_BILLING_ENABLED=false` kullanılmalıdır. Bunlar mevcut varsayılanlardır.

Gerçek e-posta için `Email:Smtp:Host`, `Port`, `User`, `Password`, `UseSsl`, `Email:From` ve `Email:FromName` mevcut SMTP sağlayıcısına göre ayarlanır. `Registration:LoginUrl` kurum giriş sayfasını belirtir. Üretimde form koruması için backend `Captcha:Secret` ile web `NEXT_PUBLIC_TURNSTILE_SITE_KEY` eşleşmelidir. Parolalar kaynak koduna yazılmamalıdır.

`20260930121357_AddInstitutionCustomerSupport` migration'ı yeni alanları ekler, mevcut kurumlara da benzersiz numara verir. Tarihsel destek kayıtları yalnız kurum adı tek bir kurumu gösteriyorsa otomatik bağlanır; belirsiz kayıtlar platform panelinde kalır. API mevcut başlangıç akışında migration'ları uygular. Bu değişiklikler canlı ortama henüz yayımlanmadı; gerçek SMTP teslimi yapılmadı.

## Doğrulama

460 backend testi geçti. Bu testler ücretsiz kayıt, aynı adlı kurumların destek izolasyonu, SMTP başarısızlığı, platform dışı erişim reddi, kurumun tüm kullanıcılarında giriş/yenileme engeli, oturum iptali ve açık hub bağlantısının kapatılmasını kapsar. Desktop ve web TypeScript kontrolleri ile üretim derlemeleri başarılıdır; değişen Flutter dosyaları analizden geçti. Destek sayfası ve paketsiz kayıt bağlantısı masaüstü ve telefon genişliğinde tarayıcıda kontrol edildi. Fiziksel telefonda ve gerçek SMTP sağlayıcısında uçtan uca teslim testi yapılmadı.
