using System.Security.Claims;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Security;

/// <summary>
/// Öğrenciye ait verilerin (sınav sonucu, devamsızlık vb.) GET uçlarında
/// rol bazlı kapsam denetimi. UI ne gösterirse göstersin, API doğrudan
/// çağrıldığında da öğrenci yalnızca kendisini, veli yalnızca kendi
/// çocuklarını görebilir; personel rolleri kısıtsızdır.
/// </summary>
public static class StudentScope
{
    /// <summary>
    /// İzin verilen öğrenci adlarını döndürür.
    /// null → kısıt yok (öğretmen/yönetici/idari/muhasebe vb. personel rolleri).
    /// Boş liste → erişilebilir öğrenci yok (sonuç boş dönmelidir).
    /// </summary>
    public static async Task<IReadOnlyList<string>?> ResolveAllowedStudentNamesAsync(
        ClaimsPrincipal user,
        CourseIntellectDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (user.IsInRole("Student"))
        {
            var fullName = (user.FindFirstValue("name") ?? user.FindFirstValue(ClaimTypes.Name) ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(fullName) ? [] : [fullName];
        }

        if (user.IsInRole("Parent"))
        {
            // JWT, kimliği "sub"/"nameid" claim'i ile taşır ve inbound claim
            // map kapalı olduğundan ClaimTypes.NameIdentifier'a eşlenmez. Bu
            // yüzden olası tüm claim adlarını sırayla dene.
            var userRaw = user.FindFirstValue("user_id")
                ?? user.FindFirstValue("sub")
                ?? user.FindFirstValue("nameid")
                ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(userRaw, out var parentUserId);

            var parentName = Normalize(user.FindFirstValue("name") ?? user.FindFirstValue(ClaimTypes.Name));
            var username = Normalize(user.FindFirstValue("unique_name")
                ?? user.FindFirstValue("preferred_username")
                ?? user.FindFirstValue(ClaimTypes.GivenName));

            var students = await dbContext.Students
                .AsNoTracking()
                .Select(x => new { x.FullName, x.ParentUserId, x.ParentName, x.ParentEmail })
                .ToListAsync(cancellationToken);

            // Öncelik ParentUserId eşleşmesinde; bağ kurulmamış (sadece veli adı/
            // e-postası girilmiş) kayıtlar için isim/e-posta eşleşmesine düşülür.
            var matched = students
                .Where(x =>
                    (parentUserId != Guid.Empty && x.ParentUserId == parentUserId)
                    || (parentName.Length > 0 && Normalize(x.ParentName) == parentName)
                    || (username.Length > 0 && Normalize(x.ParentEmail).Contains(username)))
                .Select(x => x.FullName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return matched;
        }

        return null;
    }

    private static string Normalize(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>
    /// Kapsamlı isim listesine göre kayıtları süzer (büyük/küçük harf duyarsız).
    /// </summary>
    public static IReadOnlyList<T> FilterByStudentNames<T>(
        IReadOnlyList<T> items,
        IReadOnlyList<string> allowedNames,
        Func<T, string> studentNameSelector)
    {
        if (allowedNames.Count == 0)
        {
            return [];
        }

        var allowed = allowedNames
            .Select(name => name.Trim())
            .Where(name => name.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return items
            .Where(item => allowed.Contains(studentNameSelector(item).Trim()))
            .ToList();
    }
}
