using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Öğretmeni sınıfa bağlayan TEK kural. Öğretmenin sınıfları = ders programındaki sınıflar
/// + personel kaydındaki sınıf öğretmenliği + yöneticinin atadığı sınıflar. Üçü de yöneticinin
/// girdiği kayıtlardır; öğretmen kendisi değiştiremez. Konu analizi, Maydi, haftalık özet ve
/// yönetici uyarısı bu kuralı kullanır (iki yerde farklı kural olmasın).
/// Sınıf adları "10-A", "10/A", "10 A" farkını yok sayan anahtarla karşılaştırılır.
/// </summary>
public static class TeacherClassLinks
{
    /// <summary>Personel formunun "sınıf öğretmenliği yok" seçeneği; sınıf adı değildir.</summary>
    public const string NoHomeroom = "Sınıf öğretmenliği yok";

    // Ayraçlar (tire, eğik çizgi, nokta, boşluk) yok sayılır: "9-A" = "9/A" = "9 A" = "9.A" = "9A".
    public static string Key(string? className) => new string((className ?? string.Empty).Trim()
        .ToLowerInvariant().Where(c => c is not ('-' or '/' or '.' or ' ' or '_')).ToArray());

    private static IEnumerable<string> StaffClasses(string? homeroom, string? assignedSerialized)
    {
        if (!string.IsNullOrWhiteSpace(homeroom) && homeroom.Trim() != NoHomeroom) yield return homeroom.Trim();
        foreach (var item in (assignedSerialized ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            yield return item;
    }

    /// <summary>Tek öğretmenin sınıf anahtarları.</summary>
    public static async Task<IReadOnlySet<string>> KeysAsync(CourseIntellectDbContext db, Guid teacherUserId, CancellationToken ct)
        => (await KeysByTeacherAsync(db, [teacherUserId], ct)).GetValueOrDefault(teacherUserId) ?? new HashSet<string>();

    /// <summary>Birden çok öğretmenin sınıf anahtarları (kimlik → anahtarlar).</summary>
    public static async Task<Dictionary<Guid, HashSet<string>>> KeysByTeacherAsync(CourseIntellectDbContext db, IReadOnlyCollection<Guid> teacherUserIds, CancellationToken ct)
    {
        var result = teacherUserIds.Distinct().ToDictionary(id => id, _ => new HashSet<string>(StringComparer.Ordinal));
        var ids = result.Keys.ToList();
        var slots = await db.TeacherTimetableSlots.AsNoTracking()
            .Where(x => x.TeacherUserId != null && ids.Contains(x.TeacherUserId.Value))
            .Select(x => new { Teacher = x.TeacherUserId!.Value, x.ClassName })
            .ToListAsync(ct);
        foreach (var slot in slots) result[slot.Teacher].Add(Key(slot.ClassName));
        var staff = await db.Staff.AsNoTracking()
            .Where(x => ids.Contains(x.UserId))
            .Select(x => new { x.UserId, x.HomeroomClass, x.AssignedClassesSerialized })
            .ToListAsync(ct);
        foreach (var row in staff)
            foreach (var name in StaffClasses(row.HomeroomClass, row.AssignedClassesSerialized))
                result[row.UserId].Add(Key(name));
        foreach (var set in result.Values) set.Remove(string.Empty);
        return result;
    }

    /// <summary>Öğretmenin sınıfları, öğrenci kayıtlarındaki YAZIMLA (rosterda birebir eşleşme için).</summary>
    public static async Task<List<string>> StudentClassNamesAsync(CourseIntellectDbContext db, Guid teacherUserId, CancellationToken ct)
    {
        var keys = await KeysAsync(db, teacherUserId, ct);
        if (keys.Count == 0) return [];
        var names = await db.Students.AsNoTracking().Select(x => x.ClassName).Distinct().ToListAsync(ct);
        return names.Where(name => keys.Contains(Key(name))).ToList();
    }

    /// <summary>Hiç sınıf bağı olmayan aktif (rehber olmayan) öğretmen sayısı — yönetici uyarısı için.</summary>
    public static async Task<int> UnlinkedTeacherCountAsync(CourseIntellectDbContext db, CancellationToken ct)
    {
        var teachers = await db.Users.AsNoTracking()
            .Where(x => x.PrimaryRole == UserRole.Teacher && x.Status == UserStatus.Active && x.DeletedAtUtc == null)
            .Select(x => new { x.Id, x.DepartmentOrBranch })
            .ToListAsync(ct);
        var subjectTeachers = teachers
            .Where(x => !(x.DepartmentOrBranch ?? string.Empty).ToLower(new System.Globalization.CultureInfo("tr-TR")).Contains("rehberlik"))
            .Select(x => x.Id).ToList();
        if (subjectTeachers.Count == 0) return 0;
        var links = await KeysByTeacherAsync(db, subjectTeachers, ct);
        return links.Count(pair => pair.Value.Count == 0);
    }
}
