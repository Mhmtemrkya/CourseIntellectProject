using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Öğrenci konu analizi. Veri: tamamlanmış online sınav cevapları (öğretmen önizlemeleri hariç),
/// soru bankası çalışmaları ve optik deneme cevapları (cevap anahtarında konu girilmiş sorular).
/// Kaynaklar birbirini tekrar etmez. Ders bazlı ExamResult netleri konu taşımadığı için kullanılmaz.
/// Öğrenci listesi Students üzerinden gelir: şube kapsamı (şube müdürü) sorgu filtresiyle uygulanır.
/// </summary>
public sealed partial class StudentInsightService(
    CourseIntellectDbContext dbContext,
    IInsightTextGenerator generator,
    IBackgroundJobClient backgroundJobs,
    ILogger<StudentInsightService> logger) : IStudentInsightService
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static readonly StringComparer TrComparer = StringComparer.Create(Tr, ignoreCase: true);

    private const string NoteSystemPrompt =
        "Sen bir rehber öğretmensin. Sana sistemin hazırladığı doğru ama maddeli bir değerlendirme verilir. " +
        "Görevin: bunu öğretmene yazılmış, akıcı ve nazik 2-3 cümlelik tek bir paragrafa dönüştürmek. " +
        "Kurallar: Yalnızca Türkçe yaz. İçerikteki teşhisleri ve önerileri AYNEN koru; yeni teşhis, yeni konu ya da yeni bilgi ekleme. " +
        "Güçlü konular için öneri yazma. Rakam veya yüzde yazma. Konu adlarını değiştirme.";

    private static readonly object NoteSchema = new
    {
        type = "object",
        properties = new { not = new { type = "string" } },
        required = new[] { "not" },
    };

    private sealed record RosterEntry(Guid UserId, string FullName, string ClassName, string Username);

    public async Task<InsightOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var classes = (await dbContext.Students.AsNoTracking()
                .Select(item => item.ClassName)
                .ToListAsync(cancellationToken))
            .Select(name => name.Trim())
            .Where(name => name.Length > 0)
            .GroupBy(name => name, TrComparer)
            .Select(group => new InsightClassSummaryDto(group.First(), group.Count()))
            .OrderBy(item => item.ClassName, TrComparer)
            .ToList();
        return new InsightOverviewDto(classes, generator.IsEnabled, generator.IsEnabled ? generator.Model : null,
            ["Online sınavlar", "Soru bankası çalışmaları", "Optik denemeler"]);
    }

    public async Task<ClassInsightDto?> GetClassAsync(string className, CancellationToken cancellationToken = default)
    {
        var roster = await LoadClassRosterAsync(className, cancellationToken);
        if (roster.Count == 0) return null;
        var answers = await LoadAnswersAsync(roster, cancellationToken);

        var perStudent = roster
            .Select(student =>
            {
                var mine = answers.Where(item => item.StudentUserId == student.UserId).ToList();
                var topics = StudentInsightCalculator.ComputeTopics(student.UserId, answers);
                var top = StudentInsightCalculator.RankWeak(topics).FirstOrDefault();
                return (Student: student, Mine: mine, Topics: topics, Dto: new ClassStudentInsightDto(
                    student.UserId,
                    student.FullName,
                    mine.Count,
                    StudentInsightCalculator.Rate(mine.Count(item => item.Outcome == AnswerOutcome.Correct), mine.Count),
                    topics.Count(item => item.IsWeak),
                    top?.Subject,
                    top?.Topic));
            })
            .ToList();

        var topicsSummary = answers
            .GroupBy(item => (item.Subject, item.Topic))
            .Select(group => new ClassTopicInsightDto(
                group.Key.Subject,
                group.Key.Topic,
                group.Count(),
                StudentInsightCalculator.Rate(group.Count(item => item.Outcome == AnswerOutcome.Correct), group.Count()),
                group.Select(item => item.StudentUserId).Distinct().Count(),
                perStudent.Count(student => student.Topics.Any(topic => topic.IsWeak && topic.Subject == group.Key.Subject && topic.Topic == group.Key.Topic))))
            .OrderByDescending(item => item.StrugglingStudentCount)
            .ThenBy(item => item.SuccessRate)
            .ToList();

        // Etüt grubu adları ve ortalama kaçırılan soru için konu başına zorlanan öğrenciler.
        var strugglers = perStudent
            .SelectMany(student => student.Topics.Where(topic => topic.IsWeak)
                .Select(topic => (Key: (topic.Subject, topic.Topic), Entry: (student.Student.FullName, topic.Wrong + topic.Blank))))
            .GroupBy(item => item.Key)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<(string Name, int Missed)>)group.Select(item => item.Entry).ToList());

        return new ClassInsightDto(
            roster[0].ClassName,
            roster.Count,
            perStudent.Count(item => item.Mine.Count > 0),
            answers.Count,
            StudentInsightCalculator.Rate(answers.Count(item => item.Outcome == AnswerOutcome.Correct), answers.Count),
            perStudent
                .Select(item => item.Dto)
                .OrderByDescending(item => item.WeakTopicCount)
                .ThenBy(item => item.Solved == 0 ? 1 : 0)
                .ThenBy(item => item.SuccessRate)
                .ThenBy(item => item.FullName, TrComparer)
                .ToList(),
            topicsSummary,
            StudentInsightCalculator.MinSample,
            StudentInsightCalculator.ComputeClassActions(topicsSummary, strugglers),
            await ClassFollowupsAsync(roster, answers, cancellationToken));
    }

    public async Task<StudentInsightDto?> GetStudentAsync(Guid studentUserId, CancellationToken cancellationToken = default)
    {
        var analysis = await AnalyzeStudentAsync(studentUserId, cancellationToken);
        if (analysis is null) return null;
        var (student, mine, topics, weak, strong, hash) = analysis.Value;
        var followups = await RecordAndEvaluateAsync(student.UserId, mine, weak, cancellationToken);

        var note = await dbContext.StudentInsightNotes.AsNoTracking()
            .Where(item => item.StudentUserId == studentUserId)
            .OrderByDescending(item => item.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return new StudentInsightDto(
            student.UserId,
            student.FullName,
            student.ClassName,
            mine.Count,
            StudentInsightCalculator.Rate(mine.Count(item => item.Outcome == AnswerOutcome.Correct), mine.Count),
            mine.Count > 0 ? mine.Min(item => item.AtUtc) : null,
            mine.Count > 0 ? mine.Max(item => item.AtUtc) : null,
            StudentInsightCalculator.ComputeSubjects(mine, topics),
            topics,
            weak,
            strong,
            ToNoteDto(note, hash),
            StudentInsightCalculator.MinSample,
            followups);
    }

    /// <summary>
    /// Gösterilen öncelikli önerileri (ilk 3) kaydeder ve önceki önerilerin sonucunu hesaplar. Aynı konu
    /// için 28 gün içinde ikinci kayıt açılmaz. Bu çağrıda yeni açılan kayıtlar sonuç listesine girmez
    /// (henüz ölçülecek bir şey yok). Kayıt başarısızsa analiz yine döner.
    /// </summary>
    private async Task<IReadOnlyList<RecommendationFollowupDto>> RecordAndEvaluateAsync(
        Guid studentUserId, IReadOnlyList<InsightAnswer> mine, IReadOnlyList<TopicInsightDto> weak, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var windowStart = now.AddDays(-StudentInsightCalculator.RecommendationWindowDays);
        var previous = await dbContext.StudentRecommendations.AsNoTracking()
            .Where(item => item.StudentUserId == studentUserId)
            .OrderByDescending(item => item.IssuedAtUtc)
            .ThenBy(item => item.Priority)
            .Take(50)
            .ToListAsync(cancellationToken);

        var fresh = weak
            .Where(topic => topic.Priority is int priority && priority <= 3)
            .Where(topic => !previous.Any(item => item.Subject == topic.Subject && item.Topic == topic.Topic && item.IssuedAtUtc >= windowStart))
            .Select(topic => new StudentRecommendationRecord
            {
                StudentUserId = studentUserId,
                Subject = topic.Subject,
                Topic = topic.Topic,
                Diagnosis = topic.Diagnosis ?? string.Empty,
                Priority = topic.Priority ?? 0,
                SuggestedQuestions = topic.SuggestedQuestions ?? 0,
                BaselineSuccessRate = topic.SuccessRate,
                BaselineSolved = topic.Solved,
                IssuedAtUtc = now,
            })
            .ToList();
        if (fresh.Count > 0)
        {
            try
            {
                dbContext.StudentRecommendations.AddRange(fresh);
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex)
            {
                logger.LogInformation(ex, "Öneri kaydı yazılamadı; analiz yine döndü.");
                foreach (var item in fresh) dbContext.Entry(item).State = EntityState.Detached;
            }
        }

        return previous
            .Take(8)
            .Select(item => StudentInsightCalculator.EvaluateFollowup(item.Subject, item.Topic, item.Diagnosis, item.IssuedAtUtc,
                item.BaselineSuccessRate, mine, now))
            .ToList();
    }

    public async Task<InsightNoteDto?> RequestNoteAsync(Guid studentUserId, Guid? requestedByUserId, CancellationToken cancellationToken = default)
    {
        var analysis = await AnalyzeStudentAsync(studentUserId, cancellationToken);
        if (analysis is null) return null;
        var (student, mine, _, weak, strong, hash) = analysis.Value;
        if (mine.Count == 0) throw new InvalidOperationException("Bu öğrencinin konu bilgisi taşıyan cevabı yok; önce online sınav ya da soru bankası çalışması gerekir.");

        var existing = await dbContext.StudentInsightNotes
            .Where(item => item.StudentUserId == studentUserId && item.InputHash == hash && item.Status != "Failed")
            .OrderByDescending(item => item.RequestedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null) return ToNoteDto(existing, hash);

        var profile = await dbContext.Students.AsNoTracking().FirstAsync(item => item.UserId == student.UserId, cancellationToken);
        var note = new StudentInsightNote
        {
            BranchId = profile.BranchId,
            StudentUserId = studentUserId,
            InputHash = hash,
            Status = "Pending",
            Model = generator.IsEnabled ? generator.Model : string.Empty,
            Draft = StudentInsightCalculator.BuildDraft(weak, strong),
            RequestedByUserId = requestedByUserId,
        };

        if (!generator.IsEnabled || dbContext.CurrentTenantId is not Guid tenantId)
        {
            // Yapay zekâ kapalı: şablon not hemen hazır.
            note.Status = "Ready";
            note.Source = "template";
            note.Text = StudentInsightCalculator.BuildTemplateNote(weak, strong);
            note.GeneratedAtUtc = DateTime.UtcNow;
            dbContext.StudentInsightNotes.Add(note);
            await dbContext.SaveChangesAsync(cancellationToken);
            return ToNoteDto(note, hash);
        }

        dbContext.StudentInsightNotes.Add(note);
        await dbContext.SaveChangesAsync(cancellationToken);
        backgroundJobs.Enqueue<IStudentInsightService>(service => service.GenerateNoteAsync(tenantId, note.Id, CancellationToken.None));
        return ToNoteDto(note, hash);
    }

    public async Task GenerateNoteAsync(Guid tenantId, Guid noteId, CancellationToken cancellationToken = default)
    {
        dbContext.SetTenantOverride(tenantId);
        try
        {
            var note = await dbContext.StudentInsightNotes.FirstOrDefaultAsync(item => item.Id == noteId, cancellationToken);
            if (note is null || note.Status != "Pending") return;

            var analysis = await AnalyzeStudentAsync(note.StudentUserId, cancellationToken);
            var weak = analysis?.Weak ?? [];
            var strong = analysis?.Strong ?? [];

            var raw = await generator.GenerateJsonAsync(NoteSystemPrompt, [("user", note.Draft)], NoteSchema, cancellationToken);
            var text = ExtractNote(raw);
            var error = raw is null ? "Modele ulaşılamadı." : ValidateNote(text, weak, strong);
            if (error is null)
            {
                note.Source = "llm";
                note.Text = text!.Trim();
                note.Error = string.Empty;
            }
            else
            {
                note.Source = "template";
                note.Text = StudentInsightCalculator.BuildTemplateNote(weak, strong);
                note.Error = error.Length > 300 ? error[..300] : error;
                logger.LogInformation("Öneri notu doğrulamadan geçmedi ({Reason}); şablon kullanıldı.", error);
            }
            note.Status = "Ready";
            note.GeneratedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        finally
        {
            dbContext.SetTenantOverride(null);
        }
    }

    public async Task<InsightNoteDto?> ReviewNoteAsync(Guid noteId, ReviewInsightNoteRequest request, Guid? reviewerUserId, CancellationToken cancellationToken = default)
    {
        var note = await dbContext.StudentInsightNotes.FirstOrDefaultAsync(item => item.Id == noteId, cancellationToken);
        if (note is null) return null;
        if (note.Status != "Ready") throw new InvalidOperationException("Not henüz hazır değil.");

        var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        switch (action)
        {
            case "approve":
                note.ReviewStatus = "Approved";
                note.ReviewedText = note.Text;
                break;
            case "edit":
                var edited = (request.EditedText ?? string.Empty).Trim();
                if (edited.Length < 20) throw new ArgumentException("Düzeltilmiş not en az 20 karakter olmalı.");
                if (edited.Length > 2000) throw new ArgumentException("Düzeltilmiş not en fazla 2000 karakter olabilir.");
                note.ReviewStatus = "Edited";
                note.ReviewedText = edited;
                break;
            case "reject":
                note.ReviewStatus = "Rejected";
                note.ReviewedText = string.Empty;
                break;
            default:
                throw new ArgumentException("Geçersiz işlem (approve, edit ya da reject).");
        }
        note.ReviewedByUserId = reviewerUserId;
        note.ReviewedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var current = await AnalyzeStudentAsync(note.StudentUserId, cancellationToken);
        return ToNoteDto(note, current?.Hash);
    }

    // ── Analiz ───────────────────────────────────────────────────────────────

    private async Task<(RosterEntry Student, List<InsightAnswer> Mine, IReadOnlyList<TopicInsightDto> Topics,
        IReadOnlyList<TopicInsightDto> Weak, IReadOnlyList<TopicInsightDto> Strong, string Hash)?> AnalyzeStudentAsync(
        Guid studentUserId, CancellationToken cancellationToken)
    {
        var profile = await dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == studentUserId, cancellationToken);
        if (profile is null) return null;

        var roster = await LoadClassRosterAsync(profile.ClassName, cancellationToken);
        if (roster.All(item => item.UserId != studentUserId))
        {
            // Sınıfı boş öğrenci: yalnız kendisiyle (sınıf karşılaştırması olmadan) analiz edilir.
            roster = [.. roster, await ToRosterEntryAsync(profile, cancellationToken)];
        }
        var answers = await LoadAnswersAsync(roster, cancellationToken);
        var student = roster.First(item => item.UserId == studentUserId);
        var mine = answers.Where(item => item.StudentUserId == studentUserId).ToList();
        var topics = StudentInsightCalculator.ComputeTopics(studentUserId, answers);
        var weak = StudentInsightCalculator.RankWeak(topics);
        var strong = topics.Where(item => item.IsStrong).OrderByDescending(item => item.SuccessRate).ThenByDescending(item => item.Solved).ToList();
        var draft = StudentInsightCalculator.BuildDraft(weak, strong);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(draft + "|" + (generator.IsEnabled ? generator.Model : "template"))));
        return (student, mine, topics, weak, strong, hash);
    }

    /// <summary>Sınıftaki son 8 haftanın öneri sonuçları (sayım).</summary>
    private async Task<FollowupSummaryDto> ClassFollowupsAsync(IReadOnlyList<RosterEntry> roster, IReadOnlyList<InsightAnswer> answers, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var since = now.AddDays(-56);
        var ids = roster.Select(item => item.UserId).ToList();
        var records = await dbContext.StudentRecommendations.AsNoTracking()
            .Where(item => ids.Contains(item.StudentUserId) && item.IssuedAtUtc >= since)
            .ToListAsync(cancellationToken);
        var byStudent = answers.GroupBy(item => item.StudentUserId).ToDictionary(group => group.Key, group => (IReadOnlyList<InsightAnswer>)group.ToList());
        return StudentInsightCalculator.Summarize(records.Select(item => StudentInsightCalculator.EvaluateFollowup(
            item.Subject, item.Topic, item.Diagnosis, item.IssuedAtUtc, item.BaselineSuccessRate,
            byStudent.TryGetValue(item.StudentUserId, out var mine) ? mine : [], now)));
    }

    private async Task<List<RosterEntry>> LoadClassRosterAsync(string className, CancellationToken cancellationToken)
    {
        var target = (className ?? string.Empty).Trim();
        if (target.Length == 0) return [];
        var profiles = (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
            .Where(item => TrComparer.Equals(item.ClassName.Trim(), target))
            .ToList();
        if (profiles.Count == 0) return [];
        var ids = profiles.Select(item => item.UserId).ToList();
        var usernames = await dbContext.Users.AsNoTracking()
            .Where(item => ids.Contains(item.Id))
            .Select(item => new { item.Id, item.Username })
            .ToDictionaryAsync(item => item.Id, item => item.Username, cancellationToken);
        return profiles
            .Select(item => new RosterEntry(item.UserId, item.FullName, item.ClassName.Trim(), usernames.GetValueOrDefault(item.UserId) ?? string.Empty))
            .OrderBy(item => item.FullName, TrComparer)
            .ToList();
    }

    private async Task<RosterEntry> ToRosterEntryAsync(StudentProfile profile, CancellationToken cancellationToken)
    {
        var username = await dbContext.Users.AsNoTracking()
            .Where(item => item.Id == profile.UserId)
            .Select(item => item.Username)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        return new RosterEntry(profile.UserId, profile.FullName, profile.ClassName.Trim(), username);
    }

    private async Task<List<InsightAnswer>> LoadAnswersAsync(IReadOnlyCollection<RosterEntry> roster, CancellationToken cancellationToken)
    {
        var ids = roster.Select(item => item.UserId).ToList();
        var exam = await (
            from session in dbContext.ExamSessions.AsNoTracking()
            where session.StudentUserId != null && ids.Contains(session.StudentUserId.Value)
                && !session.IsTeacherPreview && session.CompletedAtUtc != null
            join attempt in dbContext.QuestionAttempts.AsNoTracking() on session.Id equals attempt.ExamSessionId
            join question in dbContext.QuestionBankItems.AsNoTracking() on attempt.QuestionBankItemId equals question.Id
            select new { UserId = session.StudentUserId!.Value, question.Subject, question.Topic, attempt.Status, At = session.CompletedAtUtc!.Value })
            .ToListAsync(cancellationToken);

        var byUsername = roster
            .Where(item => item.Username.Length > 0)
            .GroupBy(item => item.Username, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().UserId, StringComparer.OrdinalIgnoreCase);
        var usernames = byUsername.Keys.ToList();
        var practice = usernames.Count == 0 ? [] : await (
            from attempt in dbContext.QuestionPracticeAttempts.AsNoTracking()
            where usernames.Contains(attempt.StudentUsername)
            join question in dbContext.QuestionBankItems.AsNoTracking() on attempt.QuestionId equals question.Id
            select new { attempt.StudentUsername, question.Subject, question.Topic, attempt.IsCorrect, attempt.SubmittedAtUtc })
            .ToListAsync(cancellationToken);

        var answers = exam.Select(item => new InsightAnswer(
                item.UserId,
                StudentInsightCalculator.NormalizeLabel(item.Subject),
                StudentInsightCalculator.NormalizeLabel(item.Topic),
                // ExamSolvingService: Correct = doğru, Answered = cevaplandı ama yanlış, Unanswered/Empty = boş.
                item.Status == "Correct" ? AnswerOutcome.Correct : item.Status == "Answered" ? AnswerOutcome.Wrong : AnswerOutcome.Blank,
                item.At))
            .ToList();
        // Sistemde çözülen denemelerde boş bırakılan sorular (cevaplananlar practice tablosunda).
        var blanks = usernames.Count == 0 ? [] : await (
            from blank in dbContext.ExamBlankAnswers.AsNoTracking()
            where usernames.Contains(blank.StudentUsername)
            join question in dbContext.QuestionBankItems.AsNoTracking() on blank.QuestionId equals question.Id
            select new { blank.StudentUsername, question.Subject, question.Topic, blank.CompletedAtUtc })
            .ToListAsync(cancellationToken);
        answers.AddRange(blanks
            .Where(item => byUsername.ContainsKey(item.StudentUsername))
            .Select(item => new InsightAnswer(
                byUsername[item.StudentUsername],
                StudentInsightCalculator.NormalizeLabel(item.Subject),
                StudentInsightCalculator.NormalizeLabel(item.Topic),
                AnswerOutcome.Blank,
                item.CompletedAtUtc)));

        // Optik denemeler: yalnız cevap anahtarında konu girilmiş sorular. Bir denemenin bütün
        // soruları aynı tarihi taşır; eğilim bölmesi kararlı olsun diye soru sırası saniye olarak eklenir.
        var optical = await (
            from answer in dbContext.OpticalExamAnswers.AsNoTracking()
            where ids.Contains(answer.StudentUserId) && answer.Topic != ""
            join opticalExam in dbContext.OpticalExams.AsNoTracking() on answer.OpticalExamId equals opticalExam.Id
            select new { answer.StudentUserId, answer.Subject, answer.Topic, answer.Outcome, answer.QuestionNo, opticalExam.ExamDateUtc })
            .ToListAsync(cancellationToken);
        answers.AddRange(optical.Select(item => new InsightAnswer(
            item.StudentUserId,
            StudentInsightCalculator.NormalizeLabel(item.Subject),
            StudentInsightCalculator.NormalizeLabel(item.Topic),
            item.Outcome == "Correct" ? AnswerOutcome.Correct : item.Outcome == "Wrong" ? AnswerOutcome.Wrong : AnswerOutcome.Blank,
            DateTime.SpecifyKind(item.ExamDateUtc, DateTimeKind.Utc).AddSeconds(item.QuestionNo))));

        answers.AddRange(practice
            .Where(item => byUsername.ContainsKey(item.StudentUsername))
            .Select(item => new InsightAnswer(
                byUsername[item.StudentUsername],
                StudentInsightCalculator.NormalizeLabel(item.Subject),
                StudentInsightCalculator.NormalizeLabel(item.Topic),
                item.IsCorrect ? AnswerOutcome.Correct : AnswerOutcome.Wrong,
                item.SubmittedAtUtc)));
        return answers;
    }

    // ── Not ──────────────────────────────────────────────────────────────────

    private InsightNoteDto ToNoteDto(StudentInsightNote? note, string? currentHash)
    {
        if (note is null)
        {
            return new InsightNoteDto(null, generator.IsEnabled ? "none" : "disabled", null, null, null, null, false, "None", null);
        }
        return new InsightNoteDto(
            note.Id,
            note.Status.ToLowerInvariant(),
            note.Source.Length > 0 ? note.Source : null,
            note.Model.Length > 0 ? note.Model : null,
            note.Status == "Ready" ? (note.ReviewStatus == "Edited" ? note.ReviewedText : note.Text) : null,
            note.GeneratedAtUtc,
            currentHash is not null && note.InputHash == currentHash,
            note.ReviewStatus,
            note.ReviewStatus == "Edited" ? note.ReviewedText : null);
    }

    private static string? ExtractNote(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            using var document = JsonDocument.Parse(raw);
            return document.RootElement.TryGetProperty("not", out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Model çıktısının doğrulaması. Herhangi biri tutmazsa şablon not kullanılır:
    /// boş/çok kısa/çok uzun, rakam içeriyor (sayıları sistem gösterir), Türkçe dışı alfabe
    /// (küçük modeller Çince karakter sızdırabiliyor), İngilizce kelimeler, sohbet dili/"siz" hitabı,
    /// verilmemiş bir teşhisten (düşüş, boş bırakma) söz etmek, öncelikli bir zayıf konu eksik ya da
    /// güçlü bir konu için öneri cümlesi kurulmuş.
    /// </summary>
    public static string? ValidateNote(string? text, IReadOnlyList<TopicInsightDto> weak, IReadOnlyList<TopicInsightDto> strong)
    {
        if (string.IsNullOrWhiteSpace(text)) return "Boş çıktı.";
        var value = text.Trim();
        if (value.Length < 40) return "Çok kısa.";
        if (value.Length > 900) return "Çok uzun.";
        if (DigitPattern().IsMatch(value)) return "Rakam içeriyor.";
        if (ForeignScriptPattern().IsMatch(value)) return "Türkçe dışı karakter içeriyor.";
        if (EnglishPattern().IsMatch(value)) return "İngilizce kelime içeriyor.";
        var lower = value.ToLower(Tr);
        if (ToneViolation().IsMatch(lower)) return "Uygunsuz hitap ya da sohbet dili.";
        var diagnoses = weak.Take(3).Select(item => item.Diagnosis).ToHashSet();
        if (DecliningWord().IsMatch(lower) && !diagnoses.Contains("declining")) return "Olmayan bir düşüşten söz ediyor.";
        if (SkippingWord().IsMatch(lower) && !diagnoses.Contains("skipping")) return "Olmayan bir boş bırakma eğiliminden söz ediyor.";
        foreach (var topic in weak.Take(3))
        {
            if (!lower.Contains(topic.Topic.ToLower(Tr), StringComparison.Ordinal)) return $"Zayıf konu eksik: {topic.Topic}.";
        }
        foreach (var topic in strong)
        {
            var name = topic.Topic.ToLower(Tr);
            foreach (var sentence in SentenceSplit().Split(lower))
            {
                if (sentence.Contains(name, StringComparison.Ordinal) && RecommendationVerb().IsMatch(sentence)
                    && !weak.Any(item => sentence.Contains(item.Topic.ToLower(Tr), StringComparison.Ordinal)))
                {
                    return $"Güçlü konu için öneri yazılmış: {topic.Topic}.";
                }
            }
        }
        return null;
    }

    [GeneratedRegex(@"\d")]
    private static partial Regex DigitPattern();

    [GeneratedRegex(@"[Ͱ-ϿЀ-ӿ֐-׿؀-ۿ぀-ヿ㐀-鿿가-힯]")]
    private static partial Regex ForeignScriptPattern();

    [GeneratedRegex(@"\b(the|and|student|should|topic|practice|with)\b", RegexOptions.IgnoreCase)]
    private static partial Regex EnglishPattern();

    // Not öğretmene üçüncü şahıs diliyle yazılır: özür/teşekkür/endişe ve "siz" hitabı sohbet sızıntısıdır.
    [GeneratedRegex(@"(özür|teşekkür|endişe|başarılar|(iniz|ınız|unuz|ünüz|anız|eniz|öneririz)\b)")]
    private static partial Regex ToneViolation();

    [GeneratedRegex(@"düşüş|düşme|geriledi|gerileme")]
    private static partial Regex DecliningWord();

    [GeneratedRegex(@"boş bırak")]
    private static partial Regex SkippingWord();

    [GeneratedRegex(@"[.!?;]+")]
    private static partial Regex SentenceSplit();

    [GeneratedRegex(@"(tekrar|analiz|çalış|alıştırma|önerilir|yapmalı|çözmeli|pekiştir)")]
    private static partial Regex RecommendationVerb();
}
