# Güncel durum — 5 Ekim 2026

Aşağıdaki 4 Ekim incelemesinin bulguları çalışma alanında düzeltildi. Kalıcı dosya
kuyruğu, hata sonrası yeniden deneme, başarıdan sonra bildirim, kapsamlı kişisel
alan temizliği, ortak içerik koruması, isteğe bağlı yönetici devri, sürücü/yemekhane
erişimi, parola formu yenilemesi, talep öncesi kurum etki hesabı ve endpoint hız
sınırları eklendi. Belirsiz eski ad eşlemeleri tamamlandı gösterilmeden incelemeye
düşer. Üretim dağıtımı ve mağaza başvurusu henüz yapılmadı.

Yeni doğrulama ve kalan iş listesi: [güncel mağaza raporu](apple-store-preparation-2026-10-05.md).

---

## Önceki inceleme (düzeltme öncesi tarihsel kayıt)

# Hesap/kurum silme incelemesi — 4 Ekim 2026

İncelenen uygulama değişikliği: `212425f`.

Sonuç: Silme talebi, parola doğrulaması, platform kurum onayı ve oturum iptali için
temel akış var. Tam veri temizliği ve mağaza gönderimine hazırlık henüz tamamlanmadı.
Bu incelemede uygulama kodu düzeltilmedi, üretimde hesap/kurum silinmedi ve sunucuya
dağıtım yapılmadı. Üretim ortamının yapılandırması veya App Store Connect ekranları
bu incelemede doğrulanmadı.

## Doğrulama

- Mevcut silme/yetkilendirme testleri: **24 geçti, 2 PostgreSQL testi atlandı**.
  PostgreSQL test bağlantısı bu çalıştırmada tanımlı değildi. Önceki commit açıklamasındaki
  PostgreSQL testi beyanı bu incelemede yeniden doğrulanmış sayılmaz.
- Flutter `analyze --no-pub`: temiz.
- Masaüstü `npm run typecheck`: geçti.
- Üç geçici regresyon testi: **üçü de beklenen güvenli davranışa ulaşamadı**:
  1. Kişisel silme sonrası `StudentQuestionThread.StudentUsername` temizlenmedi.
  2. Fotoğraf silme işlemi `IOException` verdiği halde talep `Completed` oldu.
  3. Kurum silme sonrası `AppUser.Username` temizlenmedi.
- Bu üç test yalnız SQLite bellek içi veriler ve hata veren sahte dosya deposuyla
  çalıştırıldı. Yeniden üretim kaynağı `outputs/app-store/deletion-review-2026-10-04/DeletionReviewProbeTests.cs`
  altında saklandı; normal test projesinden kaldırıldı.
- Aşağıdaki diğer bulgular kod incelemesine dayanır; gerçek cihaz/üretim testi değildir.

## Gönderim öncesinde düzeltilmesi gerekenler

### 1. Kişisel veri ve içerik temizliği eksik — yüksek öncelik

`backend/CourseIntellect.Infrastructure/Services/AccountLifecycleService.cs:112`
ödev tesliminde yalnız `StudentName` değiştiriyor. `Note` ve `FilesSerialized`
kalıyor. Soru kaydında `StudentUsername`, `QuestionText`, `AttachmentsSerialized`,
yanıtlarda `MessageText` ve ekler kalıyor. Dosya toplama yalnız profil fotoğrafları
ve mesaj eklerini kapsıyor; ödev/soru dosyaları kapsamda değil.

Kişisel veri envanterindeki bütün kullanıcı ilişkileri ve kopyalanmış kimlik alanları
üzerinden temizlik tamamlanmalı. Korunacak satırlar için yalnız ad değiştirmek
anonimliği kanıtlamaz; serbest metin, dosya ve dolaylı bağlantılar da ele alınmalı.
Ad/sınıf çakışmasında eğitim kayıtlarını atlayan yol (`:108`) temizliği tamamlanmış
saymadan inceleme veya güvenilir kullanıcı bağlantısı gerektiriyor.

### 2. Kurum silme sonrası kişisel bilgiler kalıyor — yüksek öncelik

`AccountLifecycleService.cs:301` kullanıcı adlarını, kampüs/bölüm ve rol geçmişini
temizlemiyor. `:329` kurum kaydında yalnız durumu değiştiriyor; `TenantWorkspace`
iletişim adı/e-postası/telefonu ve kayıt IP/cihaz alanları kalıyor. Saklanan
`AccountingInvoice` satırlarında `Counterparty`, `Note` vb. için temizlik yok.
Denetim kayıtlarında (`:313`) yalnız aktör adı değişiyor; IP, cihaz, before/after
ve detay alanları kişisel veri taşıyabiliyor.

Kurumun operasyonel tablolarını silmek fiziksel dosyaları otomatik silmez.
İçerik/belge/diğer yüklemeler de envantere dahil edilmeli. Politika gereği korunacak
veriler gerekçe, kapsam ve süreyle açıkça belirtilmeli; kalan bütün verilerin
anonim olduğu kullanıcıya söylenmemeli.

### 3. Dosya hatasında yanlış başarı ve erken bildirim — yüksek öncelik

`AccountLifecycleService.cs:225` dosya hatasını yutup dönüyor; kurum yolunda `:351`
aynı davranış var. Dosyalar kalmasına rağmen finalizer `Completed` yazıyor.
Silinen DB referansları nedeniyle başarısız dosyaların listesi de kalıcı tekrar
deneme kuyruğuna alınmıyor.

`AccountDeletionFinalizerService.cs:95` gerçek silmeden **önce** “Hesabınız silindi”
bildirimi gönderiyor. Sonraki işlem başarısız olsa da kullanıcıya başarı bildirilmiş
oluyor. Başarı bildirimi bütün gerekli adımlar başarıyla bittikten sonra gönderilmeli;
gerekirse bildirim hedefi güvenli biçimde işlem öncesinde alınmalı. Hata ve yeniden
deneme durumları açıkça modellenmeli; `Failed` talepler mevcut otomatik seçimde
yeniden işlenmiyor.

### 4. Sürücü ve yemekhane kullanıcıları silme ekranına ulaşamıyor — yüksek öncelik

`mobile/lib/services/role_router.dart:133` aktif sürücüyü ayrı sürücü ekranına,
`:77` yemekhane kullanıcısını yalnız yemek programı ekranına yönlendiriyor.
Bu ekranlarda profil/hesap silme bağlantısı bulunmuyor. Diğer profillere tile
eklemek bu iki rolü kapsamıyor. Her iki role de erişilebilir hesap ayarları/silme
girişi eklenmeli ve rol bazında widget veya cihaz testi yapılmalı.

### 5. Tek yönetici akışında engellenme ve yanlış devir — yüksek öncelik

`AccountDeletionService.cs:80` devredilecek personel yoksa talebi reddediyor;
tek kullanıcılı bir kurumda kişisel silme için ilerleme yolu yok. Platform tarafında
alternatif bir tamamlama akışı sağlanmalı; kurum silme onayı kişisel silmenin şartı
olmamalı.

`:86` sunucu devralanın talep sahibi olmadığını kontrol etmiyor. İstemci aday
listesi kendisini gizlese de API'ye kendi kimliğini gönderen yönetici kendi kendisine
devir yapıp talep oluşturabilir. Devralanın aktif silme talebi bulunmaması da
kontrol edilmiyor. Devir güvenilir başka bir kullanıcıya yapılmalı; eşzamanlı
yönetici silmeleri ve işlemin iptali ele alınmalı.

### 6. Üretimde tamamlama servisi etkinliği doğrulanmadı — gönderim engeli

`backend/CourseIntellect.Api/appsettings.json:59` ve `:64` her iki finalizer için
`Enabled: false` içeriyor. Üretim ortam değişkeniyle açılmış olabilir; bu incelemede
doğrulanmadı. Varsayılan ayarlarla talepler gerçek silmeye ulaşmaz. Migration,
sunucu dağıtımı, etkin bayraklar ve gözlemlenebilir tamamlama staging ortamında
doğrulanmalı; veri temizliği sorunları düzelmeden üretimde etkinleştirilmemeli.

## Diğer işlevsel eksikler

- **Mobil form butonu:** `mobile/lib/pages/account_deletion_page.dart:139` ve
  `institution_deletion_page.dart:99` parola alanı değişirken üst formu güncellemiyor.
  Onay kutusu önce seçilip sonra parola yazılırsa gönderme butonu yeni metne göre
  yenilenmeyebilir. Parola boşaltıldığında ters durum da oluşabilir. Metin değişimini
  dinleyen durum güncellemesi eklenmeli ve her iki giriş sırası test edilmeli.
- **Kurum silme önizlemesi:** `InstitutionDeletionService.cs:82` ilk talep yokken
  etki döndürmüyor. Sayılar talep oluşturulunca hesaplanıyor; ilk onay öncesinde
  gerçek etki gösterilmiyor. Ayrıca dosya sayısı içerik/belge satır sayısıyla sınırlı.
  Talep öncesi yetkili bir önizleme endpoint'i ve eksiksiz etki sayımı gerekli.
- **Yeniden doğrulamada hız sınırı:** Parola kontrol eden yeni talep endpoint'lerinde
  `EnableRateLimiting` yok. Mevcut `auth` politikası yalnız iliştirildiği endpoint'lere
  uygulanıyor; bu endpoint'ler için kullanıcı/IP bazlı bir limit eklenmeli.
- **Gizlilik metinleri:** Marketing kaynaklarında yeni silme açıklamaları var;
  mobil/masaüstü gömülü hukuk metinleri aynı ayrıntıları içermiyor. Tek politika,
  gerçek temizlik davranışı ve sürüm/onay akışı eşleştirilmeli. Mevcut 30 günlük
  bekleme süresi kodda seçilmiş; bunun veri saklama politikasının doğrulandığını
  kanıtladığı varsayılmamalı.

## iOS ve macOS için kalan dağıtım işleri

- Mevcut imzalı iOS `0.1.0 (2)` paketinin değiştirilme zamanı **13:36 +03:00**;
  silme commit'i **17:44 +03:00**. Bu paket yeni hesap silme akışını içermiyor.
  Düzeltmelerden sonra yeni build numarasıyla arşiv/IPA hazırlanmalı.
- Yerel doğrulama özetinde `uploadedToApple: false`. App Store Connect uygulama
  kaydı, yükleme, Apple işleme sonucu ve TestFlight kurulumu ayrıca doğrulanmalı.
- Çalışma alanında hazır imzalı Mac App Store `.pkg` bulunmadı. Mağaza profil ve
  imzalarıyla paket üretimi, sandbox altında çalışması ve yükleme doğrulanmalı.
- İnceleme için rol bazlı demo hesapları, gizlilik beyanları, ekran görüntüleri,
  yaş derecelendirmesi ve inceleme notlarının tamamlandığı bu incelemede doğrulanmadı.
- Gerçek iPhone/iPad üzerinde rol bazlı giriş, hesap silme, servis konumu,
  ekran kilitliyken konum, üretim bildirimleri; Mac sandbox altında dosya,
  kamera/mikrofon ve oturum akışları test edilmeli.

Apple, manuel hesap silmeye izin veriyor; kullanıcıya süre ve tamamlanma bildirimi
verilmesini, yasal olarak tutulması gerekmeyen ilişkili verilerin de silinmesini
istiyor. Ekranın varlığı tek başına tamamlama ve veri temizliği eksiklerini kapatmaz.

- [Apple: Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple: App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

Bu rapor mağaza onayı garantisi veya yasal veri saklama politikası doğrulaması değildir.
