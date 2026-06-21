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
        if (existing is not null && !string.IsNullOrWhiteSpace(existing.StorageKey)) return MapReport(existing);

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
            var upload = await SaveServerPdfAsync(session, baseUrl, cancellationToken);
            report.StorageKey = upload.FileUrl;
            report.Status = "Ready";
            report.ReadyAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            await notificationService.CreateNotificationAsync(
                new("Sınav kağıdın hazır", $"{session.Title} sınav kağıdını görüntüleyip indirebilirsin.", "Şimdi", session.StudentUsername, "Student", "ExamReport"),
                cancellationToken);
            await realtimeNotifier.NotifyPdfReadyAsync(sessionId, report.Id, report.StorageKey ?? string.Empty, cancellationToken);
        }
        catch (Exception error)
        {
            report.Status = "Failed";
            report.ErrorMessage = error.Message;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapReport(report);
    }

    public async Task<PdfReportResponse> GenerateExamPaperPdfAsync(SolutionSessionResponse session, string baseUrl, CancellationToken cancellationToken)
    {
        // Planlı sınav (snapshot) oturumları için markalı "Sınav Kağıdı" PDF'i üretir
        // ve öğretmenin PDF rapor merkezine düşürür.
        var existing = await dbContext.PdfReports
            .Where(item => item.ExamSessionId == session.Id && item.Status == "Ready")
            .OrderByDescending(item => item.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null && !string.IsNullOrWhiteSpace(existing.StorageKey)) return MapReport(existing);

        var report = new PdfReport
        {
            ExamSessionId = session.Id,
            Status = "Queued",
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.PdfReports.AddAsync(report, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            var upload = await SaveServerPdfAsync(session, baseUrl, cancellationToken);
            report.StorageKey = upload.FileUrl;
            report.Status = "Ready";
            report.ReadyAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception error)
        {
            report.Status = "Failed";
            report.ErrorMessage = error.Message;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapReport(report);
    }

    public async Task<IReadOnlyList<TeacherExamPaperReportResponse>> GetTeacherReportsAsync(CancellationToken cancellationToken)
    {
        var reports = await dbContext.PdfReports
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAtUtc)
            .Take(250)
            .ToListAsync(cancellationToken);
        var sessionIds = reports.Select(item => item.ExamSessionId).ToHashSet();

        // Öğrenci adı / sınıf / başlık için oturuma; puan için soru-cevaplara bağlan.
        // Öğretmen önizlemeleri (IsTeacherPreview) listelenmez.
        var sessions = await dbContext.ExamSessions.AsNoTracking()
            .Where(item => sessionIds.Contains(item.Id) && !item.IsTeacherPreview)
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var attempts = await dbContext.QuestionAttempts.AsNoTracking()
            .Where(item => sessionIds.Contains(item.ExamSessionId))
            .Select(item => new { item.Id, item.ExamSessionId })
            .ToListAsync(cancellationToken);
        var attemptIds = attempts.Select(item => item.Id).ToHashSet();
        var correctAttemptIds = (await dbContext.AnswerSelections.AsNoTracking()
            .Where(item => attemptIds.Contains(item.QuestionAttemptId) && item.IsCorrect)
            .Select(item => item.QuestionAttemptId)
            .ToListAsync(cancellationToken)).ToHashSet();

        var totalBySession = attempts.GroupBy(item => item.ExamSessionId).ToDictionary(group => group.Key, group => group.Count());
        var correctBySession = attempts.Where(item => correctAttemptIds.Contains(item.Id))
            .GroupBy(item => item.ExamSessionId).ToDictionary(group => group.Key, group => group.Count());

        var result = new List<TeacherExamPaperReportResponse>();
        foreach (var report in reports)
        {
            if (!sessions.TryGetValue(report.ExamSessionId, out var session)) continue;
            var total = totalBySession.GetValueOrDefault(report.ExamSessionId);
            var correct = correctBySession.GetValueOrDefault(report.ExamSessionId);
            var score = total == 0 ? 0 : (int)Math.Round((double)correct / total * 100, MidpointRounding.AwayFromZero);
            result.Add(new TeacherExamPaperReportResponse(
                report.Id, report.ExamSessionId, report.Status, report.StorageKey, report.CreatedAtUtc, report.ReadyAtUtc,
                session.StudentName, session.ClassName, session.Title, session.Subject,
                total, correct, score, session.CompletedAtUtc));
        }

        return result;
    }

    public async Task<IReadOnlyList<StudentExamPaperResponse>> GetStudentPapersAsync(string studentUsername, string studentName, CancellationToken cancellationToken)
    {
        var normalizedUsername = (studentUsername ?? string.Empty).Trim();
        var normalizedName = (studentName ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalizedUsername) && string.IsNullOrWhiteSpace(normalizedName))
        {
            return [];
        }

        var sessions = await dbContext.ExamSessions
            .AsNoTracking()
            .Where(item =>
                !item.IsTeacherPreview &&
                ((normalizedUsername != string.Empty && item.StudentUsername == normalizedUsername) ||
                    (normalizedName != string.Empty && item.StudentName == normalizedName)))
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0)
        {
            return [];
        }

        var sessionIds = sessions.Select(item => item.Id).ToHashSet();
        var reports = (await dbContext.PdfReports
                .AsNoTracking()
                .Where(item => sessionIds.Contains(item.ExamSessionId))
                .ToListAsync(cancellationToken))
            .GroupBy(item => item.ExamSessionId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.CreatedAtUtc).First());

        return sessions
            .Select(session =>
            {
                reports.TryGetValue(session.Id, out var report);
                return new StudentExamPaperResponse(
                    session.Id,
                    report?.Id ?? Guid.Empty,
                    session.Title,
                    session.Subject,
                    session.ClassName,
                    report?.Status ?? (session.Status == "Completed" ? "Queued" : session.Status),
                    report?.StorageKey,
                    session.CompletedAtUtc,
                    report?.ReadyAtUtc);
            })
            .OrderByDescending(item => item.CompletedAtUtc ?? DateTime.MinValue)
            .ToList();
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

    private async Task<CourseIntellect.Application.DTOs.Contents.UploadedAssetDto> SaveServerPdfAsync(
        SolutionSessionResponse session,
        string baseUrl,
        CancellationToken cancellationToken)
    {
        var total = session.Questions.Count;
        var correct = session.Questions.Count(item => item.Answer?.IsCorrect == true);
        var answered = session.Questions.Count(item => item.Answer is not null
            && (item.Answer.SelectedOptionIndex >= 0 || !string.IsNullOrWhiteSpace(item.Answer.OpenAnswer)));
        var wrong = Math.Max(0, answered - correct);
        var empty = Math.Max(0, total - answered);
        var net = decimal.Round(correct - wrong / 4m, 2);
        var score = total == 0 ? 0 : (int)Math.Round((decimal)correct / total * 100, MidpointRounding.AwayFromZero);

        var lines = new List<string>
        {
            "CourseIntellect Sinav Raporu",
            $"Sinav: {session.Title}",
            $"Ogrenci: {session.StudentName}",
            $"Sinif: {session.ClassName}",
            $"Ders: {session.Subject}",
            $"Tamamlanma: {(session.CompletedAtUtc ?? DateTime.UtcNow):dd.MM.yyyy HH:mm}",
            $"Puan (%): {score}",
            $"Net: {net:0.##}",
            $"Dogru: {correct}  Yanlis: {wrong}  Bos: {empty}  Toplam: {total}",
            string.Empty,
            "Soru ozeti"
        };
        lines.AddRange(session.Questions
            .OrderBy(item => item.SortOrder)
            .Select(item =>
            {
                var status = item.Answer is null ? "Bos" : item.Answer.IsCorrect ? "Dogru" : "Yanlis";
                return $"{item.SortOrder + 1}. {item.Subject} / {item.Topic} - {status}";
            })
            .Take(42));

        var bytes = BuildSinglePagePdf(lines);
        await using var stream = new MemoryStream(bytes);
        return await fileStorageService.SaveAsync(
            stream,
            $"exam-report-{session.Id:N}.pdf",
            "application/pdf",
            "exam-reports",
            baseUrl,
            cancellationToken);
    }

    private static byte[] BuildSinglePagePdf(IReadOnlyList<string> lines)
    {
        static string Clean(string value)
        {
            var text = value
                .Replace("ı", "i").Replace("İ", "I")
                .Replace("ğ", "g").Replace("Ğ", "G")
                .Replace("ü", "u").Replace("Ü", "U")
                .Replace("ş", "s").Replace("Ş", "S")
                .Replace("ö", "o").Replace("Ö", "O")
                .Replace("ç", "c").Replace("Ç", "C");
            return text.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
        }

        var content = new StringBuilder();
        content.AppendLine("BT");
        content.AppendLine("/F1 18 Tf");
        content.AppendLine("50 790 Td");
        content.AppendLine($"({Clean(lines.FirstOrDefault() ?? "CourseIntellect Sinav Raporu")}) Tj");
        content.AppendLine("/F1 11 Tf");
        content.AppendLine("0 -28 Td");
        foreach (var line in lines.Skip(1))
        {
            content.AppendLine($"({Clean(line)}) Tj");
            content.AppendLine("0 -17 Td");
        }
        content.AppendLine("ET");
        var contentBytes = Encoding.ASCII.GetBytes(content.ToString());

        var objects = new List<byte[]>
        {
            Encoding.ASCII.GetBytes("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
            Encoding.ASCII.GetBytes("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
            Encoding.ASCII.GetBytes("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"),
            Encoding.ASCII.GetBytes("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"),
            Encoding.ASCII.GetBytes($"5 0 obj\n<< /Length {contentBytes.Length} >>\nstream\n{content}endstream\nendobj\n")
        };

        using var ms = new MemoryStream();
        void Write(string value)
        {
            var bytes = Encoding.ASCII.GetBytes(value);
            ms.Write(bytes, 0, bytes.Length);
        }

        Write("%PDF-1.4\n");
        var offsets = new List<long> { 0 };
        foreach (var obj in objects)
        {
            offsets.Add(ms.Position);
            ms.Write(obj, 0, obj.Length);
        }
        var xref = ms.Position;
        Write($"xref\n0 {objects.Count + 1}\n");
        Write("0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1))
        {
            Write($"{offset:0000000000} 00000 n \n");
        }
        Write($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return ms.ToArray();
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

}
