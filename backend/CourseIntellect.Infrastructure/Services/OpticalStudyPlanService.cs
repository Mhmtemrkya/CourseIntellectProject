using System.Globalization;
using System.Text.Json.Nodes;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Deneme sonrası kişisel çalışma planı. Öneri tamamen kurallıdır (model yok): öğrencinin bu denemede en çok
/// yanlış/boş bıraktığı en fazla 4 konu için "konu tekrarı" ve "soru çözümü" görevleri yarından başlayan
/// 7 güne yayılır. Önizleme hiçbir şey yazmaz. Onayda görevler mevcut çalışma programı servisiyle eklenir
/// (XP/seri korunur); aynı deneme yeniden uygulanırsa yalnız o denemenin bekleyen görevleri değişir,
/// tamamlanmışlar silinmez. Çalışma programı öğrenci adıyla tutulduğundan aynı adlı ikinci öğrenci varsa
/// plan yazılmaz (yanlış öğrenciye gitmesin).
/// </summary>
public sealed class OpticalStudyPlanService(
    CourseIntellectDbContext dbContext,
    IStudyPlanService studyPlans,
    IParentNotifier parentNotifier,
    IAuditLogService auditLog) : IOpticalStudyPlanService
{
    public const int MaxWeakTopics = 4;
    public const int MaxTasksPerStudent = 10;
    /// <summary>plan_items sütunu 12000 karakter; sınırın biraz altında kalınır.</summary>
    private const int PlanItemsLimit = 11500;
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private static string SourceTag(Guid examId) => $"optical-exam:{examId}";

    /// <summary>İstanbul (UTC+3) bugünü; görevler yarından başlar.</summary>
    private static DateTime TodayLocal() => DateTime.UtcNow.AddHours(3).Date;

    public async Task<OpticalStudyPlanPreviewDto> PreviewAsync(Guid examId, bool studyPlanEnabled, CancellationToken cancellationToken = default)
    {
        var exam = await dbContext.OpticalExams.AsNoTracking().FirstOrDefaultAsync(item => item.Id == examId, cancellationToken)
            ?? throw new KeyNotFoundException("Deneme bulunamadı.");
        if (exam.ImportedStudentCount == 0)
            return new OpticalStudyPlanPreviewDto(exam.Id, exam.Title, false, studyPlanEnabled, [], "Önce bu denemenin optik sonuçlarını içe aktarın.");

        var rows = await BuildRowsAsync(exam.Id, exam.Title, cancellationToken);
        var hasTopics = rows.HasTopics;
        return new OpticalStudyPlanPreviewDto(exam.Id, exam.Title, hasTopics, studyPlanEnabled, rows.Rows,
            hasTopics ? null : "Bu denemede soru konuları girilmemiş; plan konulara göre hazırlanır. Cevap anahtarına konuları ekleyip sonuçları yeniden içe aktarın.");
    }

    private sealed record RowSet(bool HasTopics, List<OpticalStudyPlanRowDto> Rows);

    private async Task<RowSet> BuildRowsAsync(Guid examId, string examTitle, CancellationToken ct)
    {
        var answers = await dbContext.OpticalExamAnswers.AsNoTracking()
            .Where(item => item.OpticalExamId == examId)
            .Select(item => new { item.StudentUserId, item.Subject, item.Topic, item.Outcome })
            .ToListAsync(ct);
        var hasTopics = answers.Any(item => !string.IsNullOrWhiteSpace(item.Topic));
        var nets = (await dbContext.OpticalExamStudentResults.AsNoTracking()
                .Where(item => item.OpticalExamId == examId)
                .Select(item => new { item.StudentUserId, item.Net })
                .ToListAsync(ct))
            .GroupBy(item => item.StudentUserId)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Net));
        var ids = nets.Keys.ToList();
        var students = await dbContext.Students.AsNoTracking()
            .Where(item => ids.Contains(item.UserId))
            .Select(item => new { item.UserId, item.FullName, item.ClassName, item.ParentUserId, item.ParentEmail })
            .ToListAsync(ct);
        // Çalışma programı öğrenci kimliğiyle tutulur (aynı adlı öğrenciler artık ayrı plana sahip).
        var userIds = students.Select(item => item.UserId).ToList();
        var applied = (await dbContext.StudyPlanStates.AsNoTracking()
                .Where(item => item.StudentUserId != null && userIds.Contains(item.StudentUserId.Value))
                .Select(item => new { item.StudentUserId, item.PlanItemsSerialized })
                .ToListAsync(ct))
            .Where(item => item.PlanItemsSerialized.Contains(SourceTag(examId), StringComparison.Ordinal))
            .Select(item => item.StudentUserId!.Value)
            .ToHashSet();

        var start = TodayLocal().AddDays(1);
        var rows = students
            .OrderBy(item => item.ClassName, StringComparer.Create(Tr, true)).ThenBy(item => item.FullName, StringComparer.Create(Tr, true))
            .Select(student =>
            {
                var name = student.FullName.Trim();
                var weak = answers
                    .Where(item => item.StudentUserId == student.UserId && !string.IsNullOrWhiteSpace(item.Topic))
                    .GroupBy(item => (item.Subject, Topic: item.Topic.Trim()))
                    .Select(group => new OpticalPlanTopicDto(group.Key.Subject, group.Key.Topic,
                        group.Count(item => item.Outcome == "Correct"), group.Count(item => item.Outcome == "Wrong"),
                        group.Count(item => item.Outcome == "Blank"), group.Count()))
                    .Where(IsWeak)
                    .OrderByDescending(item => item.Wrong + item.Blank)
                    .ThenBy(item => item.Total == 0 ? 1m : (decimal)item.Correct / item.Total)
                    .ThenBy(item => item.Subject, StringComparer.Ordinal)
                    .Take(MaxWeakTopics)
                    .ToList();
                var tasks = Tasks(weak, start);
                var skip = weak.Count == 0 && hasTopics ? "Bu denemede belirgin bir zayıf konu yok." : null;
                return new OpticalStudyPlanRowDto(student.UserId, name, student.ClassName, nets.GetValueOrDefault(student.UserId),
                    weak, tasks, ParentSummary(name, examTitle, nets.GetValueOrDefault(student.UserId), weak, tasks.Count),
                    student.ParentUserId is not null || !string.IsNullOrWhiteSpace(student.ParentEmail), skip, applied.Contains(student.UserId));
            })
            .ToList();
        return new RowSet(hasTopics, rows);
    }

    /// <summary>Yanlış + boş en az 2 ya da konunun en az üçte biri; tek soruluk konuda tek hata da sayılır.</summary>
    private static bool IsWeak(OpticalPlanTopicDto topic)
    {
        var missed = topic.Wrong + topic.Blank;
        return missed >= 2 || (missed >= 1 && missed * 3 >= topic.Total);
    }

    /// <summary>
    /// Her zayıf konu için tekrar + soru çözümü, en sonda deneme yanlışlarının tekrarı. Görevler sırası
    /// bozulmadan 7 güne eşit yayılır (başa sarmaz); son görev haftanın son günündedir.
    /// </summary>
    private static List<OpticalPlanTaskDto> Tasks(IReadOnlyList<OpticalPlanTopicDto> weak, DateTime start)
    {
        if (weak.Count == 0) return [];
        var plan = new List<(string Title, string Subject, string Topic, int Minutes)>();
        foreach (var topic in weak)
        {
            var questions = Math.Clamp(10 + 5 * (topic.Wrong + topic.Blank), 10, 30);
            plan.Add(($"{topic.Topic} konu tekrarı", topic.Subject, topic.Topic, 30));
            plan.Add(($"{topic.Topic}: {questions} soru çöz", topic.Subject, topic.Topic, 40));
        }
        plan.Add(("Deneme yanlışlarını yeniden çöz", weak[0].Subject, string.Empty, 30));
        return plan.Select((task, index) =>
        {
            var day = plan.Count == 1 ? 0 : index * 6 / (plan.Count - 1);
            return new OpticalPlanTaskDto(task.Title, task.Subject, task.Topic, start.AddDays(day).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), task.Minutes);
        }).ToList();
    }

    /// <summary>Veliye giden kısa özet: konu adları ve görev sayısı (soru bazlı puan yok; bildirim kilit ekranında görünür).</summary>
    private static string ParentSummary(string name, string examTitle, decimal net, IReadOnlyList<OpticalPlanTopicDto> weak, int taskCount)
    {
        var netText = net.ToString("0.##", Tr);
        if (weak.Count == 0)
            return $"{name}, {examTitle} denemesinde toplam {netText} net yaptı. Bu denemede belirgin bir eksik konu görünmüyor.";
        var topics = string.Join(", ", weak.Select(item => item.Topic));
        return $"{name}, {examTitle} denemesinde toplam {netText} net yaptı. Öncelikli çalışma konuları: {topics}. "
            + $"Bu hafta için {taskCount} görevlik bir çalışma planı hazırlandı; öğrenci uygulamada görebilir.";
    }

    public async Task<OpticalStudyPlanApplyResultDto> ApplyAsync(Guid examId, ApplyOpticalStudyPlansRequest request, Guid? userId, CancellationToken cancellationToken = default)
    {
        var exam = await dbContext.OpticalExams.AsNoTracking().FirstOrDefaultAsync(item => item.Id == examId, cancellationToken)
            ?? throw new KeyNotFoundException("Deneme bulunamadı.");
        if ((request.Students ?? []).Count == 0) throw new ArgumentException("Plan uygulanacak öğrenci seçilmedi.");
        var rows = (await BuildRowsAsync(exam.Id, exam.Title, cancellationToken)).Rows.ToDictionary(item => item.StudentUserId);
        var tag = SourceTag(exam.Id);
        var today = TodayLocal();
        var skipped = new List<string>();
        var applied = 0;
        var written = 0;
        var notified = 0;

        foreach (var item in request.Students.DistinctBy(entry => entry.StudentUserId))
        {
            if (!rows.TryGetValue(item.StudentUserId, out var row))
            {
                skipped.Add("Bu denemede sonucu olmayan öğrenci atlandı.");
                continue;
            }
            // Zayıf konusu olmayan öğrenciye öğretmen elle görev eklediyse yazılır.
            if ((item.Tasks ?? []).Count == 0)
            {
                skipped.Add($"{row.StudentName}: {row.SkipReason ?? "görev yok"}");
                continue;
            }
            var tasks = Validate(row.StudentName, item.Tasks ?? [], today);

            var plan = await studyPlans.GetOrCreateAsync(row.StudentUserId, row.StudentName, cancellationToken);
            var items = ParseItems(plan.PlanItemsSerialized);
            // Yeniden uygulamada yalnız bu denemenin bekleyen görevleri değişir; tamamlananlar kalır.
            for (var index = items.Count - 1; index >= 0; index--)
            {
                if (items[index] is JsonObject existing && existing["source"]?.ToString() == tag && !IsDone(existing))
                    items.RemoveAt(index);
            }
            var stamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            for (var index = 0; index < tasks.Count; index++)
            {
                var task = tasks[index];
                items.Add(new JsonObject
                {
                    ["id"] = $"{stamp}{index:00}",
                    ["type"] = "task",
                    ["title"] = task.Title,
                    ["subject"] = task.Subject,
                    ["topic"] = task.Topic,
                    ["date"] = task.Date,
                    ["startTime"] = string.Empty,
                    ["endTime"] = string.Empty,
                    ["durationMinutes"] = task.DurationMinutes,
                    ["status"] = "pending",
                    ["source"] = tag,
                    ["createdAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
                });
            }
            var serialized = items.ToJsonString();
            if (serialized.Length > PlanItemsLimit)
            {
                skipped.Add($"{row.StudentName}: çalışma programı çok dolu; eski görevler temizlenmeden yeni plan eklenemez.");
                continue;
            }
            await studyPlans.UpdatePlanItemsAsync(row.StudentUserId, row.StudentName, serialized, cancellationToken);
            applied++;
            written += tasks.Count;

            if (item.SendParentSummary && row.HasParent)
            {
                var summary = string.IsNullOrWhiteSpace(item.ParentSummary) ? row.ParentSummary : Clean(item.ParentSummary, 600);
                // Aynı deneme için veliye bir kez gider (yeniden uygulamada tekrar gönderilmez).
                await parentNotifier.NotifyStudentParentAsync(row.StudentUserId, row.StudentName, "Çalışma planı hazırlandı",
                    summary, "study-plan.optical", $"optical-plan:{exam.Id}:{row.StudentUserId}", cancellationToken);
                notified++;
            }
        }

        await auditLog.LogAsync("optical-study-plan-applied", "study-plan", "OpticalExam", exam.Id.ToString(),
            $"students={applied} tasks={written} parents={notified} skipped={skipped.Count}", cancellationToken);
        return new OpticalStudyPlanApplyResultDto(applied, written, notified, skipped);
    }

    /// <summary>Öğretmenin düzenlediği görevler: en çok 10; başlık, ders, tarih ve süre sınırları.</summary>
    private static List<OpticalPlanTaskDto> Validate(string studentName, IReadOnlyList<OpticalPlanTaskDto> tasks, DateTime today)
    {
        if (tasks.Count > MaxTasksPerStudent) throw new ArgumentException($"{studentName}: en fazla {MaxTasksPerStudent} görev eklenebilir.");
        return tasks.Select(task =>
        {
            var title = Clean(task.Title, 120);
            if (title.Length == 0) throw new ArgumentException($"{studentName}: görev başlığı boş olamaz.");
            if (!DateTime.TryParseExact(task.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                || date < today.AddDays(-1) || date > today.AddDays(60))
                throw new ArgumentException($"{studentName}: görev tarihi geçersiz ({task.Date}).");
            if (task.DurationMinutes is < 10 or > 240) throw new ArgumentException($"{studentName}: görev süresi 10–240 dakika olmalı.");
            return task with { Title = title, Subject = Clean(task.Subject, 100), Topic = Clean(task.Topic, 150) };
        }).ToList();
    }

    private static string Clean(string? value, int max)
    {
        var text = string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(part => new string(part.Where(ch => !char.IsControl(ch)).ToArray())));
        return text.Length > max ? text[..max] : text;
    }

    private static bool IsDone(JsonObject item) =>
        item["status"]?.ToString() == "done" || (item["done"] is JsonValue flag && flag.TryGetValue<bool>(out var done) && done);

    private static JsonArray ParseItems(string serialized)
    {
        try
        {
            return JsonNode.Parse(string.IsNullOrWhiteSpace(serialized) ? "[]" : serialized) as JsonArray ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }
}
