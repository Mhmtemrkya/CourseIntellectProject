using CourseIntellect.Application.DTOs.Duty;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class TeacherDutyService(
    CourseIntellectDbContext dbContext,
    INotificationService notificationService,
    IAuditLogService auditLogService) : ITeacherDutyService
{
    public async Task<CreateDutyResult> CreateAsync(
        CreateDutyRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var teachers = (request.Teachers ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item.TeacherName) || item.TeacherUserId is not null)
            .ToList();
        if (teachers.Count == 0)
        {
            throw new InvalidOperationException("En az bir öğretmen seçilmelidir.");
        }

        var startMin = ParseMinutes(request.StartTime);
        var endMin = ParseMinutes(request.EndTime);
        if (startMin < 0 || endMin < 0 || endMin <= startMin)
        {
            throw new InvalidOperationException("Bitiş saati başlangıçtan sonra olmalıdır.");
        }

        var baseDate = DateTime.SpecifyKind(request.DutyDate.Date, DateTimeKind.Utc);
        if (baseDate < DateTime.UtcNow.Date)
        {
            throw new InvalidOperationException("Geçmiş bir tarihe nöbet oluşturulamaz.");
        }

        var weeks = request.RepeatWeekly ? Math.Clamp(request.RepeatWeeks, 1, 20) : 1;
        var dates = Enumerable.Range(0, weeks).Select(i => baseDate.AddDays(7 * i)).ToList();
        var dateSet = dates.ToHashSet();

        // Mevcut çakışmaları tek seferde çek (ilgili öğretmenler + tarihler).
        var teacherIds = teachers.Where(t => t.TeacherUserId != null).Select(t => t.TeacherUserId!.Value).ToHashSet();
        var teacherNames = teachers.Select(t => t.TeacherName.Trim()).Where(n => n != string.Empty).ToHashSet();
        var existing = await dbContext.TeacherDuties.AsNoTracking()
            .Where(d => d.Status != "İptal Edildi"
                && dateSet.Contains(d.DutyDateUtc)
                && ((d.TeacherUserId != null && teacherIds.Contains(d.TeacherUserId.Value))
                    || teacherNames.Contains(d.TeacherName)))
            .Select(d => new { d.TeacherUserId, d.TeacherName, d.DutyDateUtc, d.StartTime, d.EndTime })
            .ToListAsync(cancellationToken);

        // Ders-saati çakışması için ilgili öğretmenlerin haftalık programını çek.
        var timetable = await dbContext.TeacherTimetableSlots.AsNoTracking()
            .Where(s => (s.TeacherUserId != null && teacherIds.Contains(s.TeacherUserId.Value))
                || teacherNames.Contains(s.TeacherName))
            .Select(s => new { s.TeacherUserId, s.TeacherName, s.DayOfWeek, s.StartTime, s.EndTime })
            .ToListAsync(cancellationToken);

        bool SameTeacher(Guid? id, string name, Guid? oid, string oname) =>
            (id != null && oid != null && id == oid) || (string.Equals(name.Trim(), oname.Trim(), StringComparison.OrdinalIgnoreCase));

        // C# DayOfWeek (Paz=0..Cmt=6) → 1=Pzt..7=Paz
        static int IsoDayOfWeek(DateTime date) => ((int)date.DayOfWeek + 6) % 7 + 1;

        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var toCreate = new List<TeacherDuty>();
        var conflicts = new List<DutyConflictDto>();

        foreach (var date in dates)
        {
            foreach (var teacher in teachers)
            {
                var name = teacher.TeacherName.Trim();
                // Mevcut DB çakışması
                var dbConflict = existing.Any(e => e.DutyDateUtc == date
                    && SameTeacher(teacher.TeacherUserId, name, e.TeacherUserId, e.TeacherName)
                    && Overlaps(startMin, endMin, ParseMinutes(e.StartTime), ParseMinutes(e.EndTime)));
                // Aynı parti içi çakışma
                var batchConflict = toCreate.Any(c => c.DutyDateUtc == date
                    && SameTeacher(teacher.TeacherUserId, name, c.TeacherUserId, c.TeacherName)
                    && Overlaps(startMin, endMin, ParseMinutes(c.StartTime), ParseMinutes(c.EndTime)));

                if (dbConflict || batchConflict)
                {
                    conflicts.Add(new DutyConflictDto(name, date, request.StartTime, request.EndTime, "Başka nöbet"));
                    continue;
                }

                // Ders-saati çakışması (öğretmenin o gün/saat dersi var mı)
                var dow = IsoDayOfWeek(date);
                var lessonConflict = timetable.Any(s => s.DayOfWeek == dow
                    && SameTeacher(teacher.TeacherUserId, name, s.TeacherUserId, s.TeacherName)
                    && Overlaps(startMin, endMin, ParseMinutes(s.StartTime), ParseMinutes(s.EndTime)));
                if (lessonConflict)
                {
                    conflicts.Add(new DutyConflictDto(name, date, request.StartTime, request.EndTime, "Ders saati"));
                    continue;
                }

                toCreate.Add(new TeacherDuty
                {
                    GroupId = groupId,
                    DutyType = string.IsNullOrWhiteSpace(request.DutyType) ? "Sabah Nöbeti" : request.DutyType.Trim(),
                    Location = request.Location?.Trim() ?? string.Empty,
                    DutyDateUtc = date,
                    Day = request.Day?.Trim() ?? string.Empty,
                    StartTime = request.StartTime.Trim(),
                    EndTime = request.EndTime.Trim(),
                    Description = request.Description?.Trim() ?? string.Empty,
                    Status = "Planlandı",
                    TeacherUserId = teacher.TeacherUserId,
                    TeacherName = name,
                    TeacherUsername = teacher.TeacherUsername?.Trim() ?? string.Empty,
                    TeacherBranch = teacher.TeacherBranch?.Trim() ?? string.Empty,
                    CreatedByUserId = actorUserId,
                    CreatedByName = string.IsNullOrWhiteSpace(actorName) ? "Bilinmiyor" : actorName.Trim(),
                    CreatedAtUtc = now,
                });
            }
        }

        if (toCreate.Count > 0)
        {
            await dbContext.TeacherDuties.AddRangeAsync(toCreate, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            await NotifyTeachersAsync(toCreate, cancellationToken);
            await SafeAuditAsync(actorUserId, actorName, "Nöbet oluşturuldu", groupId.ToString(),
                $"{toCreate.Count} nöbet · {toCreate.Select(d => d.TeacherName).Distinct().Count()} öğretmen · {request.Location}", cancellationToken);
        }

        return new CreateDutyResult(toCreate.Select(Map).ToList(), conflicts);
    }

    private async Task NotifyTeachersAsync(List<TeacherDuty> duties, CancellationToken cancellationToken)
    {
        // Öğretmen başına tek bildirim (tekrar eden nöbetlerde spam olmasın).
        var groups = duties
            .Where(d => !string.IsNullOrWhiteSpace(d.TeacherUsername))
            .GroupBy(d => d.TeacherUsername);
        foreach (var group in groups)
        {
            var items = group.OrderBy(d => d.DutyDateUtc).ToList();
            var first = items.First();
            var dateLabel = first.DutyDateUtc.ToLocalTime().ToString("dd.MM.yyyy");
            var message = items.Count > 1
                ? "{0} tarihinden itibaren {1} nöbet atandı: {2} · {3}-{4}".FormatWith(dateLabel, items.Count, first.Location, first.StartTime, first.EndTime)
                : "{0} · {1} · {2}-{3}".FormatWith(dateLabel, first.Location, first.StartTime, first.EndTime);
            try
            {
                await notificationService.CreateNotificationAsync(
                    new CreateNotificationRequest("Yeni nöbet atandı", message, "Şimdi", group.Key, "Teacher", "Duty"),
                    cancellationToken);
            }
            catch
            {
                // Bildirim hatası nöbet oluşturmayı bozmaz.
            }
        }
    }

    public async Task<IReadOnlyList<DutyResponse>> GetMineAsync(
        Guid? teacherUserId,
        string teacherName,
        string scope,
        CancellationToken cancellationToken = default)
    {
        var name = (teacherName ?? string.Empty).Trim();
        var query = dbContext.TeacherDuties.AsNoTracking().Where(item =>
            (teacherUserId != null && item.TeacherUserId == teacherUserId)
            || (name != string.Empty && item.TeacherName == name));

        var today = DateTime.UtcNow.Date;
        if (string.Equals(scope, "upcoming", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(item => item.DutyDateUtc >= today).OrderBy(item => item.DutyDateUtc);
        }
        else if (string.Equals(scope, "past", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(item => item.DutyDateUtc < today).OrderByDescending(item => item.DutyDateUtc);
        }
        else
        {
            query = query.OrderBy(item => item.DutyDateUtc);
        }

        return (await query.ToListAsync(cancellationToken)).Select(Map).ToList();
    }

    public async Task<DutyStatsResponse> GetMineStatsAsync(
        Guid? teacherUserId,
        string teacherName,
        CancellationToken cancellationToken = default)
    {
        var name = (teacherName ?? string.Empty).Trim();
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        var items = await dbContext.TeacherDuties.AsNoTracking()
            .Where(item =>
                ((teacherUserId != null && item.TeacherUserId == teacherUserId)
                    || (name != string.Empty && item.TeacherName == name))
                && item.DutyDateUtc >= monthStart && item.DutyDateUtc < monthEnd)
            .Select(item => new { item.Status, item.DutyDateUtc })
            .ToListAsync(cancellationToken);

        var total = items.Count;
        var cancelled = items.Count(item => item.Status.Contains("İptal", StringComparison.OrdinalIgnoreCase));
        var completed = items.Count(item =>
            item.Status.Contains("Tamam", StringComparison.OrdinalIgnoreCase)
            || (!item.Status.Contains("İptal", StringComparison.OrdinalIgnoreCase) && item.DutyDateUtc.Date < now.Date));
        var planned = Math.Max(0, total - completed - cancelled);

        return new DutyStatsResponse(total, completed, planned, cancelled);
    }

    public async Task<IReadOnlyList<DutyResponse>> GetAllAsync(DateTime? from, DateTime? to, string? dutyType, CancellationToken cancellationToken = default)
    {
        var query = dbContext.TeacherDuties.AsNoTracking().AsQueryable();
        if (from.HasValue)
        {
            var f = DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc);
            query = query.Where(item => item.DutyDateUtc >= f);
        }
        if (to.HasValue)
        {
            var t = DateTime.SpecifyKind(to.Value.Date, DateTimeKind.Utc).AddDays(1);
            query = query.Where(item => item.DutyDateUtc < t);
        }
        if (!string.IsNullOrWhiteSpace(dutyType))
        {
            var normalized = dutyType.Trim();
            query = query.Where(item => item.DutyType == normalized);
        }

        return (await query.OrderBy(item => item.DutyDateUtc).Take(1000).ToListAsync(cancellationToken))
            .Select(Map).ToList();
    }

    public async Task<IReadOnlyList<TeacherDutyLoadDto>> GetLoadAsync(DateTime? monthStart, CancellationToken cancellationToken = default)
    {
        var query = dbContext.TeacherDuties.AsNoTracking().Where(item => item.Status != "İptal Edildi");
        if (monthStart.HasValue)
        {
            var start = new DateTime(monthStart.Value.Year, monthStart.Value.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddMonths(1);
            query = query.Where(item => item.DutyDateUtc >= start && item.DutyDateUtc < end);
        }

        var rows = await query
            .Select(item => new { item.TeacherUserId, item.TeacherName })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(item => item.TeacherName)
            .Select(group => new TeacherDutyLoadDto(group.First().TeacherUserId, group.Key, group.Count()))
            .OrderByDescending(item => item.Count)
            .ToList();
    }

    public async Task<DutyResponse?> UpdateAsync(Guid id, UpdateDutyRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default)
    {
        var duty = await dbContext.TeacherDuties.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (duty is null) return null;

        var startMin = ParseMinutes(request.StartTime);
        var endMin = ParseMinutes(request.EndTime);
        if (startMin >= 0 && endMin >= 0 && endMin <= startMin)
        {
            throw new InvalidOperationException("Bitiş saati başlangıçtan sonra olmalıdır.");
        }

        duty.DutyType = string.IsNullOrWhiteSpace(request.DutyType) ? duty.DutyType : request.DutyType.Trim();
        duty.Location = request.Location?.Trim() ?? duty.Location;
        duty.DutyDateUtc = DateTime.SpecifyKind(request.DutyDate.Date, DateTimeKind.Utc);
        duty.Day = request.Day?.Trim() ?? duty.Day;
        duty.StartTime = request.StartTime?.Trim() ?? duty.StartTime;
        duty.EndTime = request.EndTime?.Trim() ?? duty.EndTime;
        duty.Description = request.Description?.Trim() ?? string.Empty;
        await dbContext.SaveChangesAsync(cancellationToken);
        await SafeAuditAsync(actorUserId, actorName, "Nöbet güncellendi", duty.Id.ToString(),
            $"{duty.TeacherName} · {duty.DutyType} · {duty.DutyDateUtc:dd.MM.yyyy}", cancellationToken);
        return Map(duty);
    }

    public async Task<DutyResponse?> SetStatusAsync(Guid id, string status, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default)
    {
        var duty = await dbContext.TeacherDuties.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (duty is null) return null;
        var allowed = new[] { "Planlandı", "Tamamlandı", "İptal Edildi" };
        duty.Status = allowed.Contains(status) ? status : duty.Status;
        await dbContext.SaveChangesAsync(cancellationToken);
        await SafeAuditAsync(actorUserId, actorName, $"Nöbet durumu: {duty.Status}", duty.Id.ToString(),
            $"{duty.TeacherName} · {duty.DutyDateUtc:dd.MM.yyyy}", cancellationToken);
        return Map(duty);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default)
    {
        var duty = await dbContext.TeacherDuties.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (duty is null) return false;
        dbContext.TeacherDuties.Remove(duty);
        await dbContext.SaveChangesAsync(cancellationToken);
        await SafeAuditAsync(actorUserId, actorName, "Nöbet silindi", duty.Id.ToString(),
            $"{duty.TeacherName} · {duty.DutyType} · {duty.DutyDateUtc:dd.MM.yyyy}", cancellationToken);
        return true;
    }

    public async Task<int> CancelSeriesAsync(Guid groupId, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default)
    {
        var items = await dbContext.TeacherDuties.Where(item => item.GroupId == groupId).ToListAsync(cancellationToken);
        foreach (var item in items)
        {
            item.Status = "İptal Edildi";
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await SafeAuditAsync(actorUserId, actorName, "Nöbet serisi iptal edildi", groupId.ToString(),
            $"{items.Count} nöbet iptal edildi", cancellationToken);
        return items.Count;
    }

    private async Task SafeAuditAsync(Guid? actorUserId, string actorName, string action, string entityId, string detail, CancellationToken cancellationToken)
    {
        try
        {
            await auditLogService.LogAsync(actorUserId, string.IsNullOrWhiteSpace(actorName) ? "Bilinmiyor" : actorName,
                action, "Duty", "TeacherDuty", entityId, detail, cancellationToken);
        }
        catch
        {
            // Audit hatası ana işlemi bozmaz.
        }
    }

    private static int ParseMinutes(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return -1;
        var parts = value.Split(':');
        if (parts.Length < 2) return -1;
        return int.TryParse(parts[0], out var h) && int.TryParse(parts[1], out var m) ? (h * 60 + m) : -1;
    }

    private static bool Overlaps(int startA, int endA, int startB, int endB)
    {
        if (startA < 0 || endA < 0 || startB < 0 || endB < 0) return false;
        return startA < endB && startB < endA;
    }

    private static DutyResponse Map(TeacherDuty duty) => new(
        duty.Id,
        duty.GroupId,
        duty.DutyType,
        duty.Location,
        duty.DutyDateUtc,
        duty.Day,
        duty.StartTime,
        duty.EndTime,
        duty.Description,
        duty.Status,
        duty.TeacherUserId,
        duty.TeacherName,
        duty.TeacherUsername,
        duty.TeacherBranch,
        duty.CreatedAtUtc);
}

internal static class _DutyStringFormat
{
    public static string FormatWith(this string format, params object[] args) => string.Format(format, args);
}
