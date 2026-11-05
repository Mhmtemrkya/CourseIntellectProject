using System.Collections.Concurrent;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Haftalık özet (brifing) ve sınıf düzeyinde konu önerileri. Brifing sunucuda üretildiği için
/// masaüstü, mobil ve web aynı maddeleri gösterir; her maddenin "Ask" sorusu Maydi'ye gider ve
/// aynı rol için cevaplanabilir olmalıdır (testte doğrulanır).
///
/// Kurallar:
/// • Veri yoksa ya da eşik altındaysa madde yazılmaz (uydurma içgörü yok). Küçük sayılarda yüzde
///   kullanılmaz; "bu hafta 2 ders, geçen hafta 0" gibi mutlak sayılar verilir.
/// • "Bugün" Türkiye günüdür (<see cref="AssistantDates.TodayTr"/>).
/// • Pahalı sınıf analizleri (kurum, kullanıcı, portal) anahtarıyla kısa süre önbelleğe alınır;
///   öğretmen ve yönetici kapsamı farklı olduğundan yalnız kuruma göre önbelleklenmez.
/// </summary>
public sealed partial class AssistantService
{
    private const int MaxBriefingItems = 6;
    private const int AbsenceTrendMinimum = 5;
    private static readonly TimeSpan DigestCacheTtl = TimeSpan.FromMinutes(15);
    private static readonly ConcurrentDictionary<(Guid Tenant, Guid User, string Portal), (IReadOnlyList<ClassDigest> Classes, DateTime ExpiresUtc)> DigestCache = new();

    private sealed record ClassDigest(string ClassName, IReadOnlyList<ClassActionDto> Actions);

    private static string L(AssistantVoice voice, string tr, string en) => voice.English ? en : tr;

    // ── Sınıf düzeyinde konu önerisi ("10-A sınıfının zayıf konuları") ──────────────

    /// <summary>
    /// Sınıf adı soruda geçen konu analizi personel için sınıf önerisine gider. Öğretmen yalnız ders
    /// verdiği sınıfları, yönetici tüm sınıfları görür; öğrenci ve veli bu yola hiç girmez.
    /// </summary>
    private static bool IsClassTopicQuestion(AssistantIntent intent, ParsedAssistantQuery parsed, string portal) =>
        intent == AssistantIntent.GetTopicInsight && parsed.GradeLevel is not null && parsed.SectionName is not null
        && portal is "teacher" or "admin" or "administrative";

    private static string ClassKey(string className) =>
        className.Trim().ToLowerInvariant().Replace('/', '-').Replace(" ", string.Empty);

    /// <summary>Sorudaki sınıfın kayıtlı adı; kapsam dışıysa Denied.</summary>
    private async Task<(string? ClassName, bool Denied)> ResolveStaffClassAsync(AssistantRequestContext context, string portal, ParsedAssistantQuery parsed, CancellationToken ct)
    {
        var wanted = ClassKey($"{parsed.GradeLevel}-{parsed.SectionName}");
        var stored = (await db.Students.AsNoTracking().Select(x => x.ClassName).Distinct().ToListAsync(ct))
            .FirstOrDefault(name => ClassKey(name) == wanted);
        if (stored is null) return (null, false);
        if (portal == "teacher")
        {
            var mine = await TeacherClassesAsync(context, ct);
            if (!mine.Any(name => ClassKey(name) == wanted)) return (null, true);
        }
        return (stored, false);
    }

    private async Task<AssistantResponseDto> ClassTopicInsightAsync(AssistantRequestContext context, Guid conversationId, ParsedAssistantQuery parsed, string portal, AssistantVoice voice, CancellationToken ct)
    {
        var (className, denied) = await ResolveStaffClassAsync(context, portal, parsed, ct);
        if (denied)
            return Build(conversationId, "permission_denied", L(voice, "Bu sınıf ders programınızda görünmüyor; yalnız ders verdiğiniz sınıfların analizine bakabilirim.",
                "This class isn't in your timetable; I can only analyse the classes you teach."), null, AssistantIntent.GetTopicInsight);
        var insight = className is null ? null : await insights.GetClassAsync(className, ct);
        if (insight is null || insight.Solved == 0)
            return Build(conversationId, "text", L(voice, "Bu sınıf için henüz konu verisi yok; öğrenciler sınav ya da soru bankası çalıştıkça öneri verebilirim.",
                "There's no topic data for this class yet; I can recommend once students take exams or practise."), null, AssistantIntent.GetTopicInsight);

        var actions = insight.Actions ?? [];
        var text = ClassActionsSentence(voice, insight.ClassName, actions)
            ?? L(voice, $"{insight.ClassName} için sınıf düzeyinde ortak bir zorluk görünmüyor; öğrenci bazındaki önerilere konu analizinden bakabilirsiniz.",
                $"No shared difficulty in {insight.ClassName}; see per-student recommendations in topic analysis.");
        return Build(conversationId, "text", text, new { className = insight.ClassName, actions }, AssistantIntent.GetTopicInsight,
            [new("navigate", L(voice, "Konu analizini aç", "Open topic analysis"), RoleRoute(portal, "insights"), null, null)]);
    }

    /// <summary>"10-A için önerim: Basınç ve Cümle Bilgisi konularında sınıf tekrarı; Üslü Sayılar için 4 kişilik etüt grubu."</summary>
    private static string? ClassActionsSentence(AssistantVoice voice, string className, IReadOnlyList<ClassActionDto> actions)
    {
        if (actions.Count == 0) return null;
        var reviews = actions.Where(item => item.Kind == "class_review").Select(item => item.Topic).ToList();
        var groups = actions.Where(item => item.Kind == "study_group").ToList();
        var parts = new List<string>();
        if (reviews.Count > 0)
            parts.Add(L(voice, $"{JoinTr(reviews)} {(reviews.Count == 1 ? "konusunda" : "konularında")} sınıf tekrarı", $"a class review of {string.Join(", ", reviews)}"));
        foreach (var group in groups.Take(2))
            parts.Add(L(voice, $"{group.Topic} için {group.StrugglingStudentCount} kişilik etüt grubu ({string.Join(", ", group.StudentNames)})",
                $"a {group.StrugglingStudentCount}-student study group for {group.Topic} ({string.Join(", ", group.StudentNames)})"));
        return L(voice, $"{className} için önerim: {string.Join("; ", parts)}.", $"My recommendation for {className}: {string.Join("; ", parts)}.");
    }

    private static string JoinTr(IReadOnlyList<string> items) => items.Count switch
    {
        0 => string.Empty,
        1 => items[0],
        _ => string.Join(", ", items.Take(items.Count - 1)) + " ve " + items[^1],
    };

    // ── Haftalık özet maddeleri ────────────────────────────────────────────

    /// <summary>Öğretmen: ders verdiği sınıflardan en çok önerisi olan iki sınıf. Etüt grubu adları maddede yazılmaz.</summary>
    private async Task TeacherDigestAsync(AssistantRequestContext context, AssistantVoice voice, List<AssistantBriefingItemDto> items, CancellationToken ct)
    {
        if (!await CanAsync(context, AssistantIntent.GetTopicInsight, ct)) return;
        var classes = await ClassDigestsAsync(context, "teacher", await TeacherClassesAsync(context, ct), ct);
        foreach (var digest in classes.Where(item => item.Actions.Count > 0).OrderByDescending(item => item.Actions.Count(a => a.Kind == "class_review")).ThenByDescending(item => item.Actions.Count).Take(2))
            items.Add(new(ClassDigestLine(voice, digest), ToneWarn, L(voice, $"{digest.ClassName} sınıfının zayıf konuları", $"{digest.ClassName} class weak topics")));
    }

    /// <summary>Yönetici: en çok desteğe ihtiyaç duyan sınıflar ve haftalık devamsızlık değişimi.</summary>
    private async Task AdminDigestAsync(AssistantRequestContext context, AssistantVoice voice, List<AssistantBriefingItemDto> items, CancellationToken ct)
    {
        if (await CanAsync(context, AssistantIntent.GetTopicInsight, ct))
        {
            var allClasses = (await db.Students.AsNoTracking().Select(x => x.ClassName).Distinct().ToListAsync(ct))
                .Where(name => !string.IsNullOrWhiteSpace(name)).ToList();
            var needy = (await ClassDigestsAsync(context, "admin", allClasses, ct))
                .Select(item => (item.ClassName, Reviews: item.Actions.Count(a => a.Kind == "class_review")))
                .Where(item => item.Reviews > 0)
                .OrderByDescending(item => item.Reviews).ThenBy(item => item.ClassName, StringComparer.Ordinal)
                .Take(3).ToList();
            if (needy.Count > 0)
            {
                var list = string.Join(", ", needy.Select(item => L(voice, $"{item.ClassName} ({item.Reviews} konu)", $"{item.ClassName} ({item.Reviews} topics)")));
                items.Add(new(L(voice, $"Sınıf tekrarı önerdiğim sınıflar: {list}.", $"Classes where I recommend a class review: {list}."),
                    ToneWarn, L(voice, $"{needy[0].ClassName} sınıfının zayıf konuları", $"{needy[0].ClassName} class weak topics")));
            }
        }
        if (await CanAsync(context, AssistantIntent.ListAbsentStudents, ct))
        {
            var (thisWeek, lastWeek) = await WeeklyAbsencesAsync(null, ct);
            if (thisWeek >= AbsenceTrendMinimum && thisWeek >= lastWeek + AbsenceTrendMinimum)
                items.Add(new(L(voice, $"Son 7 günde {thisWeek} ders devamsızlık var; önceki 7 günde {lastWeek} idi.",
                    $"{thisWeek} missed lessons in the last 7 days, up from {lastWeek} the week before."), ToneWarn,
                    L(voice, "Bugün devamsız olanlar", "Absent today")));
        }
    }

    /// <summary>Veli: çocuğun bu haftaki devamsızlığı geçen haftayla ve önce çalışılacak konu (soru sayısıyla).</summary>
    private async Task ParentChildDigestAsync(AssistantRequestContext context, AssistantVoice voice, StudentCandidate child, string first, List<AssistantBriefingItemDto> items, bool canAttendance, CancellationToken ct)
    {
        if (canAttendance)
        {
            var (thisWeek, lastWeek) = await WeeklyAbsencesAsync(child, ct);
            if (thisWeek > 0)
                items.Add(new(L(voice, $"{first} son 7 günde {thisWeek} ders devamsız (önceki 7 günde {lastWeek}).",
                    $"{first} missed {thisWeek} lessons in the last 7 days ({lastWeek} the week before)."), ToneWarn,
                    L(voice, $"{child.FullName} devamsızlığı", $"{child.FullName} attendance")));
        }
        if (await CanAsync(context, AssistantIntent.GetTopicInsight, ct))
        {
            var topTopic = (await insights.GetStudentAsync(child.UserId, ct))?.WeakTopics.FirstOrDefault();
            if (topTopic?.SuggestedQuestions is int questions)
                items.Add(new(L(voice, $"{first} için bu haftaki önerim: {topTopic.Topic} konusundan {questions} soru, birkaç güne bölerek.",
                    $"This week for {first}: {questions} questions on {topTopic.Topic}, spread over a few days."), ToneInfo,
                    L(voice, $"{child.FullName} hangi konulara çalışmalı", $"Which topics should {child.FullName} study")));
        }
    }

    private static string ClassDigestLine(AssistantVoice voice, ClassDigest digest)
    {
        var reviews = digest.Actions.Where(a => a.Kind == "class_review").Select(a => a.Topic).ToList();
        var groups = digest.Actions.Count(a => a.Kind == "study_group");
        var parts = new List<string>();
        if (reviews.Count > 0) parts.Add(L(voice, $"{JoinTr(reviews)} {(reviews.Count == 1 ? "konusunda" : "konularında")} sınıf tekrarı", $"a class review of {string.Join(", ", reviews)}"));
        if (groups > 0) parts.Add(L(voice, $"{groups} etüt grubu", $"{groups} study group(s)"));
        return L(voice, $"{digest.ClassName} için önerim: {string.Join(" ve ", parts)}.", $"For {digest.ClassName} I recommend {string.Join(" and ", parts)}.");
    }

    /// <summary>Sınıf önerileri; (kurum, kullanıcı, portal) anahtarıyla kısa süre önbellekte.</summary>
    private async Task<IReadOnlyList<ClassDigest>> ClassDigestsAsync(AssistantRequestContext context, string portal, IReadOnlyCollection<string> classes, CancellationToken ct)
    {
        var key = (context.TenantId, context.UserId, portal);
        if (DigestCache.TryGetValue(key, out var cached) && cached.ExpiresUtc > DateTime.UtcNow) return cached.Classes;
        var result = new List<ClassDigest>();
        foreach (var className in classes.Distinct(StringComparer.Ordinal).Take(40))
        {
            var insight = await insights.GetClassAsync(className, ct);
            if (insight?.Actions is { Count: > 0 } actions) result.Add(new ClassDigest(insight.ClassName, actions));
        }
        DigestCache[key] = (result, DateTime.UtcNow.Add(DigestCacheTtl));
        return result;
    }

    /// <summary>Son 7 gün ve önceki 7 gündeki devamsız ders sayısı (Türkiye günü). Öğrenci verilirse kimlikle, eski kayıtta adla.</summary>
    private async Task<(int ThisWeek, int LastWeek)> WeeklyAbsencesAsync(StudentCandidate? student, CancellationToken ct)
    {
        var today = DateTime.SpecifyKind(AssistantDates.TodayTr, DateTimeKind.Utc);
        var weekStart = today.AddDays(-6);
        var previousStart = weekStart.AddDays(-7);
        var query = db.AttendanceEntries.AsNoTracking().Where(x => x.LessonDate >= previousStart && x.LessonDate <= today.AddDays(1));
        if (student is not null)
            query = query.Where(x => x.StudentId == student.Id || (x.StudentId == null && x.StudentName == student.FullName));
        var rows = await query.Select(x => new { x.LessonDate, x.Status }).ToListAsync(ct);
        var absent = rows.Where(x => AttendanceStatusMatcher.IsAbsent(x.Status)).ToList();
        return (absent.Count(x => x.LessonDate.Date >= weekStart), absent.Count(x => x.LessonDate.Date < weekStart));
    }

    /// <summary>Uyarılar önce gelecek şekilde en fazla <see cref="MaxBriefingItems"/> madde; sıra korunur.</summary>
    private static List<AssistantBriefingItemDto> CapBriefing(List<AssistantBriefingItemDto> items)
    {
        if (items.Count <= MaxBriefingItems) return items;
        var keep = items.Where(item => item.Tone == ToneWarn).Take(MaxBriefingItems).ToHashSet();
        foreach (var item in items.Where(item => item.Tone != ToneWarn))
        {
            if (keep.Count >= MaxBriefingItems) break;
            keep.Add(item);
        }
        return items.Where(keep.Contains).ToList();
    }
}
