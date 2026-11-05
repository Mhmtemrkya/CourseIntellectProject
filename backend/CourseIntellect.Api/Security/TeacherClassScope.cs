using System.Security.Claims;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Security;

/// <summary>
/// Öğretmenin görebileceği sınıflar (konu analizi gibi sınıf/öğrenci bazlı akademik ekranlar için).
/// • Yönetici / şube müdürü / idari: kısıt yok (null).
/// • Rehber öğretmen (branşı "Rehberlik"): görev gereği sınıflar arası çalışır, kısıt yok.
/// • Diğer öğretmenler: yalnız ders programında ders verdiği sınıflar. Programı yoksa boş küme
///   (hiçbir sınıf) — en az yetki ilkesi.
/// Sınıf adları "10-A", "10/A", "10 A" farkını yok sayan anahtarla karşılaştırılır.
/// </summary>
public static class TeacherClassScope
{
    public static string Key(string? className) =>
        (className ?? string.Empty).Trim().ToLowerInvariant().Replace('/', '-').Replace(" ", string.Empty);

    /// <summary>null → kısıt yok; aksi hâlde izinli sınıf anahtarları.</summary>
    public static async Task<IReadOnlySet<string>?> ResolveAsync(ClaimsPrincipal user, CourseIntellectDbContext db, CancellationToken ct)
    {
        if (!user.IsInRole("Teacher") || user.IsInRole("Admin") || user.IsInRole("BranchManager") || user.IsInRole("Administrative"))
            return null;
        var userId = StudentScope.ResolveUserId(user);
        if (userId is null) return new HashSet<string>();
        var branch = await db.Users.AsNoTracking().Where(x => x.Id == userId.Value)
            .Select(x => new { x.DepartmentOrBranch, x.PrimaryRole }).FirstOrDefaultAsync(ct);
        if (branch is not null && branch.PrimaryRole == UserRole.Teacher
            && (branch.DepartmentOrBranch ?? string.Empty).ToLower(new System.Globalization.CultureInfo("tr-TR")).Contains("rehberlik"))
            return null;
        var classes = await db.TeacherTimetableSlots.AsNoTracking()
            .Where(x => x.TeacherUserId == userId.Value)
            .Select(x => x.ClassName).Distinct().ToListAsync(ct);
        return classes.Select(Key).Where(x => x.Length > 0).ToHashSet(StringComparer.Ordinal);
    }
}
