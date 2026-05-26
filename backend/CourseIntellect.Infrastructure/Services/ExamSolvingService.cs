using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using CourseIntellect.Application.DTOs.ExamSolving;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class ExamSolvingService(
    CourseIntellectDbContext dbContext,
    IFileStorageService fileStorageService,
    IExamSolvingRealtimeNotifier realtimeNotifier,
    INotificationService notificationService) : IExamSolvingService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<SolutionSessionResponse> StartAsync(StartSolutionSessionRequest request, CancellationToken cancellationToken)
    {
        var questionsQuery = dbContext.QuestionBankItems.AsQueryable();
        if (request.QuestionIds is { Count: > 0 })
        {
            var ids = request.QuestionIds.ToHashSet();
            questionsQuery = questionsQuery.Where(item => ids.Contains(item.Id));
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(request.Subject))
            {
                questionsQuery = questionsQuery.Where(item => item.Subject == request.Subject);
            }

            questionsQuery = questionsQuery
                .OrderByDescending(item => item.UsageCount)
                .ThenBy(item => item.Topic)
                .Take(Math.Clamp(request.QuestionCount, 1, 80));
        }

        var questions = await questionsQuery.AsNoTracking().ToListAsync(cancellationToken);
        if (request.QuestionIds is { Count: > 0 })
        {
            var order = request.QuestionIds
                .Select((id, index) => new { id, index })
                .ToDictionary(item => item.id, item => item.index);
            questions = questions.OrderBy(item => order.GetValueOrDefault(item.Id, int.MaxValue)).ToList();
        }
        if (questions.Count == 0)
        {
            throw new InvalidOperationException("Çözüm oturumu için uygun soru bulunamadı.");
        }

        var session = new ExamSession
        {
            PlannedExamId = request.PlannedExamId,
            StudentName = string.IsNullOrWhiteSpace(request.StudentName) ? request.StudentUsername : request.StudentName.Trim(),
            StudentUsername = request.StudentUsername.Trim(),
            ClassName = request.ClassName?.Trim() ?? string.Empty,
            Title = string.IsNullOrWhiteSpace(request.Title) ? "Soru Çözme Oturumu" : request.Title.Trim(),
            Subject = string.IsNullOrWhiteSpace(request.Subject) ? questions.First().Subject : request.Subject.Trim(),
            DurationSeconds = request.DurationSeconds <= 0 ? 3600 : request.DurationSeconds,
            IsTeacherPreview = request.IsTeacherPreview,
            Status = "Active",
            StartedAtUtc = DateTime.UtcNow,
        };

        await dbContext.ExamSessions.AddAsync(session, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        var attempts = questions.Select((question, index) => new QuestionAttempt
        {
            ExamSessionId = session.Id,
            QuestionBankItemId = question.Id,
            SortOrder = index,
            Status = "Unanswered",
            CreatedAtUtc = DateTime.UtcNow,
        }).ToList();

        await dbContext.QuestionAttempts.AddRangeAsync(attempts, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetAsync(session.Id, cancellationToken))!;
    }

    public async Task<SolutionSessionResponse?> GetAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await dbContext.ExamSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == sessionId, cancellationToken);
        if (session is null) return null;

        var attempts = await dbContext.QuestionAttempts
            .AsNoTracking()
            .Where(item => item.ExamSessionId == sessionId)
            .OrderBy(item => item.SortOrder)
            .ToListAsync(cancellationToken);

        var attemptIds = attempts.Select(item => item.Id).ToList();
        var questionIds = attempts.Select(item => item.QuestionBankItemId).ToList();
        var questions = await dbContext.QuestionBankItems
            .AsNoTracking()
            .Where(item => questionIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);
        var answers = await dbContext.AnswerSelections
            .AsNoTracking()
            .Where(item => attemptIds.Contains(item.QuestionAttemptId))
            .GroupBy(item => item.QuestionAttemptId)
            .Select(group => group.OrderByDescending(item => item.SavedAtUtc).First())
            .ToDictionaryAsync(item => item.QuestionAttemptId, cancellationToken);
        var notes = await dbContext.StudentNotes
            .AsNoTracking()
            .Where(item => attemptIds.Contains(item.QuestionAttemptId))
            .ToDictionaryAsync(item => item.QuestionAttemptId, cancellationToken);
        var snapshots = await dbContext.CanvasSnapshots
            .AsNoTracking()
            .Where(item => attemptIds.Contains(item.QuestionAttemptId))
            .GroupBy(item => item.QuestionAttemptId)
            .Select(group => group.OrderByDescending(item => item.CreatedAtUtc).First())
            .ToDictionaryAsync(item => item.QuestionAttemptId, cancellationToken);
        var reviews = await dbContext.TeacherReviewComments
            .AsNoTracking()
            .Where(item => attemptIds.Contains(item.QuestionAttemptId))
            .OrderBy(item => item.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var report = await dbContext.PdfReports
            .AsNoTracking()
            .Where(item => item.ExamSessionId == sessionId)
            .OrderByDescending(item => item.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var revealAnswers = session.Status == "Completed" || session.IsTeacherPreview;
        var questionResponses = attempts
            .Where(attempt => questions.ContainsKey(attempt.QuestionBankItemId))
            .Select(attempt =>
            {
                var question = questions[attempt.QuestionBankItemId];
                answers.TryGetValue(attempt.Id, out var answer);
                notes.TryGetValue(attempt.Id, out var note);
                snapshots.TryGetValue(attempt.Id, out var snapshot);
                return new SolutionQuestionResponse(
                    attempt.Id,
                    question.Id,
                    attempt.SortOrder,
                    question.Subject,
                    question.Topic,
                    question.Difficulty,
                    question.Type,
                    question.QuestionText,
                    question.ImagePath,
                    question.ImagePlacement,
                    DeserializeList(question.OptionsSerialized),
                    revealAnswers ? question.CorrectOptionIndex : null,
                    revealAnswers ? question.ExpectedAnswer : null,
                    attempt.Status,
                    attempt.IsFlagged,
                    attempt.FlagType,
                    attempt.TimeSpentSeconds,
                    answer is null ? null : new AnswerSelectionResponse(answer.Id, answer.SelectedOptionIndex, answer.OpenAnswer, answer.IsCorrect, answer.SavedAtUtc),
                    note?.Note,
                    snapshot?.StorageKey,
                    reviews.Where(item => item.QuestionAttemptId == attempt.Id)
                        .Select(item => new TeacherReviewResponse(item.Id, item.TeacherName, item.Comment, item.CreatedAtUtc))
                        .ToList());
            })
            .ToList();

        return new SolutionSessionResponse(
            session.Id,
            session.Title,
            session.Subject,
            session.StudentName,
            session.StudentUsername,
            session.ClassName,
            session.DurationSeconds,
            session.IsTeacherPreview,
            session.Status,
            session.StartedAtUtc,
            session.CompletedAtUtc,
            questionResponses,
            report is null ? null : MapReport(report));
    }

    public async Task<SolutionSessionResponse> SaveAnswerAsync(Guid sessionId, SaveSolutionAnswerRequest request, CancellationToken cancellationToken)
    {
        var (session, attempt, question) = await ResolveWritableAttempt(sessionId, request.QuestionAttemptId, cancellationToken);
        var openAnswer = request.OpenAnswer?.Trim();
        var hasOptionAnswer = request.SelectedOptionIndex >= 0;
        var hasOpenAnswer = !string.IsNullOrWhiteSpace(openAnswer);
        var isCorrect = hasOptionAnswer
            ? question.CorrectOptionIndex == request.SelectedOptionIndex
            : hasOpenAnswer && !string.IsNullOrWhiteSpace(question.ExpectedAnswer) && AnswersEqual(openAnswer!, question.ExpectedAnswer!);
        var answer = new AnswerSelection
        {
            QuestionAttemptId = attempt.Id,
            SelectedOptionIndex = request.SelectedOptionIndex,
            OpenAnswer = openAnswer,
            IsCorrect = isCorrect,
            SavedAtUtc = DateTime.UtcNow,
        };
        attempt.Status = !hasOptionAnswer && !hasOpenAnswer ? "Empty" : isCorrect ? "Correct" : "Answered";
        attempt.TimeSpentSeconds = Math.Max(attempt.TimeSpentSeconds, request.TimeSpentSeconds);
        attempt.LastInteractionAtUtc = DateTime.UtcNow;

        await dbContext.AnswerSelections.AddAsync(answer, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await realtimeNotifier.NotifyAnswerSavedAsync(session.Id, attempt.Id, cancellationToken);
        return (await GetAsync(sessionId, cancellationToken))!;
    }

    public async Task<SolutionSessionResponse> SaveFlagAsync(Guid sessionId, SaveQuestionFlagRequest request, CancellationToken cancellationToken)
    {
        var (_, attempt, _) = await ResolveWritableAttempt(sessionId, request.QuestionAttemptId, cancellationToken);
        attempt.IsFlagged = request.IsFlagged;
        attempt.FlagType = request.FlagType?.Trim() ?? string.Empty;
        attempt.LastInteractionAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return (await GetAsync(sessionId, cancellationToken))!;
    }

    public async Task<SolutionSessionResponse> SaveNoteAsync(Guid sessionId, SaveStudentNoteRequest request, CancellationToken cancellationToken)
    {
        var (_, attempt, _) = await ResolveWritableAttempt(sessionId, request.QuestionAttemptId, cancellationToken);
        var note = await dbContext.StudentNotes.FirstOrDefaultAsync(item => item.QuestionAttemptId == attempt.Id, cancellationToken);
        if (note is null)
        {
            note = new StudentNote { QuestionAttemptId = attempt.Id };
            await dbContext.StudentNotes.AddAsync(note, cancellationToken);
        }

        note.Note = request.Note.Trim();
        note.UpdatedAtUtc = DateTime.UtcNow;
        attempt.LastInteractionAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return (await GetAsync(sessionId, cancellationToken))!;
    }

    public async Task SaveStrokeAsync(Guid sessionId, SaveCanvasStrokeRequest request, CancellationToken cancellationToken)
    {
        var (session, attempt, _) = await ResolveWritableAttempt(sessionId, request.QuestionAttemptId, cancellationToken);
        await dbContext.CanvasStrokes.AddAsync(new CanvasStroke
        {
            QuestionAttemptId = attempt.Id,
            Tool = string.IsNullOrWhiteSpace(request.Tool) ? "pen" : request.Tool.Trim(),
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#F97316" : request.Color.Trim(),
            Width = request.Width <= 0 ? 3 : request.Width,
            Opacity = request.Opacity <= 0 ? 1 : request.Opacity,
            Pressure = request.Pressure,
            PointsJson = string.IsNullOrWhiteSpace(request.PointsJson) ? "[]" : request.PointsJson,
            CreatedAtUtc = DateTime.UtcNow,
        }, cancellationToken);
        attempt.LastInteractionAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await realtimeNotifier.NotifyCanvasSavedAsync(session.Id, attempt.Id, cancellationToken);
    }

    public async Task<CanvasSnapshotSavedResult> SaveSnapshotAsync(Guid sessionId, SaveCanvasSnapshotRequest request, string baseUrl, CancellationToken cancellationToken)
    {
        var (_, attempt, _) = await ResolveWritableAttempt(sessionId, request.QuestionAttemptId, cancellationToken);
        var bytes = DecodeDataUrl(request.DataUrl);
        await using var stream = new MemoryStream(bytes);
        var upload = await fileStorageService.SaveAsync(stream, $"solution-{attempt.Id}.png", "image/png", "solution-canvas", baseUrl, cancellationToken);
        var snapshot = new CanvasSnapshot
        {
            QuestionAttemptId = attempt.Id,
            StorageKey = upload.FileUrl,
            ContentType = upload.ContentType,
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.CanvasSnapshots.AddAsync(snapshot, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new CanvasSnapshotSavedResult(snapshot.Id, snapshot.StorageKey);
    }

    public async Task<SolutionSummaryResponse> CompleteAsync(Guid sessionId, string baseUrl, CancellationToken cancellationToken)
    {
        var session = await dbContext.ExamSessions.FirstOrDefaultAsync(item => item.Id == sessionId, cancellationToken)
            ?? throw new InvalidOperationException("Oturum bulunamadı.");
        session.Status = "Completed";
        session.CompletedAtUtc ??= DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var response = await GetAsync(sessionId, cancellationToken) ?? throw new InvalidOperationException("Oturum bulunamadı.");
        var total = response.Questions.Count;
        var correct = response.Questions.Count(item => item.Answer?.IsCorrect == true);
        var answered = response.Questions.Count(item => item.Answer is not null
            && (item.Answer.SelectedOptionIndex >= 0 || !string.IsNullOrWhiteSpace(item.Answer.OpenAnswer)));
        var empty = Math.Max(0, total - answered);
        var wrong = Math.Max(0, answered - correct);
        var net = correct - wrong / 4m;
        var percent = total == 0 ? 0 : (int)Math.Round((decimal)correct / total * 100, MidpointRounding.AwayFromZero);
        var report = await QueuePdfAsync(sessionId, baseUrl, cancellationToken);
        await realtimeNotifier.NotifyExamCompletedAsync(sessionId, cancellationToken);
        return new SolutionSummaryResponse(sessionId, total, correct, wrong, empty, net, percent, report);
    }

    public async Task<PdfReportResponse> QueuePdfAsync(Guid sessionId, string baseUrl, CancellationToken cancellationToken)
    {
        var existing = await dbContext.PdfReports
            .Where(item => item.ExamSessionId == sessionId && item.Status == "Ready")
            .OrderByDescending(item => item.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null) return MapReport(existing);

        var report = new PdfReport
        {
            ExamSessionId = sessionId,
            Status = "Queued",
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.PdfReports.AddAsync(report, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await realtimeNotifier.NotifyPdfQueuedAsync(sessionId, report.Id, cancellationToken);

        try
        {
            var session = await GetAsync(sessionId, cancellationToken) ?? throw new InvalidOperationException("Oturum bulunamadı.");
            var snapshotImages = await LoadSnapshotImagesAsync(session, cancellationToken);
            var bytes = BuildBrandedPdf(session, snapshotImages);
            await using var stream = new MemoryStream(bytes);
            var upload = await fileStorageService.SaveAsync(stream, $"cozum-raporu-{session.Id}.pdf", "application/pdf", "solution-reports", baseUrl, cancellationToken);
            report.Status = "Ready";
            report.StorageKey = upload.FileUrl;
            report.ReadyAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            await notificationService.CreateNotificationAsync(
                new("PDF raporu hazır", $"{session.Title} çözüm raporunuz hazır.", "Şimdi", session.StudentUsername, "Student", "ExamReport"),
                cancellationToken);
            await realtimeNotifier.NotifyPdfReadyAsync(sessionId, report.Id, report.StorageKey!, cancellationToken);
        }
        catch (Exception error)
        {
            report.Status = "Failed";
            report.ErrorMessage = error.Message;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapReport(report);
    }

    public async Task<IReadOnlyList<PdfReportResponse>> GetTeacherReportsAsync(CancellationToken cancellationToken)
    {
        return await dbContext.PdfReports
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAtUtc)
            .Take(250)
            .Select(item => MapReport(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<SolutionSessionResponse> AddTeacherReviewAsync(Guid sessionId, AddTeacherReviewRequest request, string teacherName, Guid? teacherUserId, CancellationToken cancellationToken)
    {
        var (session, attempt, _) = await ResolveAttempt(sessionId, request.QuestionAttemptId, cancellationToken);
        await dbContext.TeacherReviewComments.AddAsync(new TeacherReviewComment
        {
            QuestionAttemptId = attempt.Id,
            TeacherUserId = teacherUserId,
            TeacherName = string.IsNullOrWhiteSpace(teacherName) ? "Öğretmen" : teacherName,
            Comment = request.Comment.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await realtimeNotifier.NotifyTeacherReviewAddedAsync(session.Id, attempt.Id, cancellationToken);
        return (await GetAsync(sessionId, cancellationToken))!;
    }

    private async Task<(ExamSession Session, QuestionAttempt Attempt, QuestionBankItem Question)> ResolveWritableAttempt(Guid sessionId, Guid attemptId, CancellationToken cancellationToken)
    {
        var result = await ResolveAttempt(sessionId, attemptId, cancellationToken);
        if (result.Session.Status == "Completed")
        {
            throw new InvalidOperationException("Tamamlanan sınavda değişiklik yapılamaz.");
        }

        return result;
    }

    private async Task<(ExamSession Session, QuestionAttempt Attempt, QuestionBankItem Question)> ResolveAttempt(Guid sessionId, Guid attemptId, CancellationToken cancellationToken)
    {
        var session = await dbContext.ExamSessions.FirstOrDefaultAsync(item => item.Id == sessionId, cancellationToken)
            ?? throw new InvalidOperationException("Oturum bulunamadı.");
        var attempt = await dbContext.QuestionAttempts.FirstOrDefaultAsync(item => item.Id == attemptId && item.ExamSessionId == sessionId, cancellationToken)
            ?? throw new InvalidOperationException("Soru oturumu bulunamadı.");
        var question = await dbContext.QuestionBankItems.AsNoTracking().FirstOrDefaultAsync(item => item.Id == attempt.QuestionBankItemId, cancellationToken)
            ?? throw new InvalidOperationException("Soru bulunamadı.");
        return (session, attempt, question);
    }

    private static List<string> DeserializeList(string value)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(value, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static byte[] DecodeDataUrl(string dataUrl)
    {
        var commaIndex = dataUrl.IndexOf(',');
        var raw = commaIndex >= 0 ? dataUrl[(commaIndex + 1)..] : dataUrl;
        return Convert.FromBase64String(raw);
    }

    private static PdfReportResponse MapReport(PdfReport report)
    {
        return new PdfReportResponse(report.Id, report.ExamSessionId, report.Status, report.StorageKey, report.ErrorMessage, report.CreatedAtUtc, report.ReadyAtUtc);
    }

    private static bool AnswersEqual(string submitted, string expected)
    {
        return string.Equals(submitted.Trim(), expected.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private async Task<IReadOnlyDictionary<Guid, byte[]>> LoadSnapshotImagesAsync(SolutionSessionResponse session, CancellationToken cancellationToken)
    {
        var images = new Dictionary<Guid, byte[]>();
        foreach (var question in session.Questions.Where(item => !string.IsNullOrWhiteSpace(item.SnapshotUrl)))
        {
            var bytes = await fileStorageService.ReadBytesAsync(question.SnapshotUrl!, cancellationToken);
            if (bytes is { Length: > 0 })
            {
                images[question.AttemptId] = bytes;
            }
        }

        return images;
    }

    private static byte[] BuildBrandedPdf(SolutionSessionResponse session, IReadOnlyDictionary<Guid, byte[]> snapshotImages)
    {
        var total = session.Questions.Count;
        var correct = session.Questions.Count(item => item.Answer?.IsCorrect == true);
        var answered = session.Questions.Count(item => item.Answer is not null
            && (item.Answer.SelectedOptionIndex >= 0 || !string.IsNullOrWhiteSpace(item.Answer.OpenAnswer)));
        var empty = total - answered;
        var wrong = answered - correct;
        var net = correct - (wrong * 0.25m);
        var success = total == 0 ? 0 : (int)Math.Round((decimal)correct / total * 100m);
        var duration = TimeSpan.FromSeconds(session.DurationSeconds);

        var document = new BrandedPdfDocument();
        var page = document.AddPage();
        DrawReportHeader(page, "Çözüm Raporu", "CourseIntellect");

        page.SetText(36, 690, 22, "DEMO", PdfColor.DeepBlue, bold: true);
        page.SetText(36, 668, 10, $"Oluşturma Tarihi: {DateTime.UtcNow:dd.MM.yyyy HH:mm}", PdfColor.DeepBlue);

        page.SetText(36, 612, 10, "Öğrenci", PdfColor.DeepBlue);
        page.SetText(198, 612, 10, EmptyDash(session.StudentName), PdfColor.DeepBlue, bold: true);
        page.SetText(36, 582, 10, "Sınav", PdfColor.DeepBlue);
        page.SetText(198, 582, 10, EmptyDash(session.Title), PdfColor.DeepBlue, bold: true);
        page.SetText(36, 552, 10, "Ders", PdfColor.DeepBlue);
        page.SetText(198, 552, 10, EmptyDash(session.Subject), PdfColor.DeepBlue, bold: true);
        page.SetText(36, 522, 10, "Sınıf", PdfColor.DeepBlue);
        page.SetText(198, 522, 10, EmptyDash(session.ClassName), PdfColor.DeepBlue, bold: true);

        page.FillRoundedCard(36, 430, 524, 64, PdfColor.LightCard);
        page.SetText(54, 472, 10, "Başarı Özeti", PdfColor.DeepBlue);
        page.SetText(54, 446, 20, $"%{success}", PdfColor.DeepBlue, bold: true);
        page.SetText(145, 462, 10, $"Toplam Soru: {total}", PdfColor.DeepBlue);
        page.SetText(145, 440, 10, $"Doğru: {correct}   Yanlış: {wrong}   Boş: {empty}", PdfColor.DeepBlue);
        page.SetText(360, 462, 10, $"Net: {net:0.##}", PdfColor.DeepBlue, bold: true);
        page.SetText(360, 440, 10, $"Süre: {duration.TotalMinutes:0} dk", PdfColor.DeepBlue);

        page.FillRoundedCard(36, 338, 524, 70, PdfColor.WarningCard);
        page.SetText(54, 384, 10, "Rapor Notu", PdfColor.Brown, bold: true);
        page.SetText(54, 364, 9, "Öğrencinin cevapları, soru notları, öğretmen yorumları ve çizimli çözüm kayıtları bu raporda özetlenir.", PdfColor.Brown);
        page.SetText(54, 348, 9, "Çizimli çözümler, ilgili soru detaylarının altında görsel olarak rapora eklenir.", PdfColor.Brown);

        page.SetText(36, 295, 10, $"Rapor Türü: {(session.IsTeacherPreview ? "Öğretmen Önizleme/Test Çözümü" : "Öğrenci Çözümü")}", PdfColor.DeepBlue);
        page.SetText(36, 55, 8, "CourseIntellect • Eğitim Yönetim Platformu", PdfColor.DeepBlue, bold: true);

        var questionPage = document.AddPage();
        DrawReportHeader(questionPage, "Soru Bazlı Analiz", session.Title);
        var y = 690d;

        foreach (var question in session.Questions.OrderBy(item => item.SortOrder))
        {
            if (y < 180)
            {
                questionPage.SetText(36, 55, 8, "CourseIntellect • Eğitim Yönetim Platformu", PdfColor.DeepBlue, bold: true);
                questionPage = document.AddPage();
                DrawReportHeader(questionPage, "Soru Bazlı Analiz", session.Title);
                y = 690;
            }

            var hasAnswer = question.Answer is not null
                && (question.Answer.SelectedOptionIndex >= 0 || !string.IsNullOrWhiteSpace(question.Answer.OpenAnswer));
            var answerLabel = !hasAnswer
                ? "Boş"
                : question.Answer!.SelectedOptionIndex >= 0
                    ? OptionLabel(question.Answer!.SelectedOptionIndex)
                    : EmptyDash(question.Answer!.OpenAnswer);
            var correctLabel = question.CorrectOptionIndex.HasValue
                ? OptionLabel(question.CorrectOptionIndex.Value)
                : EmptyDash(question.ExpectedAnswer);
            var statusColor = !hasAnswer ? PdfColor.GrayText : question.Answer!.IsCorrect ? PdfColor.Green : PdfColor.Red;
            var statusText = !hasAnswer ? "Boş" : question.Answer!.IsCorrect ? "Doğru" : "Yanlış";

            questionPage.FillRoundedCard(36, y - 18, 524, 30, PdfColor.DarkCard);
            questionPage.SetText(52, y - 2, 11, $"Soru {question.SortOrder + 1}", PdfColor.White, bold: true);
            questionPage.SetText(120, y - 2, 9, $"{question.Subject} / {question.Topic} / {question.Difficulty}", PdfColor.SoftText);
            questionPage.SetText(474, y - 2, 10, statusText, statusColor, bold: true);
            y -= 48;

            foreach (var line in Wrap(question.QuestionText, 88).Take(5))
            {
                questionPage.SetText(52, y, 9, line, PdfColor.DeepBlue);
                y -= 15;
            }

            y -= 8;
            questionPage.FillRoundedCard(52, y - 14, 230, 28, PdfColor.LightCard);
            questionPage.SetText(64, y + 2, 9, $"Öğrenci Cevabı: {answerLabel}", PdfColor.DeepBlue, bold: true);
            questionPage.FillRoundedCard(300, y - 14, 230, 28, PdfColor.LightCard);
            questionPage.SetText(312, y + 2, 9, $"Doğru Cevap: {correctLabel}", PdfColor.DeepBlue, bold: true);
            y -= 42;

            if (!string.IsNullOrWhiteSpace(question.Note))
            {
                questionPage.SetText(52, y, 9, "Öğrenci Notu", PdfColor.Orange, bold: true);
                y -= 15;
                foreach (var line in Wrap(question.Note, 92).Take(3))
                {
                    questionPage.SetText(52, y, 8, line, PdfColor.DeepBlue);
                    y -= 13;
                }
                y -= 5;
            }

            if (!string.IsNullOrWhiteSpace(question.SnapshotUrl))
            {
                if (snapshotImages.TryGetValue(question.AttemptId, out var imageBytes)
                    && document.TryAddPngImage(imageBytes, out var solutionImage))
                {
                    var imageWidth = 454d;
                    var imageHeight = Math.Min(235d, imageWidth * solutionImage.Height / solutionImage.Width);
                    if (y - imageHeight < 95)
                    {
                        questionPage.SetText(36, 55, 8, "CourseIntellect • Eğitim Yönetim Platformu", PdfColor.DeepBlue, bold: true);
                        questionPage = document.AddPage();
                        DrawReportHeader(questionPage, $"Soru {question.SortOrder + 1} - Çizimli Çözüm", session.Title);
                        y = 690;
                    }

                    questionPage.SetText(52, y, 9, "Öğrencinin Çizimli Çözümü", PdfColor.Green, bold: true);
                    y -= 18;
                    questionPage.FillRoundedCard(52, y - imageHeight - 12, 478, imageHeight + 24, PdfColor.LightCard);
                    questionPage.DrawImage(solutionImage, 64, y - imageHeight, imageWidth, imageHeight);
                    y -= imageHeight + 25;
                }
                else
                {
                    questionPage.SetText(52, y, 8, "Çizimli çözüm görseli rapora yüklenemedi.", PdfColor.GrayText, bold: true);
                    y -= 16;
                }
            }

            foreach (var review in question.TeacherReviews.Take(2))
            {
                questionPage.SetText(52, y, 9, $"Öğretmen Yorumu ({review.TeacherName})", PdfColor.Purple, bold: true);
                y -= 15;
                foreach (var line in Wrap(review.Comment, 92).Take(3))
                {
                    questionPage.SetText(52, y, 8, line, PdfColor.DeepBlue);
                    y -= 13;
                }
            }

            y -= 24;
        }

        questionPage.SetText(36, 55, 8, "CourseIntellect • Eğitim Yönetim Platformu", PdfColor.DeepBlue, bold: true);
        return document.Build();
    }

    private static void DrawReportHeader(PdfPageCanvas page, string title, string subtitle)
    {
        page.FillRect(0, 732, 595, 110, PdfColor.Header);
        page.FillRect(48, 775, 24, 24, PdfColor.Orange);
        page.SetText(82, 800, 20, "CourseIntellect", PdfColor.White, bold: true);
        page.SetText(82, 774, 10, title, PdfColor.White);
        page.SetText(36, 715, 8, subtitle, PdfColor.DeepBlue);
    }

    private static string OptionLabel(int index)
    {
        return index < 0 ? "-" : ((char)('A' + index)).ToString();
    }

    private static string EmptyDash(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? "-" : value.Trim();
    }

    private static IEnumerable<string> Wrap(string? value, int maxCharacters)
    {
        var words = (value ?? string.Empty).ReplaceLineEndings(" ").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var line = new StringBuilder();
        foreach (var word in words)
        {
            if (line.Length > 0 && line.Length + word.Length + 1 > maxCharacters)
            {
                yield return line.ToString();
                line.Clear();
            }

            if (line.Length > 0) line.Append(' ');
            line.Append(word);
        }

        if (line.Length > 0) yield return line.ToString();
    }

    private sealed class BrandedPdfDocument
    {
        private readonly List<PdfPageCanvas> pages = [];
        private readonly List<PdfImage> images = [];

        public PdfPageCanvas AddPage()
        {
            var page = new PdfPageCanvas();
            pages.Add(page);
            page.FillRect(0, 0, 595, 842, PdfColor.Black);
            return page;
        }

        public bool TryAddPngImage(byte[] bytes, out PdfImage image)
        {
            if (!PngImageDecoder.TryDecode(bytes, out var decoded))
            {
                image = null!;
                return false;
            }

            image = new PdfImage($"Im{images.Count + 1}", decoded.Width, decoded.Height, Compress(decoded.RgbBytes));
            images.Add(image);
            return true;
        }

        public byte[] Build()
        {
            var imageObjectStart = 5 + (pages.Count * 2);
            var imageResources = string.Join(
                ' ',
                images.Select((image, index) => $"/{image.Name} {imageObjectStart + index} 0 R"));
            var objects = new List<string>
            {
                "<< /Type /Catalog /Pages 2 0 R >>",
                $"<< /Type /Pages /Kids [{string.Join(' ', Enumerable.Range(0, pages.Count).Select(index => $"{5 + (index * 2)} 0 R"))}] /Count {pages.Count} >>",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
            };

            foreach (var (page, index) in pages.Select((page, index) => (page, index)))
            {
                var pageObjectNumber = 5 + (index * 2);
                var contentObjectNumber = pageObjectNumber + 1;
                var content = page.Content;
                var xObjects = images.Count == 0 ? string.Empty : $" /XObject << {imageResources} >>";
                objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>{xObjects} >> /Contents {contentObjectNumber} 0 R >>");
                objects.Add($"<< /Length {Encoding.UTF8.GetByteCount(content)} >>\nstream\n{content}\nendstream");
            }

            foreach (var image in images)
            {
                var hexData = Convert.ToHexString(image.CompressedRgbBytes) + ">";
                objects.Add($"<< /Type /XObject /Subtype /Image /Width {image.Width} /Height {image.Height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length {hexData.Length} >>\nstream\n{hexData}\nendstream");
            }

            var pdf = new StringBuilder("%PDF-1.4\n");
            var offsets = new List<int> { 0 };
            foreach (var (obj, index) in objects.Select((obj, index) => (obj, index)))
            {
                offsets.Add(Encoding.UTF8.GetByteCount(pdf.ToString()));
                pdf.Append(index + 1).Append(" 0 obj\n").Append(obj).Append("\nendobj\n");
            }

            var xrefOffset = Encoding.UTF8.GetByteCount(pdf.ToString());
            pdf.Append("xref\n0 ").Append(objects.Count + 1).Append("\n0000000000 65535 f \n");
            foreach (var offset in offsets.Skip(1))
            {
                pdf.Append(offset.ToString("D10")).Append(" 00000 n \n");
            }

            pdf.Append("trailer\n<< /Size ")
                .Append(objects.Count + 1)
                .Append(" /Root 1 0 R >>\nstartxref\n")
                .Append(xrefOffset)
                .Append("\n%%EOF");
            return Encoding.UTF8.GetBytes(pdf.ToString());
        }

        private static byte[] Compress(byte[] value)
        {
            using var target = new MemoryStream();
            using (var compression = new ZLibStream(target, CompressionLevel.SmallestSize, leaveOpen: true))
            {
                compression.Write(value, 0, value.Length);
            }

            return target.ToArray();
        }
    }

    private sealed class PdfPageCanvas
    {
        private readonly StringBuilder content = new();

        public string Content => content.ToString();

        public void FillRect(double x, double y, double width, double height, PdfColor color)
        {
            content.AppendLine($"q {color.Fill} {Fmt(x)} {Fmt(y)} {Fmt(width)} {Fmt(height)} re f Q");
        }

        public void FillRoundedCard(double x, double y, double width, double height, PdfColor color)
        {
            FillRect(x, y, width, height, color);
        }

        public void SetText(double x, double y, double size, string text, PdfColor color, bool bold = false)
        {
            var font = bold ? "F2" : "F1";
            content.AppendLine($"BT /{font} {Fmt(size)} Tf {color.Fill} {Fmt(x)} {Fmt(y)} Td <{ToUtf16Hex(text)}> Tj ET");
        }

        public void DrawImage(PdfImage image, double x, double y, double width, double height)
        {
            content.AppendLine($"q {Fmt(width)} 0 0 {Fmt(height)} {Fmt(x)} {Fmt(y)} cm /{image.Name} Do Q");
        }

        private static string Fmt(double value)
        {
            return value.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
        }

        private static string ToUtf16Hex(string value)
        {
            var bytes = Encoding.BigEndianUnicode.GetBytes(value ?? string.Empty);
            var builder = new StringBuilder("FEFF");
            foreach (var item in bytes)
            {
                builder.Append(item.ToString("X2"));
            }
            return builder.ToString();
        }
    }

    private sealed record PdfImage(string Name, int Width, int Height, byte[] CompressedRgbBytes);

    private sealed record DecodedPng(int Width, int Height, byte[] RgbBytes);

    private static class PngImageDecoder
    {
        private static readonly byte[] Signature = [137, 80, 78, 71, 13, 10, 26, 10];

        public static bool TryDecode(byte[] value, out DecodedPng image)
        {
            image = null!;
            if (value.Length < Signature.Length || !value.AsSpan(0, Signature.Length).SequenceEqual(Signature))
            {
                return false;
            }

            var width = 0;
            var height = 0;
            byte bitDepth = 0;
            byte colorType = 0;
            byte interlace = 0;
            using var idat = new MemoryStream();

            var offset = Signature.Length;
            while (offset + 12 <= value.Length)
            {
                var length = BinaryPrimitives.ReadInt32BigEndian(value.AsSpan(offset, 4));
                offset += 4;
                if (length < 0 || offset + 8 + length > value.Length) return false;
                var type = Encoding.ASCII.GetString(value, offset, 4);
                offset += 4;
                var chunk = value.AsSpan(offset, length);
                offset += length + 4;

                if (type == "IHDR" && length >= 13)
                {
                    width = BinaryPrimitives.ReadInt32BigEndian(chunk[..4]);
                    height = BinaryPrimitives.ReadInt32BigEndian(chunk.Slice(4, 4));
                    bitDepth = chunk[8];
                    colorType = chunk[9];
                    interlace = chunk[12];
                }
                else if (type == "IDAT")
                {
                    idat.Write(chunk);
                }
                else if (type == "IEND")
                {
                    break;
                }
            }

            var channels = colorType switch
            {
                0 => 1,
                2 => 3,
                4 => 2,
                6 => 4,
                _ => 0,
            };
            if (width <= 0 || height <= 0 || channels == 0 || bitDepth != 8 || interlace != 0
                || (long)width * height > 24_000_000)
            {
                return false;
            }

            var rowLength = width * channels;
            byte[] filtered;
            try
            {
                idat.Position = 0;
                using var inflater = new ZLibStream(idat, CompressionMode.Decompress);
                using var raw = new MemoryStream();
                inflater.CopyTo(raw);
                filtered = raw.ToArray();
            }
            catch
            {
                return false;
            }

            if (filtered.Length < (rowLength + 1) * height) return false;
            var pixels = new byte[rowLength * height];
            var previous = new byte[rowLength];
            var current = new byte[rowLength];
            var sourceOffset = 0;
            for (var row = 0; row < height; row++)
            {
                var filter = filtered[sourceOffset++];
                for (var index = 0; index < rowLength; index++)
                {
                    var rawValue = filtered[sourceOffset++];
                    var left = index >= channels ? current[index - channels] : (byte)0;
                    var up = previous[index];
                    var upperLeft = index >= channels ? previous[index - channels] : (byte)0;
                    current[index] = filter switch
                    {
                        0 => rawValue,
                        1 => unchecked((byte)(rawValue + left)),
                        2 => unchecked((byte)(rawValue + up)),
                        3 => unchecked((byte)(rawValue + ((left + up) / 2))),
                        4 => unchecked((byte)(rawValue + Paeth(left, up, upperLeft))),
                        _ => (byte)0,
                    };
                }

                if (filter > 4) return false;
                current.CopyTo(pixels, row * rowLength);
                (previous, current) = (current, previous);
            }

            var rgb = new byte[width * height * 3];
            var target = 0;
            for (var source = 0; source < pixels.Length; source += channels, target += 3)
            {
                var red = channels is 1 or 2 ? pixels[source] : pixels[source];
                var green = channels is 1 or 2 ? pixels[source] : pixels[source + 1];
                var blue = channels is 1 or 2 ? pixels[source] : pixels[source + 2];
                var alpha = colorType switch
                {
                    4 => pixels[source + 1],
                    6 => pixels[source + 3],
                    _ => (byte)255,
                };
                rgb[target] = BlendOnWhite(red, alpha);
                rgb[target + 1] = BlendOnWhite(green, alpha);
                rgb[target + 2] = BlendOnWhite(blue, alpha);
            }

            image = new DecodedPng(width, height, rgb);
            return true;
        }

        private static byte BlendOnWhite(byte channel, byte alpha)
        {
            return (byte)((channel * alpha + 255 * (255 - alpha)) / 255);
        }

        private static byte Paeth(byte left, byte up, byte upperLeft)
        {
            var prediction = left + up - upperLeft;
            var distanceLeft = Math.Abs(prediction - left);
            var distanceUp = Math.Abs(prediction - up);
            var distanceUpperLeft = Math.Abs(prediction - upperLeft);
            return distanceLeft <= distanceUp && distanceLeft <= distanceUpperLeft
                ? left
                : distanceUp <= distanceUpperLeft ? up : upperLeft;
        }
    }

    private readonly record struct PdfColor(double R, double G, double B)
    {
        public string Fill => $"{R:0.###} {G:0.###} {B:0.###} rg";

        public static readonly PdfColor Header = new(0.055, 0.086, 0.145);
        public static readonly PdfColor Black = new(0, 0, 0);
        public static readonly PdfColor White = new(1, 1, 1);
        public static readonly PdfColor LightCard = new(0.965, 0.98, 0.99);
        public static readonly PdfColor WarningCard = new(1, 0.94, 0.68);
        public static readonly PdfColor DarkCard = new(0.06, 0.1, 0.17);
        public static readonly PdfColor DeepBlue = new(0.04, 0.11, 0.24);
        public static readonly PdfColor SoftText = new(0.76, 0.81, 0.9);
        public static readonly PdfColor Orange = new(0.9, 0.42, 0.04);
        public static readonly PdfColor Brown = new(0.45, 0.18, 0.02);
        public static readonly PdfColor Green = new(0.05, 0.65, 0.36);
        public static readonly PdfColor Red = new(0.88, 0.18, 0.24);
        public static readonly PdfColor Purple = new(0.45, 0.25, 0.9);
        public static readonly PdfColor GrayText = new(0.42, 0.48, 0.58);
    }
}
