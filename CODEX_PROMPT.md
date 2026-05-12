# CourseIntellect Mobil — Hata Düzeltme Görevi

## Proje Bağlamı
- **Konum**: `/Users/oguzhanmindivanli/Desktop/CourseIntellectProject-gh/`
- **Mobil uygulama**: Flutter (`mobile/` klasörü)
- **Backend**: ASP.NET Core 8.0 + PostgreSQL + EF Core (`backend/`)
- **Mimari**: Multi-tenant. `tenant_workspaces` tablosu temel taş, tüm veriler tenant-scoped.
- **Roller**: Öğrenci (student), Öğretmen (teacher), Veli (parent), Muhasebeci (accounting), Admin (kurum yöneticisi), Superadmin (platform).
- **Paket yöneticisi**: `mobile/pubspec.yaml` — `video_player`, `file_picker`, `firebase_messaging`, `image_picker`, `signalr_netcore`, vb.
- **API servisleri**: `mobile/lib/services/` altında (ör. `homework_api_service.dart`, `message_api_service.dart`, `question_bank_api_service.dart`).
- **Oturum**: `AuthSessionStore` → `mobile/lib/services/auth_session_store.dart`. JWT Bearer token ile backend'e bağlanıyor.

---

## Görev Özeti

Aşağıdaki 11 mobil hatayı düzelt. Her biri için dosya yollarını, mevcut durumu ve beklenen çıktıyı açıkladım. Kod değişikliği yalnızca gerekli olan dosyalarda olsun; gereksiz refactor yapma. Türkçe metinlerde UTF-8 karakterler (ç, ğ, ı, ö, ş, ü, İ, Ş, Ğ, Ö, Ü, Ç) doğru kullanılmalı.

---

### 1. Öğrenci — "Yanlış Çözdüklerim" sayfası doğru cevapları da gösteriyor
- **Dosya**: `mobile/lib/pages/student_wrong_answers_page.dart`
- **Servis**: `mobile/lib/services/wrong_answers_api_service.dart` — `WrongAnswerRecord` modelinde `yourAnswer` ve `correctAnswer` alanları var.
- **Sorun**: `/api/wronganswers` endpoint'i TÜM pratik kayıtlarını döner (hem doğru hem yanlış).
- **Çözüm**: Kayıtları gruplamadan önce filtrele:
  ```dart
  final wrongOnly = records.where((r) =>
    r.yourAnswer.trim().toLowerCase() != r.correctAnswer.trim().toLowerCase()
  ).toList();
  ```
  Sonraki tüm gruplamayı `records` yerine `wrongOnly` üzerinde yap.
- **Kabul**: Sayfada sadece gerçekten yanlış cevaplanmış sorular listelenecek.

---

### 2. Mesajlaşma — görseller inline görünmüyor (tüm roller)
- **Dosya**: `mobile/lib/widgets/message_bubble.dart`
- **Model**: `MessageAttachmentRecord` (`mobile/lib/services/message_api_service.dart`) — `isImage`, `absoluteUrl`, `fileType`, `originalFileName` alanları mevcut.
- **Sorun**: `_AttachmentTile` widget'ı her ek için ikon+dosya adı tile gösteriyor.
- **Çözüm**: `attachment.isImage == true` ise `Image.network(attachment.absoluteUrl)` ile `ClipRRect(BorderRadius.circular(14))`, `ConstrainedBox(maxHeight: 220)`, `BoxFit.cover`, `loadingBuilder` (spinner), `errorBuilder` (dosya tile'ına fallback) kullan. Diğer türler için mevcut tile kalsın (bir `_fileTile()` yardımcı metoduna çıkar).
- **Kabul**: Resim gönderilince baloncukta küçük resim olarak görünür, tıklayınca `onAttachmentTap` çalışır.

---

### 3. Mesaj silme özelliği (tüm roller)
- **Dosya**: `mobile/lib/widgets/chat_conversation_view.dart` ve `mobile/lib/widgets/message_bubble.dart`
- **Not**: Uzun basma → "Benden Sil" bottom sheet zaten var; sadece çalıştığından emin ol. `MessageApiService.instance.deleteForMe(messageId)` API'si mevcut.
- **Kabul**: Kullanıcı kendi mesajına uzun basınca "Benden Sil" seçeneği çıkar, tıklayınca listeden silinir (backend'e delete istek atılır).

---

### 4. Öğretmen — "Canlı Ders Oluştur"da tarih seçici yok
- **Dosya**: `mobile/lib/pages/teacher_create_live_lesson_page.dart`
- **Sorun**: Sadece saat ve URL alanı var; tarih girilmiyor.
- **Çözüm**:
  - Yeni `TextEditingController dateController`.
  - `Future<void> _pickDate()` → `showDatePicker` (now ± 365 gün), seçilen tarihi `DD.MM.YYYY` formatında `dateController.text`'e yaz.
  - "Sınıf" dropdown'undan sonra `TextField(readOnly: true, suffixIcon: Icons.calendar_today_rounded, onTap: _pickDate)`.
  - `_saveLesson`'da `dateController.text` boşsa uyarı ver.
  - Navigator.pop sonucu map'ine `"date": dateController.text.trim()` ekle.
  - `dispose`'da `dateController.dispose()`.
- **Kabul**: Tarih seçilmeden kayıt olmaz; seçilen tarih canlı dersler listesinde görünür.

---

### 5. Öğretmen — Sınav oluşturma butonu sessizce başarısız oluyor
- **Dosya**: `mobile/lib/pages/teacher_create_exam_page.dart`
- **Sorun**: `_saveExam()` senkron; `_saveExamAsync()` çağrısı `await` olmadan yapılıyor, exception yakalanmıyor.
- **Çözüm**:
  ```dart
  Future<void> _saveExam() async {
    try {
      await _saveExamAsync();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sınav oluşturulamadı: $e')),
      );
    }
  }
  ```
  Buton `onPressed: _saveExam` kalsın.
- **Kabul**: Hata olursa SnackBar'da mesaj görünür; başarılıysa Navigator.pop ile liste güncellenir.

---

### 6. Öğretmen — Canlı ders silme çalışmıyor
- **Dosya**: `mobile/lib/services/school_feed_api_service.dart` — `_parseLiveLesson` fonksiyonu.
- **Sorun**: `LiveLessonRecord.id` composite string olarak kuruluyor (`'${announcement.title}-${announcement.date}-${map['class']}'`), backend'in gerçek ID'siyle eşleşmiyor.
- **Çözüm**: `id: announcement.id` kullan. Ayrıca status stringini `'Planlandi'` → `'Planlandı'` olarak düzelt.
- **Dosya**: `mobile/lib/pages/teacher_live_lessons_page.dart` — `_parseSchedule` fonksiyonu `DD.MM.YYYY` tarih formatını kabul etmeli. İmza: `DateTime? _parseSchedule(String value, [String? dateStr])`. Çağrı yerinde `result["date"] as String?` gönder.
- **Kabul**: Silme butonuna basınca backend DELETE çağrısı geçer, liste güncellenir.

---

### 7. Öğretmen — Video içerikleri inline oynatılmıyor
- **Dosyalar**:
  - `mobile/lib/pages/content_detail_page.dart` (öğrenci tarafı)
  - `mobile/lib/pages/teacher_content_detail_page.dart` (öğretmen tarafı)
- **Paket**: `video_player` (pubspec.yaml'da mevcut).
- **Not**: Oynatma mantığı zaten implement edilmiş durumda. `Info.plist`'te `NSAllowsArbitraryLoads: true` set.
- **Kabul**: HTTP üzerinden gelen mp4 linkleri uygulama içinde oynar. Dışarı yönlendirme yapmaz.

---

### 8. Öğretmen — Video yüklerken başlık/tip/boyut otomatik dolmuyor
- **Dosya**: `mobile/lib/pages/teacher_content_create_page.dart`
- **Sorun**: `_pickFile()` sadece dosya adını alıyor.
- **Çözüm**:
  - Uzantıdan tür tespit et: `mp4/mov/m4v` → `Video`, `pdf` → `PDF`, `doc/docx` → `Word`, `ppt/pptx` → `PowerPoint`, diğer → `Dosya`.
  - Başlık alanı boşsa dosya adından uzantıyı çıkar, `_` ve `-` karakterlerini boşluğa çevir, başlık alanına yaz.
  - Bilgi alanı boşsa `Boyut: X.X MB` yaz (`result.files.single.size` byte'tan MB'a).
  - Tür dropdown'unu tespit edilen değere setle.
- **Kabul**: Dosya seçilince başlık/bilgi/tür otomatik doldurulur; kullanıcı isterse üzerine yazabilir.

---

### 9. Öğretmen — Soru bankası ekle → 400 Bad Request
- **Dosya**: `mobile/lib/services/question_bank_api_service.dart` — `_toPayload` fonksiyonu.
- **Sorun**: Expression body ile tüm opsiyonel alanlar null gönderiliyor, backend `ModelState.IsValid` başarısız.
- **Çözüm**: Block body'ye çevir, sadece null-olmayan opsiyonel alanları ekle:
  ```dart
  Map<String, dynamic> _toPayload(...) {
    final payload = <String, dynamic>{
      'classId': classId,
      'subject': subject,
      'topic': topic,
      'questionText': questionText,
      'type': type,
      // zorunlu alanlar
    };
    if (imagePath != null) payload['imagePath'] = imagePath;
    if (correctOptionIndex != null) payload['correctOptionIndex'] = correctOptionIndex;
    if (solutionAssetPath != null) payload['solutionAssetPath'] = solutionAssetPath;
    if (solutionAssetType != null) payload['solutionAssetType'] = solutionAssetType;
    if (questionSetKey != null) payload['questionSetKey'] = questionSetKey;
    if (questionSetTitle != null) payload['questionSetTitle'] = questionSetTitle;
    if (questionOrder != null) payload['questionOrder'] = questionOrder;
    if (expectedAnswer != null) payload['expectedAnswer'] = expectedAnswer;
    return payload;
  }
  ```
- **Backend**: `backend/CourseIntellect.Api/Controllers/QuestionBankController.cs` — `[Authorize(Roles = "Teacher,Admin")]` olduğunu kontrol et.
- **Kabul**: Soru eklendiğinde 200 döner, liste güncellenir.

---

### 10. Öğretmen — Teslim edilen ödevler boş görünüyor
- **Dosya**: `mobile/lib/pages/teacher_assignment_submissions_page.dart`
- **Sorun**: Sayfa yalnızca `widget.assignment["submissions"]` map'inden okuyor; yoksa boş gösteriyor.
- **Çözüm**:
  - `initState`'te `_loadSubmissions()` çağır.
  - Önce local `widget.assignment["submissions"]` dolu mu bak, doluysa kullan.
  - Değilse `HomeworkApiService.instance.fetchAssignments()` çağır, `id` eşleşen assignment'ın `submissions`'ını al.
  - Yüklenirken `_loading = true` → `CircularProgressIndicator`.
- **Kabul**: Öğretmen bir ödeve girdiğinde API'den teslim listesi çekilir, öğrenci isim/tarih/dosya adedi görünür.

---

### 11. Tüm uygulamada Türkçe karakter düzeltmesi
- **Kapsam**: `mobile/lib/pages/`, `mobile/lib/widgets/`, `mobile/lib/services/`, `mobile/lib/navigation/` altındaki TÜM `.dart` dosyaları.
- **Kural**:
  - Kullanıcıya görünen STRING literal'larda ASCII-only Türkçe → UTF-8 düzelt.
  - `Henuz` → `Henüz`, `Icerik` → `İçerik`, `Ogretmen` → `Öğretmen`, `Sinif` → `Sınıf`, `Cozdukl` → `Çözdükl`, `Ogrenci` → `Öğrenci`, `Odev` → `Ödev`, `Planlandi` → `Planlandı`, `Subat/Mayis/Agustos/Eylul/Kasim/Aralik` → `Şubat/Mayıs/Ağustos/Eylül/Kasım/Aralık`, vb.
  - JSON anahtarlarını, API endpoint path'lerini, enum stringlerini değiştirme — sadece UI metni.
  - `const` stringleri de kapsa.
- **Kabul**: Uygulamada her yerde Türkçe karakterler doğru render edilir.

---

## iOS Build Altyapı Sorunu (Ekstra)

**Sorun**: `/Users/oguzhanmindivanli/Desktop/` iCloud Drive ile senkronlu olduğundan dosyalara `com.apple.FinderInfo` ve `com.apple.fileprovider.fpfs#P` xattr'ları ekleniyor. Xcode codesign bundle'larda bu xattr'ları görünce `resource fork, Finder information, or similar detritus not allowed` hatasıyla reddediyor.

**Kalıcı çözüm seçenekleri** (kullanıcıya sun):
1. Sistem Ayarları → Apple Account → iCloud → iCloud Drive → Seçenekler → "Masaüstü & Belgeler Klasörleri" işaretini kaldır **+ Mac'i restart et** (bird ve fileproviderd daemon'larının Desktop bağlantısını bırakması için).
2. Projeyi iCloud dışında bir konuma taşı (ör. `/Users/oguzhanmindivanli/dev/CourseIntellectProject-gh/`).

**Geçici workaround** (`mobile/run_ios.sh` zaten mevcut):
- `flutter build ios --simulator --no-codesign`
- `ditto --noextattr --noqtn build/ios/iphonesimulator/Runner.app /tmp/CourseIntellectRunnerBuild/Runner.app`
- Strip xattr → `xattr -c` recursively
- `codesign --force --sign - --timestamp=none /tmp/.../Runner.app`
- `xcrun simctl install <simId> /tmp/.../Runner.app`
- `xcrun simctl launch <simId> com.courseintellect.student`

---

## Çalışma Kuralları

1. **Yalnızca gerekli dosyaları düzenle**. Gereksiz refactor, yeni abstraction, yeni yorum satırı ekleme.
2. **UTF-8 karakterleri koru**. Dosyaları yazarken encoding bozulmasın.
3. **Backend veri şemasını değiştirme** — sadece mobile tarafı.
4. **Her değişiklikten sonra derlemeyi doğrula**:
   - Android: `cd mobile && flutter build apk --debug`
   - iOS: `cd mobile && ./run_ios.sh` (iCloud kapatılmadıysa)
5. **Rapor**: Hangi dosya → hangi satır → ne değişti, kısa özet.
6. **Mevcut kodla uyumu koru** — `AuthSessionStore`, `StudentRegistryStore` gibi singleton'lar zaten var, aynı şekilde kullan.

## Test Adımları (sonunda doğrula)
- **Öğrenci**: Yanlış çözdüklerim → sadece yanlış sorular. Mesajlaşma → resim gönder → inline görünsün. Mesaja uzun bas → Benden Sil çalışsın.
- **Öğretmen**: Canlı Ders Oluştur → tarih seçici görünsün. Sınav oluştur → butona bas, hata varsa SnackBar. Canlı dersi sil → 200 dönsün. İçerik oluştur → video seç → başlık/tür/boyut otomatik. Soru bankasına soru ekle → 200 dönsün. Teslim sayfası → liste görünsün.
- **Tüm roller**: Rastgele sayfalarda Türkçe karakterleri kontrol et.
