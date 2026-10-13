> Güncel uygulama ve dağıtım durumu: [5 Ekim 2026 raporu](apple-store-preparation-2026-10-05.md). Bu dosya önceki tasarım/hazırlık geçmişini içerir.

# Uygulama içinden hesap silme tasarımı

Bu belge mevcut akışın denetimi ve uygulanacak tasarımdır. Silme endpoint'i veya
işlemi uygulanmış değildir. Eğitim/finans verisi saklama kararı doğrulanmadan
toplu veri silme etkinleştirilmemeli.

## Kullanıcı akışı

Tüm rollerin hesap ayarlarında Hesabı Sil bulunacak; sürücü/kantin de kapsanacak.
Silinecek kişisel veriler, tutulacak kayıtlar ve işlem süresi açıklanacak. Mevcut
parola yeniden doğrulanacak; açık son onay alınacak. Silme hedefi istemciden
gelen ID yerine oturumdaki kullanıcıdan çözümlenecek. Uzun işlem varsa talep ve
sonuç uygulama içinde görülecek. Pasife alma veya destek e-postası tamamlanmış
hesap silme olarak gösterilmeyecek.

## Veri envanteri

Kullanıcı/profil/iletişim/içerik alanları taşıyan 62 entity dosyası bulundu:
`outputs/app-store/account-data-field-inventory.json`. Bu tarama alan isimlerine
dayanır; JSON payload, serbest metin, dosyalar ve dolaylı ilişkiler ayrıca incelenmeli.

| Veri grubu | İncelenecek kapsam |
| --- | --- |
| Hesap/erişim | AppUser, refresh/auth/MFA/parola sıfırlama, push ve tercihler |
| Profil | StudentProfile/StaffProfile, TC, adres, fotoğraf, veli bağları ve notlar |
| Eğitim | UserId/Username/ProfileId üzerinden sınav, ödev, kütüphane, rehberlik, kursiyer kayıtları |
| Kullanıcı içeriği | Mesajlar, gömülü gönderen adı, JSON ekler, soru cevapları, assistant konuşmaları, medya |
| Servis | Sürücü, durak, öğrenci ataması, sefer/yoklama ve GPS geçmişi |
| Kurum sahipliği | TenantWorkspace.AdminUserId, TenantGroup.OwnerUserId ve yetki devri |
| Finans | Sözleşme/taksit/tahsilat/makbuz/maaş; belirlenmiş saklama veya anonimleştirme politikası |
| Denetim/yasal | İsimli loglar, onay, IP/cihaz; gerekçeli saklama süresi |

Tek AppUser satırını silmek yetmez: MessageItem.SenderName ve
StudentQuestionThread.StudentUsername gibi kopyalanmış kimlik alanları da kalıyor.
Dosyalar DB silinince fiziksel olarak kaldırılmıyor. Medya temizliği upload kökü
dışına çıkmamalı ve ortak dosyanın diğer sahiplerinin verisini kaybettirmemeli.

## Sunucu ve testler

- Oturumdaki kişinin talep/durum endpoint'i; parola ve açık onay doğrulaması,
  rate limit, tenant kapsamı ve idempotent istek.
- DB transaction, yeniden denenebilir medya temizliği; tüm adımlar tamamlanmadan
  başarı bildirimi oluşturulmaması.
- SecurityVersion ve refresh/auth/push iptali; eski token ve yeniden girişin engellenmesi.
- Her grup için sil/anonimleştir/yasal süre boyunca tut kararı; gerekçe ve son silme tarihi.
- Kurum sahibinde yetki devri ve ilişki bütünlüğü.
- Yanlış parola/onaysız istek, rol/tenant izolasyonu, tekrarlı istek, medya/DB hataları,
  kopyalanmış kişisel alanlar, ortak dosya ve finans saklama testleri.

## İmzalama

Xcode profilleri yeniden indirildi; SchoolAsist için yalnız development profili
bulundu. Manage Certificates kullanıcıya açıldı. Apple Distribution ve private
key kullanıcı tarafından sağlanınca mevcut arşiv yeniden export edilebilir.
