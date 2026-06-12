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

    public async Task<PdfReportResponse> GenerateExamPaperPdfAsync(SolutionSessionResponse session, string baseUrl, CancellationToken cancellationToken)
    {
        // Planlı sınav (snapshot) oturumları için markalı "Sınav Kağıdı" PDF'i üretir
        // ve öğretmenin PDF rapor merkezine düşürür.
        var existing = await dbContext.PdfReports
            .Where(item => item.ExamSessionId == session.Id && item.Status == "Ready")
            .OrderByDescending(item => item.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null) return MapReport(existing);

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
            var bytes = BuildBrandedPdf(session, new Dictionary<Guid, byte[]>());
            await using var stream = new MemoryStream(bytes);
            var upload = await fileStorageService.SaveAsync(stream, $"sinav-kagidi-{session.Id}.pdf", "application/pdf", "solution-reports", baseUrl, cancellationToken);
            report.Status = "Ready";
            report.StorageKey = upload.FileUrl;
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
        var success = total == 0 ? 0 : (int)Math.Round((decimal)correct / total * 100m);
        var duration = TimeSpan.FromSeconds(session.DurationSeconds);
        var finishedAt = session.CompletedAtUtc ?? DateTime.UtcNow;
        var verificationCode = $"CI-EXAM-{finishedAt:yyyy}-{session.Id.ToString("N")[..8].ToUpperInvariant()}";
        var verificationUrl = $"https://courseintellect.com/verify/{verificationCode}";
        var securityEvents = session.Questions.Count(item => item.IsFlagged);
        var securityScore = Math.Clamp(100 - (securityEvents * 10), 70, 100);

        var document = new BrandedPdfDocument();
        var page = AddExamPage(document, "SINAV KAĞIDI", "Aşağıda öğrencinin sınavda verdiği cevaplar yer almaktadır.");

        DrawStudentCard(page, session, success, duration, finishedAt);
        DrawSummaryCard(page, total, correct, wrong, empty, success);
        DrawSecurityCard(page, securityEvents, securityScore);
        page.SetText(52, 328, 12, "SORULAR", PdfColor.DeepBlue, bold: true);
        page.DrawLine(52, 318, 543, 318, PdfColor.Border);

        var regularQuestions = session.Questions
            .Where(item => item.Options.Count > 0)
            .OrderBy(item => item.SortOrder)
            .ToList();
        var openQuestions = session.Questions
            .Where(item => item.Options.Count == 0)
            .OrderBy(item => item.SortOrder)
            .ToList();

        var questionPage = page;
        var leftY = 296d;
        var rightY = 296d;

        foreach (var question in regularQuestions)
        {
            var height = EstimateQuestionCardHeight(question, 34);
            var useLeft = leftY >= rightY;
            var x = useLeft ? 52d : 306d;
            var y = useLeft ? leftY : rightY;
            if (y - height < 86)
            {
                questionPage = AddExamPage(document, "SINAV KAĞIDI", session.Title);
                questionPage.SetText(52, 708, 12, "SORULAR", PdfColor.DeepBlue, bold: true);
                questionPage.DrawLine(52, 698, 543, 698, PdfColor.Border);
                leftY = 676;
                rightY = 676;
                useLeft = true;
                x = 52;
                y = leftY;
            }

            DrawQuestionCard(questionPage, question, x, y, 238, height, compact: true);
            if (useLeft) leftY = y - height - 12;
            else rightY = y - height - 12;
        }

        var singleY = Math.Min(leftY, rightY);
        if (openQuestions.Count > 0)
        {
            if (singleY < 210)
            {
                questionPage = AddExamPage(document, "SINAV KAĞIDI", session.Title);
                singleY = 708;
            }
            questionPage.SetText(52, singleY, 12, "AÇIK UÇLU SORULAR", PdfColor.DeepBlue, bold: true);
            singleY -= 22;
            foreach (var question in openQuestions)
            {
                var height = EstimateOpenQuestionHeight(question);
                if (singleY - height < 96)
                {
                    questionPage = AddExamPage(document, "SINAV KAĞIDI", session.Title);
                    questionPage.SetText(52, 708, 12, "AÇIK UÇLU SORULAR", PdfColor.DeepBlue, bold: true);
                    singleY = 680;
                }
                DrawQuestionCard(questionPage, question, 52, singleY, 490, height, compact: false);
                singleY -= height + 14;
            }
        }

        var finalY = Math.Min(singleY, Math.Min(leftY, rightY));
        if (finalY < 250)
        {
            questionPage = AddExamPage(document, "SINAV KAĞIDI", session.Title);
            finalY = 708;
        }
        DrawTeacherNotes(questionPage, finalY);
        DrawVerificationBlock(questionPage, verificationCode, verificationUrl);

        foreach (var question in session.Questions.OrderBy(item => item.SortOrder))
        {
            if (!string.IsNullOrWhiteSpace(question.Note))
            {
                // Notes are already represented in the answer cards; drawn snapshots remain as appendices.
            }

            if (!string.IsNullOrWhiteSpace(question.SnapshotUrl))
            {
                if (snapshotImages.TryGetValue(question.AttemptId, out var imageBytes)
                    && document.TryAddPngImage(imageBytes, out var solutionImage))
                {
                    var snapshotPage = AddExamPage(document, $"Soru {question.SortOrder + 1}", "Öğrencinin çizimli çözümü");
                    var imageWidth = 454d;
                    var imageHeight = Math.Min(235d, imageWidth * solutionImage.Height / solutionImage.Width);
                    snapshotPage.FillRoundedCard(52, 398, 490, imageHeight + 28, PdfColor.LightCard);
                    snapshotPage.DrawImage(solutionImage, 70, 412, imageWidth, imageHeight);
                }
            }

            foreach (var review in question.TeacherReviews.Take(2))
            {
                var reviewPage = AddExamPage(document, $"Soru {question.SortOrder + 1}", "Öğretmen değerlendirmesi");
                reviewPage.FillRoundedCard(52, 520, 490, 96, PdfColor.LightPurple);
                reviewPage.SetText(70, 590, 10, $"Öğretmen Yorumu ({review.TeacherName})", PdfColor.Purple, bold: true);
                var reviewY = 568d;
                foreach (var line in Wrap(review.Comment, 82).Take(5))
                {
                    reviewPage.SetText(70, reviewY, 9, line, PdfColor.DeepBlue);
                    reviewY -= 15;
                }
            }
        }

        document.DrawFooters(verificationCode);
        return document.Build();
    }

    private static PdfPageCanvas AddExamPage(BrandedPdfDocument document, string title, string subtitle)
    {
        var page = document.AddPage();
        DrawExamHeader(page, title, subtitle);
        return page;
    }

    private static void DrawExamHeader(PdfPageCanvas page, string title, string subtitle)
    {
        page.FillRect(0, 796, 595, 46, PdfColor.LightPurple);
        page.FillRect(372, 796, 223, 46, PdfColor.Purple);
        page.FillCircle(54, 773, 17, PdfColor.LightPurple);
        page.SetText(80, 786, 18, "CourseIntellect", PdfColor.DeepBlue, bold: true);
        page.SetText(80, 768, 8, "Akıllı Sorular, Güçlü Yarınlar", PdfColor.DeepBlue);
        page.SetText(234, 705, 27, title, PdfColor.DeepBlue, bold: true);
        page.DrawLine(247, 686, 348, 686, PdfColor.Purple);
        page.FillCircle(360, 686, 3, PdfColor.Purple);
        page.SetText(154, 662, 9, subtitle, PdfColor.GrayText);
        page.FillRoundedCard(518, 748, 38, 38, PdfColor.White);
        page.StrokeRect(518, 748, 38, 38, PdfColor.LightPurple);
        page.SetText(527, 762, 10, "PDF", PdfColor.Purple, bold: true);
    }

    private static void DrawStudentCard(PdfPageCanvas page, SolutionSessionResponse session, int score, TimeSpan duration, DateTime finishedAt)
    {
        page.FillRoundedCard(52, 520, 490, 116, PdfColor.White);
        page.StrokeRect(52, 520, 490, 116, PdfColor.LightPurple);
        var items = new[]
        {
            ("ÖĞRENCİ ADI SOYADI", EmptyDash(session.StudentName)),
            ("ÖĞRENCİ NUMARASI", EmptyDash(session.StudentUsername)),
            ("SINIF / ŞUBE", EmptyDash(session.ClassName)),
            ("SINAV ADI", EmptyDash(session.Title)),
            ("DERS", EmptyDash(session.Subject)),
            ("ÖĞRETMEN", session.IsTeacherPreview ? "Öğretmen Önizleme" : "CourseIntellect"),
            ("SINAV TARİHİ", session.StartedAtUtc.ToLocalTime().ToString("dd.MM.yyyy")),
            ("BAŞLAMA", session.StartedAtUtc.ToLocalTime().ToString("HH:mm")),
            ("BİTİŞ", finishedAt.ToLocalTime().ToString("HH:mm")),
            ("SÜRE", $"{duration.TotalMinutes:0} dk"),
        };

        var x = 72d;
        var y = 598d;
        foreach (var entry in items.Take(8).Select((item, index) => (item, index)))
        {
            var col = entry.index % 4;
            var row = entry.index / 4;
            page.SetText(x + (col * 94), y - (row * 46), 6.5, entry.item.Item1, PdfColor.Purple, bold: true);
            foreach (var line in Wrap(entry.item.Item2, 17).Take(2).Select((line, idx) => (line, idx)))
            {
                page.SetText(x + (col * 94), y - 15 - (row * 46) - (line.idx * 10), 8, line.line, PdfColor.DeepBlue, bold: line.idx == 0);
            }
        }

        page.SetText(72, 536, 6.5, items[8].Item1, PdfColor.Purple, bold: true);
        page.SetText(72, 522, 8, items[8].Item2, PdfColor.DeepBlue, bold: true);
        page.SetText(166, 536, 6.5, items[9].Item1, PdfColor.Purple, bold: true);
        page.SetText(166, 522, 8, items[9].Item2, PdfColor.DeepBlue, bold: true);

        page.SetText(443, 603, 7, "ALDIĞI PUAN", PdfColor.Purple, bold: true);
        page.StrokeCircle(471, 566, 29, PdfColor.LightPurple);
        page.SetText(457, 558, 24, score.ToString(), PdfColor.Purple, bold: true);
        page.SetText(443, 530, 8, "100 üzerinden", PdfColor.DeepBlue);
    }

    private static void DrawSummaryCard(PdfPageCanvas page, int total, int correct, int wrong, int empty, int success)
    {
        page.FillRoundedCard(52, 442, 490, 50, PdfColor.LightPurple);
        page.FillCircle(76, 467, 10, PdfColor.Purple);
        page.SetText(73, 463, 9, "i", PdfColor.White, bold: true);
        page.SetText(96, 464, 9, $"Bu sınavda {total} soru yer almaktadır.", PdfColor.DeepBlue);
        page.SetText(306, 464, 9, $"Doğru: {correct}", PdfColor.DeepBlue, bold: true);
        page.SetText(376, 464, 9, $"Yanlış: {wrong}", PdfColor.DeepBlue, bold: true);
        page.SetText(448, 464, 9, $"Boş: {empty}", PdfColor.DeepBlue, bold: true);
        page.SetText(506, 464, 9, $"%{success}", PdfColor.Purple, bold: true);
    }

    private static void DrawSecurityCard(PdfPageCanvas page, int eventCount, int securityScore)
    {
        page.FillRoundedCard(52, 354, 490, 64, PdfColor.White);
        page.StrokeRect(52, 354, 490, 64, PdfColor.Border);
        page.SetText(70, 397, 10, "GÜVENLİK RAPORU", PdfColor.DeepBlue, bold: true);
        page.SetText(70, 376, 8, "Kamera Durumu: ✓ Aktif", PdfColor.DeepBlue);
        page.SetText(190, 376, 8, "Yoklama Durumu: ✓ Katıldı", PdfColor.DeepBlue);
        page.SetText(330, 376, 8, "Tam Ekran İhlali: 0", PdfColor.DeepBlue);
        page.SetText(70, 361, 8, $"Sekme Değiştirme: {eventCount}", PdfColor.DeepBlue);
        page.SetText(190, 361, 8, "Kopyala Yapıştır: 0", PdfColor.DeepBlue);
        page.SetText(330, 361, 8, "Bağlantı Kopması: 0", PdfColor.DeepBlue);
        page.FillRoundedCard(435, 388, 82, 20, securityScore >= 90 ? PdfColor.Green : PdfColor.Orange);
        page.SetText(448, 394, 8, $"{securityScore} / 100", PdfColor.White, bold: true);
    }

    private static int EstimateQuestionCardHeight(SolutionQuestionResponse question, int wrapAt)
    {
        var textLines = Wrap(question.QuestionText, wrapAt).Take(4).Count();
        var optionLines = Math.Min(5, question.Options.Count);
        var wrongExtra = IsWrong(question) ? 20 : 0;
        return 62 + (textLines * 12) + (optionLines * 15) + wrongExtra;
    }

    private static int EstimateOpenQuestionHeight(SolutionQuestionResponse question)
    {
        var textLines = Wrap(question.QuestionText, 78).Take(5).Count();
        var answerLines = Wrap(question.Answer?.OpenAnswer, 82).Take(6).Count();
        return 82 + (textLines * 12) + Math.Max(2, answerLines) * 13;
    }

    private static void DrawQuestionCard(PdfPageCanvas page, SolutionQuestionResponse question, double x, double topY, double width, double height, bool compact)
    {
        var hasAnswer = HasAnswer(question);
        var statusText = !hasAnswer ? "○ Boş" : question.Answer!.IsCorrect ? "✓ Doğru" : "✗ Yanlış";
        var statusColor = !hasAnswer ? PdfColor.GrayText : question.Answer!.IsCorrect ? PdfColor.Green : PdfColor.Red;
        var bottomY = topY - height;

        page.FillRoundedCard(x, bottomY, width, height, PdfColor.White);
        page.StrokeRect(x, bottomY, width, height, PdfColor.Border);
        page.SetText(x + 10, topY - 17, 11, $"{question.SortOrder + 1}.", PdfColor.Purple, bold: true);
        page.SetText(x + width - 56, topY - 16, 8, statusText, statusColor, bold: true);

        var textY = topY - 34;
        foreach (var line in Wrap(question.QuestionText, compact ? 34 : 78).Take(compact ? 4 : 5))
        {
            page.SetText(x + 30, textY, 8, line, PdfColor.DeepBlue, bold: textY == topY - 34);
            textY -= 12;
        }

        if (question.Options.Count > 0)
        {
            textY -= 4;
            foreach (var (option, index) in question.Options.Take(5).Select((option, index) => (option, index)))
            {
                var isSelected = question.Answer?.SelectedOptionIndex == index;
                var isCorrect = question.CorrectOptionIndex == index;
                var marker = isSelected ? (isCorrect ? "✓" : "✗") : " ";
                page.SetText(x + 30, textY, 8, $"{marker} {OptionLabel(index)}) {option}", isSelected ? statusColor : PdfColor.DeepBlue);
                textY -= 15;
            }
        }
        else
        {
            textY -= 4;
            page.FillRoundedCard(x + 28, textY - 48, width - 56, 48, PdfColor.LightCard);
            page.SetText(x + 40, textY - 14, 8, "Öğrenci Cevabı", PdfColor.Purple, bold: true);
            var answerY = textY - 29;
            foreach (var line in Wrap(question.Answer?.OpenAnswer ?? "Boş bırakıldı", compact ? 34 : 82).Take(4))
            {
                page.SetText(x + 40, answerY, 8, line, PdfColor.DeepBlue);
                answerY -= 12;
            }
            textY -= 58;
        }

        var answerLabel = !hasAnswer
            ? "Boş"
            : question.Answer!.SelectedOptionIndex >= 0
                ? OptionLabel(question.Answer!.SelectedOptionIndex)
                : "Metin";
        var correctLabel = question.CorrectOptionIndex.HasValue
            ? OptionLabel(question.CorrectOptionIndex.Value)
            : EmptyDash(question.ExpectedAnswer);

        page.SetText(x + 10, bottomY + 24, 7.5, $"Öğrenci Cevabı: {answerLabel}", PdfColor.DeepBlue, bold: true);
        page.SetText(x + 10, bottomY + 11, 7.5, $"Doğru Cevap: {correctLabel}", PdfColor.DeepBlue);
        if (IsWrong(question))
        {
            page.FillRoundedCard(x + width - 92, bottomY + 10, 78, 18, PdfColor.LightRed);
            page.SetText(x + width - 82, bottomY + 16, 7.5, $"Doğru Cevap: {correctLabel}", PdfColor.Red, bold: true);
        }
    }

    private static void DrawTeacherNotes(PdfPageCanvas page, double topY)
    {
        page.SetText(52, topY, 12, "ÖĞRETMEN DEĞERLENDİRME ALANI", PdfColor.DeepBlue, bold: true);
        page.FillRoundedCard(52, topY - 118, 302, 96, PdfColor.White);
        page.StrokeRect(52, topY - 118, 302, 96, PdfColor.Border);
        page.SetText(70, topY - 44, 10, "Öğretmen Notları", PdfColor.Purple, bold: true);
        for (var index = 0; index < 4; index++)
        {
            var lineY = topY - 62 - (index * 15);
            page.DrawLine(70, lineY, 330, lineY, PdfColor.Border);
        }
    }

    private static void DrawVerificationBlock(PdfPageCanvas page, string verificationCode, string verificationUrl)
    {
        page.SetText(378, 214, 10, "PDF DOĞRULAMA", PdfColor.DeepBlue, bold: true);
        page.SetText(378, 196, 7.5, verificationCode, PdfColor.Purple, bold: true);
        DrawQrMatrix(page, BuildQrMatrix(verificationUrl), 390, 92, 3);
        page.SetText(382, 76, 7, "QR kod sınav doğrulama ekranına gider.", PdfColor.GrayText);
    }

    private static bool HasAnswer(SolutionQuestionResponse question)
    {
        return question.Answer is not null
            && (question.Answer.SelectedOptionIndex >= 0 || !string.IsNullOrWhiteSpace(question.Answer.OpenAnswer));
    }

    private static bool IsWrong(SolutionQuestionResponse question)
    {
        return HasAnswer(question) && question.Answer?.IsCorrect != true;
    }

    private static bool[,] BuildQrMatrix(string value)
    {
        const int version = 4;
        const int size = 33;
        const int dataCodewords = 80;
        const int ecCodewords = 20;
        var modules = new bool[size, size];
        var isFunction = new bool[size, size];

        void SetFunction(int row, int col, bool dark)
        {
            if (row < 0 || row >= size || col < 0 || col >= size) return;
            modules[row, col] = dark;
            isFunction[row, col] = true;
        }

        void DrawFinder(int row, int col)
        {
            for (var dy = -1; dy <= 7; dy++)
            {
                for (var dx = -1; dx <= 7; dx++)
                {
                    var rr = row + dy;
                    var cc = col + dx;
                    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
                    var dark = dy is >= 0 and <= 6 && dx is >= 0 and <= 6
                        && (dy == 0 || dy == 6 || dx == 0 || dx == 6 || (dy is >= 2 and <= 4 && dx is >= 2 and <= 4));
                    SetFunction(rr, cc, dark);
                }
            }
        }

        DrawFinder(0, 0);
        DrawFinder(0, size - 7);
        DrawFinder(size - 7, 0);

        for (var i = 8; i < size - 8; i++)
        {
            SetFunction(6, i, i % 2 == 0);
            SetFunction(i, 6, i % 2 == 0);
        }

        for (var dy = -2; dy <= 2; dy++)
        {
            for (var dx = -2; dx <= 2; dx++)
            {
                var distance = Math.Max(Math.Abs(dx), Math.Abs(dy));
                SetFunction(26 + dy, 26 + dx, distance == 2 || distance == 0);
            }
        }

        for (var i = 0; i <= 8; i++)
        {
            if (i != 6)
            {
                SetFunction(8, i, false);
                SetFunction(i, 8, false);
            }
        }
        for (var i = 0; i < 8; i++)
        {
            SetFunction(8, size - 1 - i, false);
            SetFunction(size - 1 - i, 8, false);
        }
        SetFunction(4 * version + 9, 8, true);

        var codewords = BuildQrCodewords(value, dataCodewords, ecCodewords);
        var bitIndex = 0;
        var upward = true;
        for (var right = size - 1; right >= 1; right -= 2)
        {
            if (right == 6) right--;
            for (var vert = 0; vert < size; vert++)
            {
                var row = upward ? size - 1 - vert : vert;
                for (var j = 0; j < 2; j++)
                {
                    var col = right - j;
                    if (isFunction[row, col]) continue;
                    var dark = bitIndex < codewords.Count && codewords[bitIndex++];
                    if ((row + col) % 2 == 0) dark = !dark;
                    modules[row, col] = dark;
                }
            }
            upward = !upward;
        }

        var format = GetQrFormatBits(0);
        for (var i = 0; i <= 5; i++) SetFunction(8, i, GetBit(format, i));
        SetFunction(8, 7, GetBit(format, 6));
        SetFunction(8, 8, GetBit(format, 7));
        SetFunction(7, 8, GetBit(format, 8));
        for (var i = 9; i < 15; i++) SetFunction(14 - i, 8, GetBit(format, i));
        for (var i = 0; i < 8; i++) SetFunction(size - 1 - i, 8, GetBit(format, i));
        for (var i = 8; i < 15; i++) SetFunction(8, size - 15 + i, GetBit(format, i));
        SetFunction(4 * version + 9, 8, true);

        return modules;
    }

    private static List<bool> BuildQrCodewords(string value, int dataCodewords, int ecCodewords)
    {
        var payload = Encoding.UTF8.GetBytes(value);
        var bits = new List<bool>();
        AppendBits(bits, 0b0100, 4);
        AppendBits(bits, payload.Length, 8);
        foreach (var item in payload) AppendBits(bits, item, 8);
        var capacity = dataCodewords * 8;
        var terminator = Math.Min(4, capacity - bits.Count);
        for (var i = 0; i < terminator; i++) bits.Add(false);
        while (bits.Count % 8 != 0) bits.Add(false);

        var data = new List<byte>();
        for (var i = 0; i < bits.Count; i += 8)
        {
            var valueByte = 0;
            for (var j = 0; j < 8; j++) valueByte = (valueByte << 1) | (bits[i + j] ? 1 : 0);
            data.Add((byte)valueByte);
        }
        for (var pad = 0; data.Count < dataCodewords; pad++)
        {
            data.Add((byte)(pad % 2 == 0 ? 0xEC : 0x11));
        }

        var divisor = ReedSolomonComputeDivisor(ecCodewords);
        var remainder = ReedSolomonComputeRemainder(data.ToArray(), divisor);
        data.AddRange(remainder);

        var result = new List<bool>();
        foreach (var item in data) AppendBits(result, item, 8);
        return result;
    }

    private static void AppendBits(List<bool> target, int value, int length)
    {
        for (var index = length - 1; index >= 0; index--)
        {
            target.Add(((value >> index) & 1) != 0);
        }
    }

    private static int GetQrFormatBits(int mask)
    {
        var data = (1 << 3) | mask; // Error correction level L.
        var remainder = data;
        for (var i = 0; i < 10; i++)
        {
            remainder = (remainder << 1) ^ (((remainder >> 9) & 1) == 0 ? 0 : 0x537);
        }
        return ((data << 10) | remainder) ^ 0x5412;
    }

    private static bool GetBit(int value, int index)
    {
        return ((value >> index) & 1) != 0;
    }

    private static byte[] ReedSolomonComputeDivisor(int degree)
    {
        var result = new byte[degree];
        result[degree - 1] = 1;
        byte root = 1;
        for (var i = 0; i < degree; i++)
        {
            for (var j = 0; j < degree; j++)
            {
                result[j] = GaloisMultiply(result[j], root);
                if (j + 1 < degree) result[j] ^= result[j + 1];
            }
            root = GaloisMultiply(root, 2);
        }
        return result;
    }

    private static byte[] ReedSolomonComputeRemainder(byte[] data, byte[] divisor)
    {
        var result = new byte[divisor.Length];
        foreach (var item in data)
        {
            var factor = (byte)(item ^ result[0]);
            Array.Copy(result, 1, result, 0, result.Length - 1);
            result[^1] = 0;
            for (var i = 0; i < result.Length; i++)
            {
                result[i] ^= GaloisMultiply(divisor[i], factor);
            }
        }
        return result;
    }

    private static byte GaloisMultiply(int x, int y)
    {
        var z = 0;
        for (var i = 7; i >= 0; i--)
        {
            z = (z << 1) ^ (((z >> 7) & 1) * 0x11D);
            if (((y >> i) & 1) != 0) z ^= x;
        }
        return (byte)z;
    }

    private static void DrawQrMatrix(PdfPageCanvas page, bool[,] matrix, double x, double y, double moduleSize)
    {
        var size = matrix.GetLength(0);
        page.FillRect(x - (moduleSize * 4), y - (moduleSize * 4), moduleSize * (size + 8), moduleSize * (size + 8), PdfColor.White);
        for (var row = 0; row < size; row++)
        {
            for (var col = 0; col < size; col++)
            {
                if (matrix[row, col])
                {
                    page.FillRect(x + (col * moduleSize), y + ((size - 1 - row) * moduleSize), moduleSize, moduleSize, PdfColor.DeepBlue);
                }
            }
        }
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
            page.FillRect(0, 0, 595, 842, PdfColor.White);
            return page;
        }

        public void DrawFooters(string verificationCode)
        {
            var total = pages.Count;
            for (var index = 0; index < total; index++)
            {
                var page = pages[index];
                page.DrawLine(148, 45, 448, 45, PdfColor.LightPurple);
                page.SetText(52, 34, 8, "CourseIntellect", PdfColor.DeepBlue, bold: true);
                page.SetText(242, 34, 8, "courseintellect.com", PdfColor.GrayText);
                page.FillRoundedCard(485, 24, 72, 22, PdfColor.Purple);
                page.SetText(501, 31, 8, $"Sayfa {index + 1} / {total}", PdfColor.White, bold: true);
                page.SetText(52, 18, 6.5, verificationCode, PdfColor.GrayText);
            }
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

        public void StrokeRect(double x, double y, double width, double height, PdfColor color)
        {
            content.AppendLine($"q {color.Stroke} 0.8 w {Fmt(x)} {Fmt(y)} {Fmt(width)} {Fmt(height)} re S Q");
        }

        public void DrawLine(double x1, double y1, double x2, double y2, PdfColor color)
        {
            content.AppendLine($"q {color.Stroke} 0.8 w {Fmt(x1)} {Fmt(y1)} m {Fmt(x2)} {Fmt(y2)} l S Q");
        }

        public void FillCircle(double centerX, double centerY, double radius, PdfColor color)
        {
            DrawCircle(centerX, centerY, radius, color, fill: true);
        }

        public void StrokeCircle(double centerX, double centerY, double radius, PdfColor color)
        {
            DrawCircle(centerX, centerY, radius, color, fill: false);
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

        private void DrawCircle(double centerX, double centerY, double radius, PdfColor color, bool fill)
        {
            const double k = 0.552284749831;
            var c = radius * k;
            var op = fill ? "f" : "S";
            var paint = fill ? color.Fill : color.Stroke;
            content.AppendLine(
                $"q {paint} 0.9 w " +
                $"{Fmt(centerX + radius)} {Fmt(centerY)} m " +
                $"{Fmt(centerX + radius)} {Fmt(centerY + c)} {Fmt(centerX + c)} {Fmt(centerY + radius)} {Fmt(centerX)} {Fmt(centerY + radius)} c " +
                $"{Fmt(centerX - c)} {Fmt(centerY + radius)} {Fmt(centerX - radius)} {Fmt(centerY + c)} {Fmt(centerX - radius)} {Fmt(centerY)} c " +
                $"{Fmt(centerX - radius)} {Fmt(centerY - c)} {Fmt(centerX - c)} {Fmt(centerY - radius)} {Fmt(centerX)} {Fmt(centerY - radius)} c " +
                $"{Fmt(centerX + c)} {Fmt(centerY - radius)} {Fmt(centerX + radius)} {Fmt(centerY - c)} {Fmt(centerX + radius)} {Fmt(centerY)} c {op} Q");
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
        public string Fill => $"{Fmt(R)} {Fmt(G)} {Fmt(B)} rg";
        public string Stroke => $"{Fmt(R)} {Fmt(G)} {Fmt(B)} RG";

        public static readonly PdfColor Header = new(0.055, 0.086, 0.145);
        public static readonly PdfColor Black = new(0, 0, 0);
        public static readonly PdfColor White = new(1, 1, 1);
        public static readonly PdfColor LightCard = new(0.965, 0.98, 0.99);
        public static readonly PdfColor LightPurple = new(0.945, 0.92, 1);
        public static readonly PdfColor LightRed = new(1, 0.9, 0.91);
        public static readonly PdfColor Border = new(0.86, 0.8, 0.98);
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

        private static string Fmt(double value)
        {
            return value.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);
        }
    }
}
