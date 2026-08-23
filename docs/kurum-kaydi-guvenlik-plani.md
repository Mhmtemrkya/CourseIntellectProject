# Kurum Kaydı (Self-Signup) Güvenlik Planı

Kapsam: `POST /api/platformops/tenants/register` (`PlatformOperationsController.cs:64`) ve
pazarlama sitesindeki `kurum-kaydi` formu.

## 1. Bugünkü durum — tespit edilen açıklar

| # | Bulgu | Yer | Etki | Durum |
|---|-------|-----|------|-------|
| 1 | Uç `[AllowAnonymous]` ve **hiçbir rate limit yok** (`EnableRateLimiting` yalnız auth/assistant/certificate uçlarında) | `PlatformOperationsController.cs:64` | Sınırsız anonim yazma; DB şişirme | ✅ kapalı (P0) |
| 2 | Bot koruması yalnız istemci tarafı honeypot | `kurum-kaydi/page.tsx:88` | API'ye doğrudan POST atan bot için sıfır koruma | ✅ kapalı (P0) |
| 3 | **Hiç sunucu tarafı doğrulama yok**: `Plan` serbest string, `EstimatedStudents` sınırsız int, ad/e-posta/telefon format kontrolsüz | `RegisterTenantAsync` (`PlatformOperationsService.cs:263`) | Çöp veri, KPI zehirlenmesi | ✅ kapalı (P0) |
| 4 | Başvuru **gerçek tenant satırı** olarak yazılıyor (`TenantWorkspace`, `status=pending`) | aynı yer | Aşağıdaki 5-6-7'nin kaynağı | ✅ kapalı (P1 — ayrı tablo) |
| 5 | `Slug` DB'de unique (`CourseIntellectDbContext.cs:968`) → pending başvuru slug'ı işgal ediyor | | **Slug squatting**: rakip "ataturk-koleji" slug'ını kapatabilir; ayrıca `GenerateUniqueSlugAsync` uygulama içi ⇒ yarış durumunda 500 | ✅ kapalı (P0) |
| 6 | `GetTenantsAsync` ve overview KPI'ları status filtresiz topluyor | `PlatformOperationsService.cs:61` ve `:40` | Saldırganın gönderdiği `StudentCount`/`UserCount` platform panosundaki toplamlara giriyor | ✅ kapalı (P0) |
| 7 | Tekilleştirme yok (aynı e-posta 10.000 kez) | | Onay kuyruğu kullanılamaz hâle gelir | ✅ kapalı (P0) |
| 8 | `Password` alanı DTO'da var, `passwordHasher.Hash()` çağrılıyor **ama hiç kullanılmıyor** — `ApproveTenantAsync` her hâlükârda geçici parola üretip `PendingAdminPasswordHash`'i siliyor (`:311-319`) | `RegisterTenantRequest.cs` | **CPU amplifikasyon DoS**: kimliksiz istekle sınırsız KDF çalıştırma | ✅ kapalı (P0) |
| 9 | Yanıtta anonim çağırana tam `TenantWorkspaceDto` (id, slug, plan) dönüyor | `:69` | Bilgi sızıntısı + kayıt var/yok ayrımı | ✅ kapalı (P0) |
| 10 | Başvuruda IP/UA/referer/zaman damgası saklanmıyor, audit kaydı yok | | Kötüye kullanım triyajı imkânsız | ✅ kapalı (P0) |
| 11 | KVKK açık rıza/aydınlatma onayı kayıt altına alınmıyor | | Hukuki risk | ✅ kapalı (P0) |
| 12 | `ForwardedHeaders`'ta `KnownNetworks/KnownProxies` temizlenmiş (`Program.cs:201`) | | API origin'ine **doğrudan** erişilebiliyorsa `X-Forwarded-For` sahteciliği tüm IP bazlı limitleri (mevcut `auth` dâhil) delip geçer | ⚠️ **açık — ops işi** |

Not: CORS burada bir kontrol **değil** — tarayıcı dışı istemci umursamaz. Honeypot da istemci tarafı.
İkisi de hâlihazırda bypass edilmiş sayılmalı.

## 1.5. P0 uygulandı (2026-08-23)

Aşağıdaki maddeler koda girdi. Değişen dosyalar:

- `RegisterTenantRequest.cs` — `Password` alanı kaldırıldı (#8), `CaptchaToken` + `KvkkAccepted` eklendi.
- `CaptchaVerificationService.cs` (yeni) — Turnstile/hCaptcha doğrulaması, **üretimde fail-closed**.
- `PlatformOperationsService.RegisterTenantAsync` — biçim doğrulama → e-posta cooldown →
  günlük tavan → captcha → yazma sırası; slug artık `pending-<rastgele>`, gerçek slug
  `ApproveTenantAsync`'te üretiliyor (#5); `EstimatedStudents` artık `UserCount`/`StudentCount`'a
  yazılmıyor, ayrı `RegistrationEstimatedStudents` alanında duruyor (#6).
- `PlatformOperationsController` — `[EnableRateLimiting("public-form")]`, her durumda `202 { ok: true }` (#9).
- `Program.cs` — `public-form` politikası (IP başına saatte 5, yapılandırılabilir).
- `TenantWorkspace` + migration `AddTenantRegistrationMetadata` — IP/UA/referer, KVKK sürüm+zaman (#10, #11).
- Pazarlama sitesi — zorunlu KVKK onay kutusu, Turnstile widget'ı, güncellenmiş CSP.

**Kapanmayan tek P0 maddesi ops tarafında:** madde 9 (nginx'in `X-Forwarded-For`'u
üzerine yazması + origin'in yalnız proxy'den erişilebilir olması). Bu yapılmadan IP
bazlı limit en iyi çaba düzeyindedir; kodda da bu varsayımla yazıldı — asıl kapı
captcha ve e-posta cooldown'ı.

### Devreye alırken zorunlu iki ayar

| Taraf | Anahtar | Olmazsa |
|-------|---------|---------|
| API | `Captcha:Secret` (veya `COURSE_INTELLECT_CAPTCHA_SECRET`) | Üretimde **tüm kayıtlar reddedilir** (bilinçli fail-closed) |
| Web | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Widget çizilmez, kullanıcı token üretemez → API reddeder |
| API | `Email:Smtp:Host` + `Email:From` (+ `COURSE_INTELLECT_SMTP_PASSWORD`) | Kayıt çalışır ama adres doğrulanmaz: başvurular kuyruğa "kanıtlanmamış" olarak düşer |

Ayrıca migration DB'ye uygulanmalı (`AddTenantRegistrationMetadata`). Otomatik migration
açıksa bir sonraki backend deploy'unda uygulanır; bekleyen `AddDrivingExpenses` de aynı
anda uygulanacaktır.

### Bilinçli kabul edilen yan etki

E-postası **zaten etkin bir kurumda kayıtlı** olan gerçek bir okul da yinelenen sayılır:
başarı ekranını görür ama kuyruğa düşmez ve kimse dönüş yapmaz. Bu, kayıt varlığını
sızdırmama kararının bedeli — destek tarafında "başvurdum, dönüş olmadı" vakası
üretebilir. Katlanılmazsa çözüm yanıtı ayrıştırmak DEĞİL, P2'deki e-posta doğrulaması
(adres sahibine "zaten kayıtlısınız" bilgisini formda değil e-postayla vermek).

## 1.6. P1 uygulandı (2026-08-23)

Başvurular artık `tenant_registration_applications` tablosunda; `tenant_workspaces`
yalnız gerçek kurumların tablosu. Anonim yazma oraya hiç dokunmuyor.

- `TenantRegistrationApplication` (yeni entity) — başvuru alanları + IP/UA/referer,
  KVKK sürüm/zaman, red gerekçesi, `CreatedTenantId` izi.
- **Filtreli benzersiz indeks**: `contact_email_normalized` üzerinde `status='pending'`
  koşuluyla. Servisteki cooldown yarışta atlanabilir; asıl kısıt burada, `DbUpdateException`
  yakalanıp yinelenen olarak dönülüyor.
- Kurum satırı ve slug **yalnız onayda** üretiliyor (`ApproveApplicationAsync`).
  Kurum ile yönetici birbirini işaret ettiği için kayıt iki aşamalı ve transaction içinde —
  tek `SaveChanges` EF'te dairesel bağımlılık hatası veriyor (test bunu yakaladı).
- **Yönlendirme kuralı**: `Approve` / `Reject` / `Delete` uçları id'yi ÖNCE başvurularda,
  sonra kurumlarda arar. Her metotta aynı sıra.
- `GET /api/platformops/tenants` tek liste döndürmeye devam ediyor (başvurular + kurumlar).
  Böylece masaüstü `superadmin/Tenants.jsx` ve pazarlama panelindeki `kurumlar` ekranı
  değişmeden çalışıyor. İzolasyon depolama katmanında; API biçimini bozmanın güvenlik
  getirisi yok. Onaylanan başvuru listede kalmaz — karşılığı artık kurum satırı.
- Red gerekçesi eklendi (`?reason=`, isteğe bağlı; paneller gövdesiz PUT atmaya devam ediyor).
- `RejectedTenantCleanupService` hem başvuruları hem eski kurum satırlarını temizliyor.
- Migration `AddTenantRegistrationApplications` mevcut bekleyen/reddedilmiş satırları taşıyor.
  Yalnız gerçekten başvuru olanlar (yönetici hesabı yok, altında kullanıcı/fatura yok);
  yarı hazırlanmış kurum satırlarına dokunulmuyor. Aynı e-postalı eski bekleyen
  satırlarda en yenisi `pending` kalıyor, eskiler `rejected` oluyor — yoksa benzersiz
  indeks deploy sırasında migration'ı patlatırdı.

**Çift kayıt değil, künye:** `TenantWorkspace` üzerindeki `Registration*` / `Kvkk*`
kolonları onayda başvurudan KOPYALANIR (kurumun nereden geldiği kurum satırından da
okunabilsin diye). Doğruluk kaynağı başvuru satırıdır; kayıt anında kurum tablosuna
hiçbir şey yazılmaz. İkisine birden yazarak "düzeltmeye" kalkma.

`PendingAdminPasswordHash` kolonu artık tamamen ölü (P0'da yazımı kaldırıldı); geriye
dönük uyum için duruyor, ileride ayrı bir migration'la düşürülebilir.

### P1-11 ve P1-12 de tamamlandı

- **Kara liste** (`registration_blocklist_entries`): alan adı ya da IP. Eşleşen başvuru
  **sessizce yutulur** — çağırana kabul edilmiş gibi aynı 202 döner. Engellendiğini
  söylemek, saldırgana kara listeyi deneyerek okuturdu; bu bir controller testiyle kilitli.
  Uçlar: `GET/POST/DELETE /api/platformops/registration-blocklist`. Girdi normalize edilir
  ("info@ornek.com" → "ornek.com"), tekrar eklemede yeni satır açılmaz.
- **Şüpheli işareti**: `is_suspicious` + gerekçe. Kayıt anında sezgisel kurar (aynı IP'den
  24 saatte eşik üstü başvuru; eşik `Registration:SuspiciousIpThreshold`, varsayılan 3).
  **Hiçbir zaman engellemez** — yanlış pozitif gerçek kurumu kapıda bırakmasın diye yalnız
  kuyrukta işaret koyar. Platform yöneticisi elle açıp kapatabilir
  (`PUT /api/platformops/tenants/{id}/suspicious?value=`).
- **Burst alarmı**: günlük eşik aşılınca platform yöneticilerine (kurumu olmayan Developer)
  bildirim. Günde bir kez (`registration-burst:{tarih}` dedupe anahtarı) ve try/catch içinde —
  bildirim yazılamazsa kayıt yine de tamamlanır.
- **Arayüz**: her iki platform yöneticisi ekranında da (masaüstü `superadmin/Tenants.jsx` ve
  pazarlama paneli `admin/kurumlar`) şüpheli rozeti, işareti aç/kapat eylemi ve kara liste
  kartı (ekle/kaldır) var.

## 1.7. P2-13 uygulandı (2026-08-23) — iletişim adresi doğrulaması

**Sağlayıcı seçilmedi, seçime gerek de kalmadı.** `SmtpEmailSender` düz SMTP kullanır
(host/port/kullanıcı/parola/gönderen); SES, Postmark, Brevo ya da kurum sunucusu aynı
ayarlarla çalışır. `Nvi:Endpoint` ve `Captcha:Secret` ile aynı desen — kimse adına
sağlayıcı kararı verilmedi.

Akış: başvuru alınır → iletişim adresine tek kullanımlık bağlantı gider (jetonun yalnız
SHA-256 özeti saklanır, 48 saat geçerli) → tıklanınca başvuru kuyruğa düşer.

| SMTP durumu | Ortam | Sonuç |
|---|---|---|
| Yapılandırılmış | hepsi | `awaiting` — **kuyrukta görünmez**, doğrulanınca girer |
| Yok | Production | `unproven` — kuyrukta **görünür**, "adres doğrulanmadı" rozetiyle |
| Yok | Development | otomatik doğrulanmış (lokal akış bozulmasın) |

Neden bu üçlü: eksik yapılandırma bir kapıyı sessizce KALDIRMAMALI (captcha'daki karar),
ama e-posta doğrulaması bir bot kapısı değil "bu adres gerçek mi" kapısıdır — gönderilemeyen
bir doğrulama yüzünden gerçek bir okulu görünmez yapmak da yanlış olurdu. Gönderim
başarısız olursa kayıt `unproven`'a geri döner, `awaiting`de takılı kalmaz.

Diğer kararlar:
- Geçersiz, süresi dolmuş ve bilinmeyen kod **aynı** yanıtı alır — aksi hâlde uç bir
  jeton kâhinine dönüşürdü. Bağlantıya ikinci tıklama hata göstermez.
- Doğrulama ucu anonim ve `public-form` rate limit politikasında.
- 202 gövdesindeki `verificationRequired` yalnız YAPILANDIRMAYA bakar, sonuca değil:
  kabul/yinelenen/engellenen üçünde de aynı değeri taşır, gövde birebir aynı kalır (test).
- Doğrulanmayan başvurular 7 gün sonra temizlik görevince silinir.
- Sentetik "kampüs" satırları artık VAR OLAN başvuruya bakar: hepsi doğrulama beklerken
  boş kuyruğu uydurma veriyle doldurmaz (bunu test yakaladı).

**Kalan P2:** 14 (geçici parola yerine tek kullanımlık kurulum bağlantısı) ve 15
(MEB kurum kodu / vergi no ile kurum doğrulama, opsiyonel). 14 auth yüzeyine ve iki
panelin kimlik bilgisi gösterimine dokunuyor; ayrı bir turda yapılmalı.

## 1.8. Kurulum belgesi hazırlığı — adım 1 ve 2 (2026-08-23)

Kurulum belgesi (PDF) kararı öncesi iki temel düzeltme. PDF parolayı **kalıcı bir
dosyaya** yazacağı için bunlar olmadan bugünkünden daha riskli olurdu.

**1. Kriptografik parola üretimi.** `PlatformOperationsService` içindeki yerel
`GenerateTemporaryPassword` `new Random()` kullanıyordu — kimlik bilgisi üretimi için
yanlış. Silindi; projede zaten `RandomNumberGenerator` kullanan `PasswordGenerator`
(parola sıfırlamanın kullandığı) devreye alındı. Aynı alfabe, tek kaynak.

**2. Geçici parolanın ömrü.** Yeni alan `AppUser.TemporaryPasswordExpiresAtUtc`;
kurum onayında `Registration:TemporaryPasswordValidDays` (varsayılan 7) kadar sonrası
yazılır, kullanıcı kendi parolasını belirleyince temizlenir. Süre dolduysa **doğru
parola bile** girişi geçmez.

Kararlar:
- Süresi dolmuş deneme **başarısız giriş olarak kaydedilmez**: parola doğruydu,
  kilitleme bütçesini yemesi gerçek bir kurumu hesabından büsbütün kilitlerdi.
- `TemporaryPasswordExpiredException` → 401 + `TEMPORARY_PASSWORD_EXPIRED` ve net mesaj.
  Bilgi sızdırmaz (çağıran parolayı bildiğini zaten kanıtladı) ve kurumu bulunmayan bir
  sorunun peşine düşürmez. Masaüstü ve mobil bu kodu ayrıca ele alıyor; eskiden ikisi de
  401 gövdesini yutup "şifre yanlış" diyordu.
- `null` süre = süresiz: mevcut kayıtlar etkilenmez.
- Parola sıfırlama onayı da artık bu alanı yazıyor (24 saat). Yazmasaydı kurum onayından
  kalan ESKİ tarih yürürlükte kalır, taze parola ilk girişte "süresi doldu" derdi.
- Sıfırlamanın kendi `PasswordResetRequests.ExpiresAtUtc` kontrolü olduğu gibi duruyor;
  o yol satır durumunu da "expired" yaptığı için değiştirilmedi.

**Sırada:** kurulum belgesi PDF'i (QuestPDF; projede zaten dört PDF servisi var),
"yeni belge üret" düğmesi ve indirme audit kaydı.

## 1.9. Kurulum belgesi (PDF) — adım 3 ve 4 (2026-08-23)

Geçici parola artık toast'ta kaybolmuyor: onayda **Kurum Kurulum Belgesi** (PDF)
üretilip iniyor. `TenantSetupDocumentPdfService` (QuestPDF, projedeki diğer dört PDF
servisiyle aynı kalıp) kurum adı, paket, giriş adresi, kullanıcı adı, geçici parola,
parolanın son kullanma tarihi, ilk giriş akışı ve **imha uyarısı** basıyor.

- Belge onay yanıtında **base64** olarak dönüyor; ayrı uç, jeton ya da sunucuda saklama
  yok. Alanlar DTO'ya isteğe bağlı eklendi (`SetupDocumentBase64`, `SetupDocumentFileName`),
  listeleme uçlarında hep null — mevcut panel sözleşmesi bozulmadı.
- `POST /api/platformops/tenants/{id}/setup-document` belgeyi **yeniden üretir**: yeni
  geçici parola verir, eskisini geçersiz kılar, o kullanıcının açık oturumlarını düşürür.
- **Koruma:** kurum yöneticisi kendi parolasını belirlemişse yenileme reddedilir
  (`ALREADY_ACTIVATED`). O noktadan sonra "belge yenilemek" kurumun parolasını habersiz
  sıfırlamak olurdu; doğru yol parola sıfırlama akışıdır. Testle kilitli.
- Hem onay hem yenileme **denetim kaydına** giriyor (kim, hangi kurum, ne zaman,
  "eski parola geçersiz kılındı").
- Arayüz iki panelde de var: onayda belge otomatik iniyor, aktif kurum satırında
  "Kurulum belgesi" eylemi yenileme yapıyor, `ALREADY_ACTIVATED` kullanıcıya doğru
  yolu söyleyen bir mesaja dönüşüyor. PDF istemcide üretilmiyor — şablon tek yerde,
  sunucuda; istemci yalnız base64'ü indiriyor (`downloadBase64File`).

Belge parola içerdiği için tek başına bir iyileştirme değildi; 1.8'deki iki adım
(kriptografik üretim + parolanın ömrü) bunun ön koşuluydu.

## 1.10. Deploy kontrol listesi

Sırayla:

**1. Anahtarları ayarla (deploy'dan ÖNCE).** Sunucuda `COURSE_INTELLECT_DB`'nin
tanımlandığı yere:

```
COURSE_INTELLECT_CAPTCHA_SECRET=<Cloudflare Turnstile secret key>
COURSE_INTELLECT_SMTP_PASSWORD=<SMTP parolası>          # e-posta doğrulaması isteniyorsa
```

`appsettings.Production.json` ya da ortam değişkeni ile: `Email:Smtp:Host`, `Email:From`
(SMTP kullanılacaksa). Web build'ine `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

**Captcha anahtarı yoksa üretimde TÜM kurum kayıtları reddedilir** — bilinçli fail-closed.
SMTP yoksa kayıt çalışır, adresler yalnız doğrulanmaz.

**2. Preflight çalıştır.** `scripts/production_preflight.sh` artık captcha anahtarını da
kontrol ediyor; anahtarsız deploy burada durur.

**3. Migration'lar.** Bu paket beş migration getiriyor:

| Sıra | Migration | Not |
|---|---|---|
| 1 | `AddTenantRegistrationMetadata` | eklemeli |
| 2 | `AddTenantRegistrationApplications` | **veri taşır ve siler** (aşağı bak) |
| 3 | `AddRegistrationBlocklistAndSuspicion` | eklemeli |
| 4 | `AddRegistrationContactVerification` | eklemeli |
| 5 | `AddTemporaryPasswordExpiry` | eklemeli |

Bekleyen `AddDrivingExpenses` de bunlardan önce uygulanacaktır.

⚠️ **2 numara tek riskli adım:** `tenant_workspaces` üzerindeki bekleyen/reddedilmiş
satırları yeni başvuru tablosuna kopyalar ve **siler**. Yalnız gerçekten başvuru olanlara
dokunur (yönetici hesabı yok, altında kullanıcı ve abonelik faturası yok); yarı
hazırlanmış kurum satırları olduğu gibi bırakılır. Aynı e-postalı eski bekleyenlerde en
yenisi `pending` kalır, eskiler `rejected` olur. **Deploy öncesi veritabanı yedeği alın**;
`Down()` bu satırları geri getirmez.

**4. Deploy sonrası duman testi.** Pazarlama sitesinden bir başvuru gönder → captcha
çalışıyor mu, 202 dönüyor mu; panelde kuyruğa düşüyor mu (SMTP açıksa önce doğrulama
e-postası gelmeli); onayla → kurulum belgesi (PDF) iniyor mu; belgedeki bilgilerle giriş
→ parola değiştirme ekranına düşüyor mu.

## 2. P0 — yeni altyapı gerektirmeyen, hemen yapılabilecekler

1. **Captcha (Cloudflare Turnstile veya hCaptcha)**
   - Formda widget, istekte `captchaToken`; sunucuda `siteverify` HTTP çağrısı ile doğrula.
   - Doğrulanmamış istek → 400, DB'ye hiç dokunma. E-posta/SMS altyapısı gerektirmez, bu yüzden ilk adım bu.
   - `Turnstile:Secret` config'ten; bayrak kapalıyken (lokal/dev) atlanabilir olsun.
2. **`public-form` rate limit politikası** (`Program.cs`'teki mevcut kalıbı kopyala)
   - IP başına 5/saat, ayrıca **normalize e-posta başına** 1/24 saat cooldown,
   - ve **global günlük tavan** (ör. 200 başvuru/gün) — tek IP'ye bağlı olmayan botnet için.
3. **`Password` alanını anonim DTO'dan tamamen kaldır** (bulgu #8). Zaten ölü kod; kaldırınca DoS vektörü de kapanıyor.
4. **Sunucu tarafı doğrulama** (FluentValidation ya da DataAnnotations):
   - `Plan` → beyaz liste (enum), `InstitutionType` → mevcut parse zaten var ama bilinmeyende reddet,
   - `EstimatedStudents` 1..100000, `InstitutionName` 3..150 + kontrol karakterlerini temizle,
   - e-posta RFC + normalize (küçült — **tr-TR küçültme tuzağına dikkat**, `ToLowerInvariant`),
   - telefon TR formatına normalize et.
5. **Tekilleştirme**: aynı e-posta ile bekleyen/etkin kurum varsa yeni satır yazma.
   *Uygulanan biçim:* unique index DEĞİL, kod içinde `lower(contact_email)` sorgusu + cooldown
   penceresi. Canlıda hâlihazırda yinelenen bekleyen satırlar olabileceği için unique index
   oluşturma migration'ı patlardı; kesin kısıt P1'deki temiz tabloyla gelir.
6. **Yanıt hijyeni**: her durumda `202 Accepted` + sabit gövde (`{ ok: true }`). Ne id, ne slug, ne "bu e-posta zaten başvurmuş" bilgisi.
7. **İstek metadatası sakla**: IP, User-Agent, Referer, `CreatedAtUtc`, captcha durumu.
   *Uygulanan biçim:* kolonlar + yapılandırılmış `ILogger` kaydı. `IAuditLogService`
   bilinçli olarak KULLANILMADI: anonim istekte tenant bağlamı yok, tenant'sız
   `AuditLogEntry` global sorgu filtreleri yüzünden panelde görünmez ve yazma
   try/catch içinde yutulduğu için sessizce kaybolurdu. Reddedilen/yutulan
   denemelerin tek izi log satırlarıdır.
8. **KVKK**: formda zorunlu onay kutusu; onaylanan metin sürümü + IP + zaman damgası kayıt altına alınsın.
9. **Nginx/altyapı** (bulgu #12): reverse proxy `X-Forwarded-For`'u **append değil overwrite** etsin ve API origin'i yalnız proxy'den erişilebilir olacak şekilde firewall'lansın. Aksi hâlde 2. maddedeki IP limiti kâğıt üstünde kalır.

## 3. P1 — yapısal (asıl doğru çözüm)

10. **Başvuruyu tenant'tan ayır**: yeni `TenantRegistrationApplication` tablosu.
    - Slug **onay anında** üretilsin ⇒ squatting ve slug yarışı biter (#5).
    - Pending satırlar `TenantWorkspace`'e hiç girmediği için KPI/liste zehirlenmesi biter (#6).
    - `ApproveTenantAsync` → application'dan tenant üretir. Red/eskime temizliği zaten var (`RejectedTenantCleanupService`), aynı mantık application'a taşınır.
11. **Platform admin kuyruğu**: onay ekranında red sebebi, domain/IP kara listesi, "şüpheli" işaretleme.
12. **Burst alarmı**: saatte N'i aşan başvuruda platform admin'e bildirim (mevcut `NotificationItem` altyapısı ile).

## 4. P2 — yeni altyapı kararı gerektirir (SMTP/SMS sağlayıcı yok!)

Kodda **hiçbir mail/SMS transportu yok** (yalnız `NviIdentityVerificationService`). Bu ikisi
önce sağlayıcı seçimi (SES/Postmark/SMTP + SMS için Netgsm/İletimerkezi vb.) ister:

13. **E-posta doğrulama**: başvuru → tek kullanımlık link/OTP → yalnız doğrulanmış başvurular onay kuyruğuna düşer. Bot ve "başkası adına kurum kaydı" sorununu asıl bu kapatır.
14. **Geçici parola yerine kurulum linki**: onayda parola üretip elden iletmek yerine tek kullanımlık, kısa ömürlü, DB'de hash'li setup token'ı; admin kendi parolasını belirler. `MustChangePassword` akışının yerine geçer.
15. (Opsiyonel) Kurum doğrulama: MEB kurum kodu / vergi no alanı + onay öncesi telefonla teyit adımı.

## 5. Önerilen sıra

`P0-3` (Password kaldır) → `P0-4` (validasyon) → `P0-1,2` (captcha + limit) → `P0-6,7,8` →
`P1-10` (ayrı tablo) → sağlayıcı kararı → `P2-13,14`.
