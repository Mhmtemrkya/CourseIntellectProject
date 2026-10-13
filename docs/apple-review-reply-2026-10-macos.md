# Apple App Review — macOS 2.1 "Information Needed" yanıtı

> App Store Connect → SchoolAsist Desktop (macOS, ASC 6819349061) → **Resolution
> Center** → bu metni **Reply** olarak gönder. Ayrıca aynı özeti **App Review
> Information → Notes** alanına da ekle. Yanıt İngilizce yazıldı.
> Red iOS ile birebir aynı (Guideline 2.1 Information Needed, yeni hesap). Çözüm aynı.

---

## Reply / Notes metni (İngilizce — kopyala)

Hello, and thank you for reviewing SchoolAsist for macOS. Please find the
requested information below. We have also added it to the App Review Notes.

**2. App purpose and target audience**
SchoolAsist is a school management application for K‑12 schools and private
course centers in Türkiye. It helps an institution run its daily operations in
one place: academics and class schedules, attendance, exams and results,
tuition/finance tracking, school‑bus (service) tracking on a live map,
announcements, and secure messaging between the school and families. The macOS
app is the desktop companion used mainly by school administrators, teachers and
accounting/administrative staff, while parents and students — members of the
general public — use it for free to follow their child's/their own school life.

**3. Setup and access, including demo credentials**
Accounts are provisioned by each institution's administrator; there is no public
self‑registration inside the app. The app still provides in‑app account deletion
(Settings → Account Deletion / Delete My Account) per Guideline 5.1.1(v). To
access all features, use the demo accounts below (same password for all):

- Administrator: `apple.admin`
- Teacher: `apple.ogretmen`
- Student: `apple.ogrenci`
- Parent: `apple.veli`
- Accounting: `apple.muhasebe`
- Password (all accounts): `<App Review Information alanındaki parola>`

After login the user lands directly on their role dashboard. Main features to
try: Dashboard, Academic Management, Operations, Finance, Service (bus) Tracking
with the live map, Announcements, Messaging, and Settings → Account Deletion.

**4. External services used**
- Our own backend API (`https://maydanozasist.schoolasist.com`) for
  authentication and all application data (REST + SignalR over HTTPS/WSS).
- OpenStreetMap (`openstreetmap.org`) to display the school‑bus tracking map.
- A self‑hosted video meeting service for optional parent–teacher meetings.
- No in‑app purchases, no external payment processor, no third‑party advertising
  and no AI services. The app is free.

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
internal‑use app. Its users include parents and students — members of the
general public — who use it for free to follow their school life. Public App
Store distribution is therefore appropriate.

A screen recording captured on a Mac, showing launch → login → the main
features → the in‑app account deletion flow, is attached.

Thank you.

---

## Senin yapman gerekenler (Türkçe özet)

1. **Yukarıdaki İngilizce metni** macOS kaydının Resolution Center'ında **Reply**
   olarak gönder; aynısını **App Review Information → Notes** + Sign‑In alanına ekle
   (apple.admin / <App Review Information alanındaki parola>).
2. **Mac'te ekran kaydı** çek (⌘⇧5 → Kaydet). Akış:
   - SchoolAsist Desktop uygulamasını **aç** (launch'tan başlasın)
   - `apple.admin` ile **giriş yap**
   - Panel → Akademik → Operasyon → **Servis Takip (harita)** → Finans → Raporlar'ı gez
   - **Ayarlar → Hesap Silme** ekranını aç (silme talebi ekranını göster; gerçek
     silmeyi onaylamana gerek yok)
   - Kaydı bitir, Resolution Center cevabına ekle.

## Notlar
- Kayıt ol (self‑signup) ve ücretli içerik/IAP yok → onları kaydetme.
- Mesajlaşma kapalı bir sistem (okul↔veli) → ayrı raporlama/engelleme göstermene gerek yok.
- 2.3.3: Mac ekran görüntüleri gerçek ekranlardı (login yok), sorun değil.
- Test için dev‑imzalı kopya: `outputs/mac-sandbox-test/build-2/SchoolAsist.app`.
