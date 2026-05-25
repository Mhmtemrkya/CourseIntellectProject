# Course Intellect Soru Çözme / Deneme Sınavı Çözme Sistemi

Bu doküman mevcut Course Intellect mimarisi üzerine eklenmesi gereken profesyonel çözüm ekranı, kalem/canvas, PDF rapor ve canlı takip sistemini tarif eder. Yeni ayrı backend veya veritabanı kurulmaz; mevcut ASP.NET Core Web API, PostgreSQL, SignalR, S3 uyumlu storage, React desktop ve Flutter mobil/tablet yapısı genişletilir.

## 1. Ürün Gereksinim Dokümanı

Amaç, öğrencinin ve öğretmenin sınav, deneme ve soru bankası sorularını premium dark arayüzde çözebilmesi, çözüm sırasında cevap, not ve kalemle işlem verisinin otomatik kaydedilmesi ve tamamlandığında PDF rapor üretilmesidir.

Kapsam:
- Öğrenci deneme/sınav/soru bankası oturumu başlatır.
- Öğrenci cevap seçer, boş bırakır, işaretler, not alır, çizim yapar.
- Öğretmen kendi sorularını öğrenci gibi test çözümü olarak çözer.
- Öğretmen öğrenci çözümlerini, çizimlerini, notlarını ve PDF raporlarını inceler.
- Sistem autosave, offline cache, reconnect sonrası sync ve SignalR canlı durum yayınını destekler.
- PDF raporu arka plan işiyle oluşur ve hazır olduğunda öğrenci/öğretmene bildirim gider.

Başarı kriterleri:
- Cevap ve çizim kaybı olmamalı.
- Canvas mobil/tablet/desktop cihazlarda akıcı olmalı.
- PDF raporu tüm soru çözüm geçmişini içermeli.
- Öğretmen test çözümü öğrenci istatistiklerine karışmamalı.
- Rol bazlı yetki korunmalı.

## 2. Desktop React Ekran Mimarisi

Ana ekran: `ExamSolvingPage.tsx`

Desktop layout:
- Sol sidebar: Soru Listesi, İlerlemem, Notlarım, Kayıt, Ayarlar.
- Üst bar: sınav adı, kalan süre, ilerleme barı, araç butonları.
- Orta sol: soru metni/görseli ve seçenekler.
- Orta sağ: çözüm canvas alanı, not ekle sekmesi, soru yorumu sekmesi.
- Sağ panel: soru grid listesi, filtreler, istatistik, tamamlanma yüzdesi.
- Alt bar: önceki soru, soru sayacı, sonraki soru, sınavı bitir.

State kaynakları:
- `useExamSessionStore`: oturum, aktif soru, cevaplar, işaretler.
- `useCanvasStore`: stroke data, undo/redo stack, snapshot queue.
- `useAutosaveQueue`: online/offline kuyruk.
- `useExamRealtime`: SignalR bağlantısı.

## 3. Mobil Flutter Ekran Mimarisi

Ana ekranlar:
- `StudentExamSolvePage`
- `TeacherExamPreviewSolvePage`
- `QuestionBankSolvePage`
- `SolutionCanvasSheet`
- `QuestionListSheet`
- `QuestionFlagSheet`
- `PdfReadyPage`

Mobil layout:
- Üstte sınav adı, süre, soru numarası.
- Soru kartı, görsel, seçenekler.
- Alt navigasyon: önceki / soru listesi / sonraki.
- Araçlar: işaretle, not al, çözüm yaz, PDF indir, sınavı bitir.

Tablet/iPad layout:
- Sol: soru ve seçenekler.
- Sağ: Apple Pencil uyumlu çözüm kağıdı.
- Sağ panel: soru listesi ve durumlar.
- Canvas zoom/pan destekler.

## 4. Öğrenci Akışı

1. Öğrenci sınavı veya soru setini açar.
2. Backend `ExamSession` başlatır.
3. Sorular ve mevcut autosave kayıtları yüklenir.
4. Öğrenci cevap seçer, not alır, çizim yapar.
5. Her işlem local cache ve backend autosave kuyruğuna yazılır.
6. İnternet yoksa işlem `pendingSync` olarak tutulur.
7. Sınav bitince `CompleteExamSession` çağrılır.
8. Backend doğru/yanlış/boş/net hesaplar.
9. PDF üretim işi kuyruğa alınır.
10. PDF hazır olduğunda bildirim ve SignalR event gider.

## 5. Öğretmen Akışı

Öğretmen:
- Kendi oluşturduğu sınavı “Öğrenci Gibi Önizle” ile çözer.
- Bu oturum `IsTeacherPreview = true` olarak kaydedilir.
- Öğrenci çözümleri ekranında sınıf/sınav/öğrenci filtresi yapar.
- Öğrencinin cevabı, doğru cevap, çizimli çözümü, notu ve süre bilgisi görünür.
- Öğretmen yorum ekler.
- Öğrenci bazlı veya sınıf bazlı PDF indirir.

Öğretmen paneli:
- Sınavlarım
- Soru Bankam
- Öğrenci Çözümleri
- PDF Raporları
- Soru Bazlı Analiz
- Öğrenci Bazlı Analiz
- Sınıf Performansı
- Çözüm İnceleme Paneli

## 6. Canvas / Pencil Teknik Mimarisi

Canvas verisi iki şekilde saklanır:
- Stroke JSON: düzenlenebilir, tekrar oynatılabilir veri.
- PNG snapshot: PDF ve hızlı önizleme için görsel çıktı.

Stroke modeli:
```ts
export type CanvasTool = 'pen' | 'highlighter' | 'eraser';

export interface CanvasPoint {
  x: number;
  y: number;
  t: number;
  pressure?: number;
  pointerType?: 'mouse' | 'touch' | 'pen';
}

export interface CanvasStroke {
  id: string;
  tool: CanvasTool;
  color: string;
  width: number;
  opacity: number;
  pressure?: number;
  points: CanvasPoint[];
  createdAt: string;
}
```

Desktop:
- HTML Canvas.
- Pointer Events API.
- `pointerType` ile mouse/touch/pen ayrımı.
- `event.pressure` desteklenir.
- `canvas.toBlob('image/png')` ile snapshot alınır.

Flutter:
- `Listener` veya `GestureDetector` + `CustomPainter`.
- PointerDeviceKind.stylus ile Apple Pencil ayrımı.
- Pan/zoom için `InteractiveViewer`.
- Palm rejection için stylus aktifken touch input baskılanır.

Kağıt modları:
- Blank
- Grid
- Squared

## 7. PDF Rapor Mimarisi

PDF üretimi server-side çalışır.

Servisler:
- `IPdfReportService`
- `IExamReportRenderer`
- `IFileStorageService`
- `INotificationService`

Akış:
1. Sınav tamamlanır.
2. `PdfReport` kaydı `Queued` olur.
3. Background job PDF render eder.
4. Canvas snapshot PNG dosyaları S3 storage’dan çekilir.
5. PDF S3’e yüklenir.
6. `PdfReport.Status = Ready`.
7. SignalR `PdfReportReady` eventi yayınlanır.

PDF içeriği:
- Kurum logosu
- Öğrenci adı
- Öğretmen adı
- Sınav adı
- Ders adı
- Tarih
- Süre
- Toplam soru
- Doğru / yanlış / boş
- Net
- Başarı yüzdesi
- Soru bazlı cevap, doğru cevap, çizim, not, öğretmen yorumu, süre

## 8. Backend Entity Yapısı

Mevcut `QuestionBankItem`, `ExamSessionsController`, `ExamResult`, `IFileStorageService` korunur. Yeni kalıcı oturum ve çözüm tabloları eklenir.

```csharp
public sealed class ExamSession : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? ExamId { get; set; }
    public Guid? PlannedExamId { get; set; }
    public Guid StudentUserId { get; set; }
    public Guid? TeacherPreviewUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public bool IsTeacherPreview { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
}

public sealed class QuestionAttempt : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public Guid QuestionBankItemId { get; set; }
    public int SortOrder { get; set; }
    public string Status { get; set; } = "Unanswered";
    public bool IsFlagged { get; set; }
    public int TimeSpentSeconds { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastInteractionAtUtc { get; set; }
}

public sealed class AnswerSelection : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public int SelectedOptionIndex { get; set; } = -1;
    public string? OpenAnswer { get; set; }
    public bool IsCorrect { get; set; }
    public DateTime SavedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CanvasStroke : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public string Tool { get; set; } = "pen";
    public string Color { get; set; } = "#F97316";
    public decimal Width { get; set; }
    public decimal Opacity { get; set; } = 1;
    public string PointsJson { get; set; } = "[]";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CanvasSnapshot : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = "image/png";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class StudentNote : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class TeacherReviewComment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public Guid TeacherUserId { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class PdfReport : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public string Status { get; set; } = "Queued";
    public string? StorageKey { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadyAtUtc { get; set; }
}
```

## 9. PostgreSQL Tablo Tasarımı

Yeni tablolar:
- `Exams`
- `ExamQuestions`
- `QuestionBankItems` mevcut tablo genişletilir, tekrar üretilmez.
- `ExamSessions`
- `QuestionAttempts`
- `AnswerSelections`
- `CanvasStrokes`
- `CanvasSnapshots`
- `StudentNotes`
- `PdfReports`
- `TeacherReviewComments`
- `ReportRecipients`
- `LiveExamStates`

Önerilen indexler:
- `ExamSessions(TenantId, StudentUserId, Status)`
- `ExamSessions(TenantId, PlannedExamId)`
- `QuestionAttempts(ExamSessionId, SortOrder)`
- `QuestionAttempts(QuestionBankItemId)`
- `AnswerSelections(QuestionAttemptId)`
- `CanvasStrokes(QuestionAttemptId, CreatedAtUtc)`
- `CanvasSnapshots(QuestionAttemptId, CreatedAtUtc)`
- `PdfReports(ExamSessionId, Status)`
- `TeacherReviewComments(QuestionAttemptId, TeacherUserId)`
- `LiveExamStates(ExamSessionId)`

## 10. API Endpoint Listesi

Öğrenci / ortak:
- `POST /api/exam-sessions/start`
- `GET /api/exam-sessions/{sessionId}`
- `GET /api/exam-sessions/{sessionId}/questions/{attemptId}`
- `POST /api/exam-sessions/{sessionId}/answers`
- `POST /api/exam-sessions/{sessionId}/questions/{attemptId}/flag`
- `POST /api/exam-sessions/{sessionId}/questions/{attemptId}/notes`
- `POST /api/exam-sessions/{sessionId}/questions/{attemptId}/canvas/strokes`
- `POST /api/exam-sessions/{sessionId}/questions/{attemptId}/canvas/snapshot`
- `POST /api/exam-sessions/{sessionId}/complete`
- `POST /api/exam-sessions/{sessionId}/pdf`
- `GET /api/pdf-reports/{reportId}/download`

Öğretmen:
- `POST /api/teacher/exams/{examId}/preview-session`
- `GET /api/teacher/solutions`
- `GET /api/teacher/solutions/{sessionId}`
- `POST /api/teacher/solutions/{attemptId}/comments`
- `GET /api/teacher/pdf-reports`
- `GET /api/teacher/pdf-reports/{reportId}/download`
- `POST /api/teacher/pdf-reports/bulk-download`
- `GET /api/teacher/analytics/questions`
- `GET /api/teacher/analytics/students`
- `GET /api/teacher/analytics/classes`

## 11. SignalR Event Listesi

Hub: `ExamSolvingHub`

Gruplar:
- `session-{sessionId}`
- `student-{studentUserId}`
- `teacher-{teacherUserId}`
- `class-{className}`
- `institution-{tenantId}`

Client eventleri:
- `ExamSessionStarted`
- `ActiveQuestionChanged`
- `AnswerSaved`
- `QuestionFlagUpdated`
- `CanvasStrokeSaved`
- `CanvasSnapshotSaved`
- `StudentNoteSaved`
- `AutosaveSynced`
- `ExamTimeUpdated`
- `ExamCompleted`
- `PdfReportQueued`
- `PdfReportReady`
- `TeacherReviewAdded`
- `StudentSolutionSubmitted`

Server methods:
- `JoinExamSession(sessionId)`
- `LeaveExamSession(sessionId)`
- `PublishActiveQuestion(sessionId, attemptId)`
- `PublishHeartbeat(sessionId, remainingSeconds)`

## 12. React Component Yapısı

```text
desktop/src/features/solving/
  canvas/
    DrawingCanvas.tsx
    CanvasToolbar.tsx
    canvasTypes.ts
    usePointerCanvas.ts
    useCanvasSnapshot.ts
  components/
    ExamTopBar.tsx
    QuestionPanel.tsx
    OptionList.tsx
    QuestionNavigator.tsx
    SolutionWorkspace.tsx
    NotesPanel.tsx
    FinishExamDialog.tsx
    PdfStatusToast.tsx
  hooks/
    useExamSession.ts
    useExamRealtime.ts
    useAutosaveQueue.ts
    useOfflineSync.ts
  pages/
    ExamSolvingPage.tsx
    TeacherSolutionReviewPage.tsx
    TeacherPdfReportsPage.tsx
  services/
    examSolvingApi.ts
    pdfReportsApi.ts
  stores/
    examSessionStore.ts
  types/
    examSolvingTypes.ts
```

## 13. Flutter Folder Structure

```text
mobile/lib/features/solving/
  canvas/
    solution_canvas.dart
    solution_canvas_controller.dart
    solution_canvas_painter.dart
    stroke_model.dart
  models/
    exam_session_model.dart
    question_attempt_model.dart
    answer_model.dart
    pdf_report_model.dart
  pages/
    exam_solve_page.dart
    teacher_preview_solve_page.dart
    teacher_solution_review_page.dart
    pdf_report_page.dart
  providers/
    exam_session_provider.dart
    autosave_provider.dart
  services/
    exam_solving_api_service.dart
    exam_solving_realtime_service.dart
    offline_solution_cache.dart
  widgets/
    exam_top_card.dart
    question_card.dart
    option_button.dart
    question_list_sheet.dart
    flag_note_sheet.dart
    canvas_toolbar.dart
    pdf_generation_overlay.dart
```

## 14. Örnek React Kodları

Pointer Events tabanlı canvas hook:

```tsx
export function usePointerCanvas(onStrokeComplete: (stroke: CanvasStroke) => void) {
  const activeStroke = useRef<CanvasStroke | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    activeStroke.current = {
      id: crypto.randomUUID(),
      tool: 'pen',
      color: '#F97316',
      width: 3,
      opacity: 1,
      pressure: event.pressure || 0.5,
      points: [{ ...point, pressure: event.pressure, pointerType: event.pointerType as CanvasPoint['pointerType'] }],
      createdAt: new Date().toISOString(),
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke.current) return;
    const point = getCanvasPoint(event);
    activeStroke.current.points.push({
      ...point,
      pressure: event.pressure || activeStroke.current.pressure,
      pointerType: event.pointerType as CanvasPoint['pointerType'],
    });
  };

  const onPointerUp = () => {
    if (!activeStroke.current) return;
    onStrokeComplete(activeStroke.current);
    activeStroke.current = null;
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
```

Autosave servis örneği:

```ts
export async function saveAnswer(sessionId: string, payload: SaveAnswerRequest) {
  return api.post(`/api/exam-sessions/${sessionId}/answers`, payload);
}

export async function saveCanvasStroke(sessionId: string, attemptId: string, stroke: CanvasStroke) {
  return api.post(`/api/exam-sessions/${sessionId}/questions/${attemptId}/canvas/strokes`, stroke);
}
```

## 15. Örnek Flutter Kodları

Stroke modeli:

```dart
class SolutionStroke {
  SolutionStroke({
    required this.id,
    required this.tool,
    required this.color,
    required this.width,
    required this.opacity,
    required this.points,
    required this.createdAt,
  });

  final String id;
  final String tool;
  final Color color;
  final double width;
  final double opacity;
  final List<SolutionPoint> points;
  final DateTime createdAt;
}

class SolutionPoint {
  const SolutionPoint({
    required this.offset,
    required this.time,
    this.pressure,
    this.kind,
  });

  final Offset offset;
  final DateTime time;
  final double? pressure;
  final PointerDeviceKind? kind;
}
```

CustomPainter örneği:

```dart
class SolutionCanvasPainter extends CustomPainter {
  const SolutionCanvasPainter({required this.strokes});

  final List<SolutionStroke> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in strokes) {
      if (stroke.points.length < 2) continue;
      final paint = Paint()
        ..color = stroke.color.withValues(alpha: stroke.opacity)
        ..strokeWidth = stroke.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;

      final path = Path()..moveTo(stroke.points.first.offset.dx, stroke.points.first.offset.dy);
      for (final point in stroke.points.skip(1)) {
        path.lineTo(point.offset.dx, point.offset.dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant SolutionCanvasPainter oldDelegate) {
    return oldDelegate.strokes != strokes;
  }
}
```

## 16. PDF Generation Örnek Akışı

```csharp
public sealed class PdfReportService(
    CourseIntellectDbContext dbContext,
    IFileStorageService storage,
    INotificationService notifications) : IPdfReportService
{
    public async Task<Guid> QueueExamReportAsync(Guid sessionId, CancellationToken ct)
    {
        var report = new PdfReport
        {
            ExamSessionId = sessionId,
            Status = "Queued",
            CreatedAtUtc = DateTime.UtcNow
        };
        dbContext.Add(report);
        await dbContext.SaveChangesAsync(ct);
        return report.Id;
    }

    public async Task MarkReadyAsync(Guid reportId, string storageKey, CancellationToken ct)
    {
        var report = await dbContext.Set<PdfReport>().FindAsync([reportId], ct);
        if (report is null) return;
        report.Status = "Ready";
        report.StorageKey = storageKey;
        report.ReadyAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
    }
}
```

Background job:
- `Queued` raporları alır.
- Oturum, soru, cevap, canvas snapshot, not ve yorumları join eder.
- PDF stream üretir.
- `IFileStorageService.UploadAsync` ile S3’e yükler.
- SignalR `PdfReportReady` yayınlar.

## 17. Autosave + Offline Sync Mantığı

Client tarafı:
- Her cevap değişimi local store’a yazılır.
- 700 ms debounce ile backend’e gönderilir.
- Canvas stroke tamamlanınca anında kuyruğa girer.
- Snapshot 5-10 saniyede bir veya soru değişiminde alınır.
- Offline durumda queue IndexedDB / Flutter local storage’a yazılır.
- Reconnect olunca sırayla sync edilir.

Conflict stratejisi:
- Cevap: `clientUpdatedAt` daha yeni olan kazanır.
- Canvas: append-only stroke modeli, çakışma riski düşük.
- Not: son yazan kazanır, geçmiş opsiyonel tutulabilir.
- Sınav bitmişse yeni cevap kabul edilmez.

## 18. UI Animasyon Önerileri

Desktop:
- Soru geçişlerinde 160 ms fade/slide.
- Autosave için “Kaydediliyor / Kaydedildi / Offline” pill animasyonu.
- PDF oluşturuluyor için progress overlay.
- Canvas araç değişiminde glow.
- Sınav bitir dialogunda başarı animasyonu.

Mobil:
- Alt soru listesi bottom sheet.
- İşaretleme paneli slide-up.
- Cevap seçimi için soft scale + border glow.
- PDF hazır olduğunda success sheet.
- Kalan süre kritik seviyede ring animasyonu.

Premium dark tasarım tokenları:
- Arka plan: `#07101C`
- Kart: `rgba(15, 23, 42, 0.78)`
- Border: `rgba(148, 163, 184, 0.18)`
- Primary orange: `#F97316`
- Purple accent: `#8B5CF6`
- Success: `#22C55E`
- Text primary: `#F8FAFC`
- Text secondary: `#94A3B8`

