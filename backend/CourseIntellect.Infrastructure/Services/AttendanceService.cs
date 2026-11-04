using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AttendanceService(
    CourseIntellectDbContext dbContext,
    IParentNotifier parentNotifier) : IAttendanceService
{
    public async Task<IReadOnlyList<AttendanceEntryDto>> GetAttendanceAsync(
        string? studentName = null,
        string? className = null,
        Guid? studentId = null,
        StudentRecordScope? scope = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<AttendanceEntry>().AsQueryable();

        if (studentId is { } id)
        {
            // Kimlikle bağlı kayıtlar + henüz bağlanamamış (eski) kayıtlarda aynı ad.
            var profileName = await dbContext.Students.AsNoTracking()
                .Where(x => x.Id == id)
                .Select(x => x.FullName)
                .FirstOrDefaultAsync(cancellationToken);
            if (profileName is null) return [];
            var trimmed = profileName.Trim();
            query = query.Where(x => x.StudentId == id || (x.StudentId == null && x.StudentName == trimmed));
        }
        else if (!string.IsNullOrWhiteSpace(studentName))
        {
            // Mobil adı Türkçe karaktersiz gönderebilir ("Ayse"); birebir ad yoksa
            // harf/Türkçe-bağımsız eşleşen profillerin adlarıyla aranır.
            var trimmedName = studentName.Trim();
            var key = StudentIdentityResolver.NameKey(trimmedName);
            var candidateNames = (await dbContext.Students.AsNoTracking().Select(x => x.FullName).ToListAsync(cancellationToken))
                .Where(name => StudentIdentityResolver.NameKey(name) == key)
                .Append(trimmedName)
                .Distinct()
                .ToList();
            query = query.Where(x => candidateNames.Contains(x.StudentName));
        }

        if (scope is not null)
        {
            // Öğrenci/veli kapsamı: kimlikle bağlı kayıtta yalnız kimlik geçerlidir;
            // aynı adlı başka ailenin çocuğunun kaydı veliye görünmez.
            var allowedIds = scope.StudentIds.Select(x => (Guid?)x).ToList();
            var allowedNames = scope.StudentNames.ToList();
            query = query.Where(x =>
                allowedIds.Contains(x.StudentId)
                || (x.StudentId == null && allowedNames.Contains(x.StudentName)));
        }

        if (!string.IsNullOrWhiteSpace(className))
        {
            query = query.Where(x => x.ClassName == className.Trim());
        }

        var rows = await query
            .OrderByDescending(x => x.LessonDate)
            .ThenBy(x => x.Lesson)
            .Select(x => new AttendanceEntryDto(
                x.Id,
                x.StudentName,
                x.ClassName,
                x.LessonDate,
                x.Status,
                x.Lesson,
                x.StudentId))
            .ToListAsync(cancellationToken);

        // Eski/serbest yazımlar ("Geldi", "Gelmedi"…) istemcilere kanonik döner;
        // aksi hâlde "Geldi" kaydı istemcide devamsız sayılıyordu.
        return rows
            .Select(x => x with { Status = AttendanceStatusMatcher.Canonicalize(x.Status) })
            .ToList();
    }

    public async Task<IReadOnlyList<AttendanceEntryDto>> SaveLessonAttendanceAsync(
        SaveAttendanceRequest request,
        CancellationToken cancellationToken = default)
    {
        // Sunucu UTC çalışsa bile yoklama günü TR saatine göre belirlenir.
        var lessonDate = (request.LessonDate ?? DateTime.UtcNow.AddHours(3)).Date;

        var className = request.ClassName.Trim();
        var lesson = request.Lesson.Trim();
        var resolved = await ResolveStudentsAsync(request.Students, className, cancellationToken);

        var listedIds = resolved.Where(x => x.StudentId is not null).Select(x => x.StudentId).Distinct().ToList();
        var listedNames = resolved.Select(x => x.Name).Distinct().ToList();

        // Yalnız istekte gelen öğrencilerin o ders/günkü kaydı değişir. Eskiden
        // sınıfın tüm kayıtları siliniyordu: masaüstünden tek öğrenciye devamsızlık
        // eklemek, aynı ders ve gündeki diğer öğrencilerin yoklamasını yok ediyordu.
        // Kimliği bilinen öğrencide yalnız onun kaydı, bağlanmamış eski kayıtta ad eşleşir.
        var existing = await dbContext.Set<AttendanceEntry>()
            .Where(x =>
                x.ClassName == className &&
                x.Lesson == lesson &&
                x.LessonDate.Date == lessonDate &&
                (listedIds.Contains(x.StudentId) || (x.StudentId == null && listedNames.Contains(x.StudentName))))
            .ToListAsync(cancellationToken);

        dbContext.Set<AttendanceEntry>().RemoveRange(existing);

        var entries = resolved
            .Select(x => new AttendanceEntry
            {
                StudentId = x.StudentId,
                StudentName = x.Name,
                ClassName = className,
                Lesson = lesson,
                LessonDate = lessonDate,
                Status = MapStatus(x.Status)
            })
            .ToList();

        await dbContext.Set<AttendanceEntry>().AddRangeAsync(entries, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Devamsız işaretlenen öğrencilerin velilerine anlık bildirim. Kimlik
        // biliniyorsa veli onunla bulunur; aynı adlı başka öğrencinin velisine gitmez.
        for (var index = 0; index < entries.Count; index++)
        {
            var entry = entries[index];
            if (entry.Status != AttendanceStatusMatcher.Absent) continue;
            await parentNotifier.NotifyStudentParentAsync(
                resolved[index].UserId,
                entry.StudentName,
                "Devamsızlık bildirimi",
                $"{entry.StudentName} bugün {entry.Lesson} dersinde devamsız görünüyor.",
                "AttendanceAlert",
                null,
                cancellationToken);
        }

        return entries
            .OrderBy(x => x.StudentName)
            .Select(x => new AttendanceEntryDto(
                x.Id,
                x.StudentName,
                x.ClassName,
                x.LessonDate,
                x.Status,
                x.Lesson,
                x.StudentId))
            .ToList();
    }

    private sealed record ResolvedStudent(Guid? StudentId, Guid? UserId, string Name, string Status);

    /// <summary>
    /// İstekteki öğrencileri profillere bağlar (bkz. <see cref="StudentIdentityResolver"/>).
    /// Aynı öğrenci iki kez geldiyse sonuncusu geçerlidir.
    /// </summary>
    private async Task<List<ResolvedStudent>> ResolveStudentsAsync(
        IReadOnlyList<SaveAttendanceStudentRequest> students,
        string className,
        CancellationToken cancellationToken)
    {
        var resolved = await StudentIdentityResolver.ResolveAsync(
            dbContext, students, x => x.StudentId, x => x.Name, _ => className, cancellationToken);
        return resolved
            .Select(x => new ResolvedStudent(x.Identity.StudentId, x.Identity.UserId, x.Identity.Name, x.Item.Status))
            .GroupBy(x => x.StudentId?.ToString() ?? $"name:{x.Name}")
            .Select(group => group.Last())
            .ToList();
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entry = await dbContext.Set<AttendanceEntry>().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entry is null) return false;
        dbContext.Set<AttendanceEntry>().Remove(entry);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    // Bilinmeyen değer devamsız sayılır (eski davranış); "Geldi" gibi Türkçe
    // yazımlar artık doğru kanonik değere gider.
    private static string MapStatus(string value)
    {
        var canonical = AttendanceStatusMatcher.Canonicalize(value);
        return canonical is AttendanceStatusMatcher.Present
            or AttendanceStatusMatcher.Late
            or AttendanceStatusMatcher.Excused
            ? canonical
            : AttendanceStatusMatcher.Absent;
    }
}
