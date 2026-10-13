SchoolAsist Apple dağıtımı — DURUM: her iki platform da incelemede. Proje: /Users/oguzhanmindivanli/Developer/CourseIntellectProject.
Oku: docs/apple-submission-readiness-latest.md + outputs/apple-submission-readiness-latest.json.
Dirty worktree değişikliklerini KORU. Backend deploy/restart yapma. Gerçek silme çalıştırma. Secret paylaşma.

## TAMAMLANDI (6 Ekim 2026)
- iOS 1.0.0 (5), ASC 6819080463, com.schoolasist.app: Waiting for Review (DOKUNMA).
- macOS 1.2.4 (2), ASC 6819349061, com.courseintellect.desktop: **Waiting for Review** (6 Ekim ~00:31 İstanbul gönderildi). Kanıt: outputs/app-store/mac-waiting-for-review-2026-10-06.jpg.
  - 5 ekran görüntüsü (2880×1800) yüklendi, App Privacy published (15 tür, App Functionality/Linked/no-tracking), build 2 bağlı, export compliance "None" (muaf, iOS ile tutarlı), manuel yayın.
- Her iki başvuru manuel yayın: Apple onayından sonra AYRICA "Release this version" yapılmalı.

## KALAN / SONRAKİ
1. Apple inceleme sonucunu bekle (~48s, e-posta). Onaylanırsa her iki platformda manuel "Release" (kullanıcı onayıyla).
2. Reddedilirse: Resolution Center mesajını oku, ilgili düzeltmeyi yap, yeni build yükle, yeniden gönder.
3. Veli online (kart) ödeme kaldırma kodu worktree'de bekliyor (commit edilmedi) — sonraki iOS/desktop sürümlerine girecek:
   - Mobil: veli_online_odeme_page.dart + veli_odeme_makbuz_page.dart silindi; veli_home_page.dart ve veli_odeme_page.dart'tan giriş butonları kaldırıldı.
   - Desktop: ParentPayments.tsx "Kayıtlı Kartlarım" placeholder tile kaldırıldı.
   - Bunları yeni sürüm derlenirken dahil et; gerekirse commit/flutter build/tauri build + yeni ASC sürümü.
4. Mac ekran görüntüleri apple.admin demo'dan (veri seyrek) — istenirse dolu veriyle yenilenebilir.

## ARAÇLAR / İPUÇLARI
- ASC işleri: Claude-in-Chrome eklentisi (Browser 1 bağlıydı). tabs_context_mcp ile doğrula, browser_batch ile hızlı ilerle.
- Export compliance cevabı "None of the algorithms mentioned above" (sadece OS HTTPS/TLS + keychain).
- Native Mac test uygulaması: outputs/mac-sandbox-test/build-2/SchoolAsist.app (dev-imzalı), apple.admin/<App Review Information alanındaki parola>. GUI için /tmp/mac_input.py (Quartz click/scroll); Tauri webview odak değişince blank olabilir → her tıktan önce uygulamayı öne getir; her sayfa ilk ziyarette onboarding turu açar.
- signing.env.local (APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID) — yazdırma. altool --validate-app/--upload-app -t macos çalışıyor.
