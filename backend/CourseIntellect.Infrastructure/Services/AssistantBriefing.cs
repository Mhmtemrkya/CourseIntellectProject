using System.Text.Json;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistanın günlük brifingi, cevap geri bildirimi ve yönetici için "cevaplanamayan sorular" listesi.
/// Brifing satırları sohbetteki sorularla aynı kapılardan geçer (rol izni, kurum türü, paket):
/// kullanıcı soramayacağı bir bilgiyi brifingde de görmez.
/// </summary>
public sealed partial class AssistantService
{
    private const string ToneInfo = "info";
    private const string ToneWarn = "warn";
    private const string ToneGood = "good";

    public async Task<AssistantBriefingDto> GetBriefingAsync(AssistantRequestContext context, CancellationToken cancellationToken)
    {
        var voice = Voice(context, Guid.NewGuid());
        var items = new List<AssistantBriefingItemDto>();
        var ask = (string tr, string en) => voice.English ? en : tr;

        switch (voice.Portal)
        {
            case "student":
                await StudentBriefingAsync(context, voice, items, ask, cancellationToken);
                break;
            case "parent":
                await ParentBriefingAsync(context, voice, items, ask, cancellationToken);
                break;
            case "teacher":
                if (await CanAsync(context, AssistantIntent.GetSchedule, cancellationToken))
                {
                    var lessons = await TodayLessonsAsync(db.TeacherTimetableSlots.AsNoTracking().Where(x => x.TeacherUserId == context.UserId), cancellationToken);
                    items.Add(new(voice.BriefingLessons(lessons.Count, lessons.FirstOrDefault()), ToneInfo, ask("Bugünkü derslerim", "My lessons today")));
                }
                if (await CanAsync(context, AssistantIntent.ListAbsentStudents, cancellationToken))
                {
                    var classes = await TeacherClassesAsync(context, cancellationToken);
                    if (classes.Count > 0)
                    {
                        var absent = await AbsentTodayAsync(classes, cancellationToken);
                        items.Add(new(voice.BriefingAbsentToday(absent, true), absent > 0 ? ToneWarn : ToneGood, absent > 0 ? ask("Bugün devamsız olanlar", "Absent today") : null));
                    }
                }
                await AtRiskBriefingAsync(context, voice, items, ask, cancellationToken);
                await TeacherDigestAsync(context, voice, items, cancellationToken);
                break;
            case "admin":
            case "administrative":
                if (await CanAsync(context, AssistantIntent.ListAbsentStudents, cancellationToken))
                {
                    var absent = await AbsentTodayAsync(null, cancellationToken);
                    items.Add(new(voice.BriefingAbsentToday(absent, false), absent > 0 ? ToneWarn : ToneGood, absent > 0 ? ask("Bugün devamsız olanlar", "Absent today") : null));
                }
                if (voice.Portal == "admin")
                {
                    await AtRiskBriefingAsync(context, voice, items, ask, cancellationToken);
                    await AdminDigestAsync(context, voice, items, cancellationToken);
                    await FinanceBriefingAsync(context, voice, items, ask, cancellationToken);
                }
                break;
            case "accounting":
                await FinanceBriefingAsync(context, voice, items, ask, cancellationToken);
                break;
        }

        // Söylenecek bir şey yoksa sessiz kalmak yerine bunu açıkça söyler; olumlu satırlar zaten varsa tekrarlamaz.
        if (items.Count == 0)
            items.Add(new(voice.BriefingAllClear(), ToneGood, null));
        return new AssistantBriefingDto(voice.BriefingGreeting(), CapBriefing(items));
    }

    private async Task StudentBriefingAsync(AssistantRequestContext context, AssistantVoice voice, List<AssistantBriefingItemDto> items, Func<string, string, string> ask, CancellationToken ct)
    {
        var me = await db.Students.AsNoTracking().Where(x => x.UserId == context.UserId).Select(ToStudentCandidate()).FirstOrDefaultAsync(ct);
        if (me is null) return;
        if (await CanAsync(context, AssistantIntent.GetSchedule, ct))
        {
            var lessons = await TodayLessonsAsync(db.TeacherTimetableSlots.AsNoTracking().Where(x => x.ClassName == me.ClassName), ct);
            items.Add(new(voice.BriefingLessons(lessons.Count, lessons.FirstOrDefault()), ToneInfo, ask("Bugün hangi derslerim var?", "What lessons do I have today?")));
        }
        if (await CanAsync(context, AssistantIntent.GetHomework, ct))
        {
            var (count, nearest, deadline) = await PendingHomeworkAsync(me, ct);
            if (count > 0) items.Add(new(voice.BriefingHomework(null, count, nearest, deadline), ToneWarn, ask("Bekleyen ödevlerim", "My pending homework")));
        }
        if (await CanAsync(context, AssistantIntent.GetTopicInsight, ct))
        {
            var insight = await insights.GetStudentAsync(me.UserId, ct);
            var weakest = insight?.WeakTopics.FirstOrDefault();
            if (weakest is not null)
            {
                var plan = weakest.SuggestedQuestions is int questions
                    ? ask($" Bu hafta {questions} soru çözmeyi hedefleyebilirsin.", $" Aim for {questions} questions this week.")
                    : string.Empty;
                items.Add(new(voice.BriefingWeakTopic(weakest.Topic, weakest.Subject) + plan, ToneInfo, ask("Hangi konulara çalışmalıyım?", "Which topics should I study?")));
            }
        }
    }

    private async Task ParentBriefingAsync(AssistantRequestContext context, AssistantVoice voice, List<AssistantBriefingItemDto> items, Func<string, string, string> ask, CancellationToken ct)
    {
        var children = (await ParentChildrenAsync(context, ct)).Take(3).ToList();
        var canAttendance = await CanAsync(context, AssistantIntent.GetAttendance, ct);
        var canHomework = await CanAsync(context, AssistantIntent.GetHomework, ct);
        foreach (var child in children)
        {
            var first = child.FullName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? child.FullName;
            // Devamsızlık (kimlikle, geçen haftayla karşılaştırmalı) ve önce çalışılacak konu.
            var before = items.Count;
            await ParentChildDigestAsync(context, voice, child, first, items, canAttendance, ct);
            var quiet = items.Skip(before).All(item => item.Tone != ToneWarn);
            if (canHomework)
            {
                var (count, nearest, deadline) = await PendingHomeworkAsync(child, ct);
                if (count > 0)
                {
                    quiet = false;
                    items.Add(new(voice.BriefingHomework(first, count, nearest, deadline), ToneInfo, ask($"{child.FullName} bekleyen ödevleri", $"{child.FullName} pending homework")));
                }
            }
            if (quiet && (canAttendance || canHomework)) items.Add(new(voice.BriefingChildClear(first), ToneGood, null));
        }
    }

    private async Task FinanceBriefingAsync(AssistantRequestContext context, AssistantVoice voice, List<AssistantBriefingItemDto> items, Func<string, string, string> ask, CancellationToken ct)
    {
        if (!await CanAsync(context, AssistantIntent.GetFinanceOverview, ct)) return;
        var localNow = DateTime.UtcNow.AddHours(3);
        // Türkiye gününün başı/sonu UTC olarak (Postgres timestamptz Kind=Utc ister).
        var dayStartUtc = DateTime.SpecifyKind(localNow.Date.AddHours(-3), DateTimeKind.Utc);
        var dayEndUtc = dayStartUtc.AddDays(1);
        var monthStartUtc = DateTime.SpecifyKind(new DateTime(localNow.Year, localNow.Month, 1, 0, 0, 0).AddHours(-3), DateTimeKind.Utc);

        var open = db.FinanceInstallments.AsNoTracking().Where(x => x.Amount > x.PaidAmount);
        var dueToday = await open.Where(x => x.DueDateUtc >= dayStartUtc && x.DueDateUtc < dayEndUtc)
            .Select(x => x.Amount - x.PaidAmount).ToListAsync(ct);
        var overdue = await open.Where(x => x.DueDateUtc < dayStartUtc)
            .Select(x => x.Amount - x.PaidAmount).ToListAsync(ct);
        var collected = await db.FinancePayments.AsNoTracking().Where(x => x.PaidAtUtc >= monthStartUtc).SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;

        if (dueToday.Count > 0) items.Add(new(voice.BriefingDueToday(dueToday.Count, dueToday.Sum()), ToneInfo, ask("Borcu olan öğrenciler", "Students with debt")));
        if (overdue.Count > 0) items.Add(new(voice.BriefingOverdue(overdue.Count, overdue.Sum()), ToneWarn, ask("Borcu olan öğrenciler", "Students with debt")));
        items.Add(new(voice.BriefingCollected(collected), ToneInfo, ask("Bu ay tahsilat", "Collections this month")));
    }

    /// <summary>Erken uyarı: risk altındaki öğrenci varsa tek satır; yoksa satır eklenmez (gürültü olmasın).</summary>
    private async Task AtRiskBriefingAsync(AssistantRequestContext context, AssistantVoice voice, List<AssistantBriefingItemDto> items, Func<string, string, string> ask, CancellationToken ct)
    {
        if (!await CanAsync(context, AssistantIntent.GetAtRiskStudents, ct)) return;
        var count = await AtRiskCountAsync(context, voice.Portal, ct);
        if (count > 0) items.Add(new(voice.BriefingAtRisk(count, voice.Portal == "teacher"), ToneWarn, ask("Risk altındaki öğrenciler", "Students at risk")));
    }

    /// <summary>Sohbetteki soruyla aynı kapı: kurum türü + rol izni + paket.</summary>
    private async Task<bool> CanAsync(AssistantRequestContext context, AssistantIntent intent, CancellationToken ct)
    {
        if (!AssistantIntentCatalog.IsAvailableFor(intent, await ResolveInstitutionTypeAsync(context, ct))) return false;
        if (!AssistantIntentCatalog.IsAllowedForRole(intent, context.PrimaryRole)) return false;
        return AssistantIntentCatalog.RequiredModule(intent) is not { } module || await entitlementService.IsAllowedAsync(context.Principal, module, "view", ct);
    }

    private static async Task<List<string>> TodayLessonsAsync(IQueryable<Domain.Entities.TeacherTimetableSlot> slots, CancellationToken ct)
    {
        var localDay = (int)DateTime.UtcNow.AddHours(3).DayOfWeek;
        var todayIndex = localDay == 0 ? 7 : localDay;
        return await slots.Where(x => x.DayOfWeek == todayIndex).OrderBy(x => x.StartTime)
            .Select(x => x.StartTime + " " + x.Lesson).ToListAsync(ct);
    }

    private async Task<int> AbsentTodayAsync(IReadOnlyCollection<string>? classes, CancellationToken ct)
    {
        // Yoklama günü Türkiye gününe göre yazılır; UTC günüyle gece 00:00–03:00 arası dün sayılıyordu.
        var today = AssistantDates.TodayTr;
        var rows = await db.AttendanceEntries.AsNoTracking()
            .Where(x => x.LessonDate >= today && x.LessonDate < today.AddDays(1))
            .Select(x => new { x.StudentName, x.Status }).ToListAsync(ct);
        var names = rows.Where(x => AttendanceStatusMatcher.IsAbsent(x.Status)).Select(x => x.StudentName).Distinct().ToList();
        if (names.Count == 0) return 0;
        var students = db.Students.AsNoTracking().Where(x => names.Contains(x.FullName));
        if (classes is not null) students = students.Where(x => classes.Contains(x.ClassName));
        return await students.CountAsync(ct);
    }

    private async Task<(int Count, string? Nearest, string? Deadline)> PendingHomeworkAsync(StudentCandidate student, CancellationToken ct)
    {
        var submitted = db.HomeworkSubmissions.AsNoTracking().Where(x => x.StudentName == student.FullName).Select(x => x.AssignmentId);
        var today = AssistantDates.TodayTr;
        var rows = (await db.HomeworkAssignments.AsNoTracking()
            .Where(x => x.ClassName == student.ClassName && !submitted.Contains(x.Id))
            .Select(x => new { x.Title, x.DeadlineLabel }).Take(200).ToListAsync(ct))
            .Select(x => (x.Title, x.DeadlineLabel, Due: AssistantDates.TryParse(x.DeadlineLabel)))
            .OrderBy(x => x.Due is null ? 2 : x.Due < today ? 1 : 0).ThenBy(x => x.Due)
            .ToList();
        var first = rows.FirstOrDefault();
        return (rows.Count, first.Title, first.Due is DateTime due ? AssistantDates.Short(due) : first.DeadlineLabel);
    }

    // ── Geri bildirim ve cevaplanamayan sorular ─────────────────────────────

    public async Task<bool> SetFeedbackAsync(AssistantRequestContext context, Guid messageId, bool helpful, CancellationToken cancellationToken)
    {
        var message = await db.AssistantMessages
            .SingleOrDefaultAsync(x => x.Id == messageId && x.UserId == context.UserId && x.SenderType == AssistantSenderType.Assistant, cancellationToken);
        if (message is null) return false;
        message.Feedback = helpful ? (short)1 : (short)-1;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// Asistanın anlamadığı, rehberi olmayan ya da "işe yaramadı" işaretlenen sorular. Yöneticinin
    /// eksik kalıpları görmesi içindir; soranın adı gösterilmez, yalnız portalı.
    /// Kurum filtresi sorgu filtresinden, şube kapsamı sohbet tablosunun filtresinden gelir.
    /// </summary>
    public async Task<IReadOnlyList<AssistantUnansweredDto>> GetUnansweredAsync(AssistantRequestContext context, int days, CancellationToken cancellationToken)
    {
        var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 90));
        var conversations = db.AssistantConversations.AsNoTracking();
        var answers = await db.AssistantMessages.AsNoTracking()
            .Where(x => x.SenderType == AssistantSenderType.Assistant && x.CreatedAtUtc >= since && x.ClientMessageId != null)
            .Where(x => x.Intent == AssistantIntent.Unknown || x.Intent == AssistantIntent.HowTo || x.Intent == AssistantIntent.OutOfScope || x.Feedback == -1)
            .Join(conversations, message => message.ConversationId, conversation => conversation.Id, (message, conversation) => new { message, conversation.Portal })
            .OrderByDescending(x => x.message.CreatedAtUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        var flagged = answers
            .Select(x => (x.message, x.Portal, Reason: x.message.Feedback == -1 ? "negative"
                : x.message.Intent == AssistantIntent.Unknown ? "unknown"
                : x.message.Intent == AssistantIntent.OutOfScope ? "out_of_scope"
                : HowToMissing(x.message) ? "no_guide" : null))
            .Where(x => x.Reason is not null)
            .Take(200)
            .ToList();
        if (flagged.Count == 0) return [];

        var keys = flagged.Select(x => x.message.ClientMessageId!.Value).Distinct().ToList();
        var questions = await db.AssistantMessages.AsNoTracking()
            .Where(x => x.SenderType == AssistantSenderType.User && x.ClientMessageId != null && keys.Contains(x.ClientMessageId.Value))
            .Select(x => new { x.ConversationId, x.ClientMessageId, x.Text })
            .ToListAsync(cancellationToken);

        return flagged
            .Select(x => new AssistantUnansweredDto(
                x.message.Id,
                questions.FirstOrDefault(q => q.ConversationId == x.message.ConversationId && q.ClientMessageId == x.message.ClientMessageId)?.Text ?? string.Empty,
                x.message.Text,
                x.Reason!,
                x.Portal,
                x.message.CreatedAtUtc))
            .Where(x => x.Question.Length > 0)
            .ToList();
    }

    /// <summary>"Nasıl yapılır" sorusuna rehber bulunamadıysa cevap düz metindir (rehber varsa how_to kartı).</summary>
    private static bool HowToMissing(Domain.Entities.AssistantMessage message)
    {
        if (message.Intent != AssistantIntent.HowTo) return false;
        try { return JsonSerializer.Deserialize<StoredPayload>(message.StructuredPayloadJson, JsonOptions) is { Type: "text", Data: null }; }
        catch (JsonException) { return false; }
    }
}
