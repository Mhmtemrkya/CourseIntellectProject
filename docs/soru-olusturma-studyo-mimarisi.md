# Course Intellect Soru Oluşturma Stüdyosu

## 1. Desktop React UI

Ana route: `/t/question-studio`

Üç kolonlu premium dark UI kullanılır:

- Sol sidebar: Dashboard, Soru Bankam, Deneme Sınavları, Kurumsal Sınavlar, Öğrenci Çözümleri, PDF Raporları, AI Araçları.
- Orta editor: soru tipi seçimi, rich text alanı, görsel ekleme, seçenek yönetimi, çözüm editörü, canvas çizim alanı.
- Sağ panel: ders, konu, kazanım, zorluk, puan, sınıf, etiket, açıklama, yayın/taslak, AI araçları.

## 2. Mobile Flutter UI

Ana sayfa: `TeacherQuestionStudioPage`

- Telefon: Editör / Ayarlar / Çizim sekmeleri.
- Tablet: sol menü, orta editör, sağ ayar paneli.
- Dark mode, glass card, turuncu accent, responsive layout.

## 3. Folder Structure

Desktop:

```text
desktop/src/pages/teacher/TeacherQuestionStudio.jsx
desktop/src/features/solving/canvas/DrawingCanvas.jsx
desktop/src/lib/api/modules.js
```

Mobile:

```text
mobile/lib/pages/teacher_question_studio_page.dart
mobile/lib/widgets/solution_drawing_canvas.dart
mobile/lib/services/question_bank_store.dart
```

Backend:

```text
backend/CourseIntellect.Api/Controllers/QuestionStudioController.cs
backend/CourseIntellect.Api/Controllers/QuestionBankController.cs
backend/CourseIntellect.Domain/Entities/QuestionBankItem.cs
```

## 4. React Component Architecture

- `TeacherQuestionStudio`: page shell and orchestration.
- `Field`: reusable setting field wrapper.
- `DrawingCanvas`: shared pointer-event canvas for mouse, touch, stylus.
- API layer:
  - `createQuestionBankItem`
  - `saveQuestionStudioDraft`
  - `generateQuestionStudioAi`
  - `uploadFile`

## 5. Flutter Architecture

- `TeacherQuestionStudioPage`: adaptive teacher editor.
- `SolutionDrawingCanvas`: reusable CustomPainter canvas.
- `QuestionBankStore`: persistent question creation path.
- `QuestionBankApiService`: backend communication.

## 6. Backend Architecture

Mevcut canlı yapıyı bozmamak için ana kayıt akışı mevcut `QuestionBankItem` tablosuna bağlıdır.

Yeni yardımcı controller:

- `QuestionStudioController`
- taslak saklama
- AI üretim sözleşmesi

Gerçek AI servisi bağlanınca controller içindeki rule-based mock aynı DTO sözleşmesiyle LLM servisine yönlendirilir.

## 7. PostgreSQL Schema

Mevcut production-safe tablo:

- `question_bank_items`
- `question_practice_attempts`
- `platform_configurations` taslak storage

İdeal ileri sürüm şeması:

- `questions`
- `question_options`
- `question_assets`
- `question_solutions`
- `question_tags`
- `exams`
- `exam_sections`
- `exam_questions`
- `drawings`
- `drawing_layers`
- `pdf_exports`
- `ai_generations`

## 8. API Listesi

Mevcut çalışan:

- `POST /api/questionbank`
- `PUT /api/questionbank/{id}`
- `DELETE /api/questionbank/{id}`
- `GET /api/questionbank`
- `POST /api/uploads`

Yeni stüdyo:

- `GET /api/question-studio/drafts`
- `POST /api/question-studio/drafts`
- `DELETE /api/question-studio/drafts/{id}`
- `POST /api/question-studio/ai/generate`

## 9. SignalR Events

İleri sürüm eventleri:

- `QuestionDraftSaved`
- `QuestionEditorPresenceUpdated`
- `QuestionAssetUploaded`
- `QuestionAiGenerationCompleted`
- `QuestionCanvasStrokeSaved`
- `QuestionPublished`
- `ExamBuilderUpdated`
- `PdfExportReady`

## 10. Canvas System

Desktop:

- Pointer Events API.
- Mouse, touch, pen ayrımı.
- Stroke JSON.
- PNG snapshot.
- Kalem, fosfor, silgi, renk, kalınlık, undo/redo, grid.

Mobile:

- `CustomPainter`.
- `Listener` pointer events.
- Apple Pencil pressure.
- Zoom/pan.
- Snapshot base64.

## 11. PDF System

Soru ve sınav PDF üretimi:

- Kurum logosu.
- Modern dark/light kapak.
- Soru sıralama.
- Cevap anahtarı.
- Öğrenci çözüm raporu.
- Watermark.
- Sayfa numarası.

Mevcut çözüm raporu PDF tasarımı backendde CourseIntellect markalı hale getirildi.

## 12. AI Integration Structure

AI sözleşmesi:

```json
{
  "subject": "Matematik",
  "topic": "Parabol",
  "difficulty": "Orta",
  "type": "Çoktan Seçmeli",
  "prompt": "Kazanım odaklı soru üret"
}
```

Yanıt:

```json
{
  "questionText": "...",
  "options": ["...", "..."],
  "correctOptionIndex": 0,
  "solution": "...",
  "bloomLevel": "Uygulama",
  "estimatedSeconds": 90,
  "tags": ["matematik", "parabol"]
}
```

## 13. Autosave System

- Desktop taslak backend endpointine kaydedilir.
- UI autosave durumunu gösterir.
- Genişletme: debounce ile 2 saniye sessizlikte otomatik `saveQuestionStudioDraft`.

## 14. Offline Sync System

Önerilen üretim mantığı:

- Local queue: IndexedDB / SQLite.
- Her draft operasyonu queue item olur.
- Online olunca sırayla sync edilir.
- Conflict durumunda `updatedAtUtc` ile yeni kayıt korunur.

## 15. Production-Ready Code Examples

React save:

```js
await createQuestionBankItem({
  subject,
  topic,
  difficulty,
  type,
  questionText,
  options,
  correctOptionIndex,
  teacher,
});
```

Flutter save:

```dart
await QuestionBankStore.instance.addQuestion(
  subject: subject,
  topic: topic,
  difficulty: difficulty,
  type: type,
  questionText: questionText,
  teacher: teacherName,
);
```

Backend draft:

```http
POST /api/question-studio/drafts
{
  "title": "Parabol sorusu",
  "mode": "QuestionBank",
  "payloadJson": "{...}"
}
```
