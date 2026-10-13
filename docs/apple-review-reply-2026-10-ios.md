# Apple App Review — iOS 2.1 "Information Needed" yanıtı

> App Store Connect → SchoolAsist (iOS) → **Resolution Center** → bu metni **Reply**
> olarak gönder. Ayrıca aynı özeti **App Review Information → Notes** alanına da ekle.
> App Review İngilizce iletişim kuruyor; yanıt İngilizce yazıldı.

---

## Reply / Notes metni (İngilizce — kopyala)

Hello, and thank you for reviewing SchoolAsist. Please find the requested
information below. We have also added this to the App Review Information Notes.

**2. App purpose and target audience**
SchoolAsist is a school management application for K‑12 schools and private
course centers in Türkiye. It helps an institution run its daily operations in
one place: academics and class schedules, attendance, exams and results,
tuition/finance tracking, school‑bus (service) tracking on a live map,
announcements, and secure messaging between the school and families.
Target audience: school administrators, teachers, and accounting/administrative
staff, as well as **parents and students**, who are members of the general
public and use the app for free to follow their child's/their own school life
(schedule, attendance, grades, bus location, announcements, messages).

**3. Setup and access, including demo credentials**
Accounts are provisioned by each institution's administrator; there is no public
self‑registration inside the app. The app still provides in‑app account deletion
(Settings → Delete My Account) and institution deletion for admins, per
Guideline 5.1.1(v). To access all features, use the demo accounts below
(password is the same for all): 

- Administrator: `apple.admin`
- Teacher: `apple.ogretmen`
- Student: `apple.ogrenci`
- Parent: `apple.veli`
- Accounting: `apple.muhasebe`
- Password (all accounts): `<App Review Information alanındaki parola>`

After login the user lands directly on their role dashboard (no password‑change
screen). Main features to try: Dashboard, Academics, Attendance, Exams,
Finance, Service (bus) Tracking with the live map, Announcements, Messaging,
and Settings → Delete My Account.

**4. External services used**
- Our own backend API (`https://<institution>.schoolasist.com`) for
  authentication and all application data.
- Firebase Cloud Messaging (FCM) for push notifications.
- OpenStreetMap tile server (`tile.openstreetmap.org`) for the bus‑tracking map.
- Self‑hosted video meeting service (`meet.schoolasist.com`) for optional
  parent–teacher meetings.
- No in‑app purchases, no external payment processor, and no third‑party
  advertising or AI services. The app is free.

**5. Regional differences**
The app is distributed only in Türkiye and functions consistently for all users
in that region. Content language is Turkish (with an English UI option). There
are no region‑gated features.

**6. Regulated industry / third‑party material**
The app does not provide services in a highly regulated industry and does not
include protected third‑party material. All content (academics, finance,
messaging) is created by the institution and its users within their own tenant.
Map tiles are from OpenStreetMap under its open license (attributed in‑app).

**On Guideline 3.2 (business model):** SchoolAsist is not an employee‑only or
internal‑use app. Its primary App Store users are parents and students —
members of the general public — who download it for free to follow their school
life. Public App Store distribution is therefore appropriate.

A screen recording captured on a physical iPhone, showing launch → login →
the main features → the in‑app account deletion flow, is attached.

Thank you.

---

## Senin yapman gerekenler (Türkçe özet)

1. **Yukarıdaki İngilizce metni** Resolution Center'da **Reply** olarak gönder.
2. Aynı metni **App Review Information → Notes** alanına da yapıştır (gelecek
   gönderimlerde de dursun). Demo hesapların **Sign‑In Information** alanında
   dolu olduğundan emin ol (apple.admin / <App Review Information alanındaki parola>).
3. **Fiziksel iPhone'da ekran kaydı** çek (Ayarlar > Denetim Merkezi > Ekran
   Kaydı). Akış:
   - Uygulamayı **baştan aç** (launch'tan başlasın)
   - `apple.admin` ile **giriş yap**
   - Panel → Akademik → Operasyon/Servis Takip (harita) → Finans → Raporlar'ı gez
   - (İstersen `apple.veli` ile de girip veli ekranlarını göster)
   - **Ayarlar → Hesabımı Sil** akışını aç (silme talebi ekranını göster; gerçek
     silmeyi onaylamana gerek yok, ekranı göstermek yeterli)
   - Kaydı bitir. Resolution Center yanıtına ekle (veya ASC'nin attachment'ı).

## Ek öneriler (bir sonraki reddi önlemek için)
- **2.3.3 – Ekran görüntüleri:** iOS yüklemende bir **giriş (login) ekranı**
  görüntüsü var (`01_giris`). Apple "sadece login/splash ekranı olmasın" diyor.
  Riski sıfırlamak için o login görüntüsünü **gerçek bir özellik ekranıyla**
  değiştirmeni öneririm (örn. Mesajlaşma veya Servis Takip). Diğer 5 görüntü zaten
  gerçek ekran, sorun değil.
- **3.1.1 – IAP:** Uygulamada satın alma yok; bu madde seni etkilemiyor.
- Masaüstü (macOS) tarafına ayrıca bakacağız — muhtemelen aynı 2.1 bilgi talebi
  gelmiştir; aynı yanıt + Mac ekran kaydıyla çözülür.
