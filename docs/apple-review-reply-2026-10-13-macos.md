# Apple App Review — macOS red yanıtı (13 Ekim 2026)

> SchoolAsist Desktop (macOS, ASC 6819349061), Submission
> 9577851e-8204-4fcc-9f9e-432512f25de8, incelenen 1.2.4 (2).
> Düzeltilmiş binary: **1.2.4 (3)**.

## Yapılan düzeltmeler

| Madde | Sorun | Çözüm |
|---|---|---|
| 5.2.5 | Alt başlıkta "Mac" | ASC → App Information → Subtitle (TR + EN) "Mac"/"macOS" geçmeyecek şekilde değiştirilir. Ad/açıklama/anahtar kelimeler de taranır. Kod değişikliği yok. |
| 2.4.5(i) | `device.camera` gerekçesi | Kamera gerçekten kullanılıyor (aşağıdaki yanıt). Hiç kullanılmayan `device.audio-input` yetkisi ve `NSMicrophoneUsageDescription` kaldırıldı. |
| 4 | Pencerede başlık çubuğu düğmeleri yok | `decorations: false` macOS'ta trafik ışıklarını gizliyordu. `tauri.macos.conf.json` macOS'ta standart başlık çubuğunu açar (Windows'a dokunulmadı). |

## Resolution Center Reply (İngilizce — kopyala)

Hello, and thank you for the review.

**Guideline 4 – Design:** The main window now uses the standard macOS title bar
with the close, minimize and full-screen buttons. This is included in the new
build 1.2.4 (3).

**Guideline 5.2.5 – Intellectual Property:** We removed "Mac" from the app
subtitle and checked the rest of the metadata for Apple trademarks.

**Guideline 2.4.5(i) – com.apple.security.device.camera:** The app uses the
camera in the following places:

1. Profile photos for students and staff. Sign in as `apple.admin` (password in App
   Review Information), open **Students**, select a student, and in the student
   detail panel under "Öğrenci Fotoğrafı" (Student Photo) click
   **"Web kameradan çek"** (Take from webcam). The camera preview opens and
   "Çek" (Capture) takes the photo. The same control appears when adding or
   editing a student, on the **Teachers** form, and on the staff registration
   pages.
2. Online exam proctoring. When an institution enables camera monitoring for
   an online exam, the student's camera is checked before the exam starts and
   stays on during the exam session.

The camera is only turned on after the user takes one of these actions, and
the system camera permission prompt explains why it is needed. We removed the
unused microphone entitlement (`com.apple.security.device.audio-input`) from
build 1.2.4 (3), so the app now requests only the minimum set of entitlements
it needs.

Thank you.
