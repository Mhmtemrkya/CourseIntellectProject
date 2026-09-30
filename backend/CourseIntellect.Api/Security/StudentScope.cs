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

    /// <summary>
    /// Oturumdaki kullanıcı kimliği. JWT kimliği "sub"/"nameid" ile taşır ve
    /// inbound claim map kapalıdır; ClaimTypes.NameIdentifier tek başına null döner.
    /// </summary>
    public static Guid? ResolveUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("user_id")
            ?? user.FindFirstValue("sub")
            ?? user.FindFirstValue("nameid")
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) && id != Guid.Empty ? id : null;
    }

    /// <summary>Oturumdaki kişinin görünen adı (öğrenci/veli adı eşleşmeleri için).</summary>
    public static string ResolveDisplayName(ClaimsPrincipal user)
        => (user.FindFirstValue("name") ?? user.FindFirstValue(ClaimTypes.Name) ?? string.Empty).Trim();

    /// <summary>Oturumdaki kişinin kullanıcı adı.</summary>
    public static string ResolveUsername(ClaimsPrincipal user)
        => (user.FindFirstValue("unique_name")
            ?? user.FindFirstValue("preferred_username")
            ?? user.FindFirstValue(ClaimTypes.GivenName)
            ?? string.Empty).Trim();

    /// <summary>
    /// Öğrenci/veli için erişilebilir sınıf adları (öğrencinin kendi sınıfı,
    /// velinin çocuklarının sınıfları). null → personel, sınıf kısıtı yok.
    /// </summary>
    public static async Task<IReadOnlyList<string>?> ResolveAllowedClassNamesAsync(
        ClaimsPrincipal user,
        CourseIntellectDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (user.IsInRole("Student"))
        {
            var userId = ResolveUserId(user);
            if (userId is null)
            {
                return [];
            }

            var className = await dbContext.Students
                .AsNoTracking()
                .Where(x => x.UserId == userId.Value)
                .Select(x => x.ClassName)
                .FirstOrDefaultAsync(cancellationToken);
            return string.IsNullOrWhiteSpace(className) ? [] : [className.Trim()];
        }

        if (user.IsInRole("Parent"))
        {
            var names = await ResolveAllowedStudentNamesAsync(user, dbContext, cancellationToken) ?? [];
            if (names.Count == 0)
            {
                return [];
            }

            var allowed = names.Select(Normalize).ToHashSet();
            var students = await dbContext.Students
                .AsNoTracking()
                .Select(x => new { x.FullName, x.ClassName })
                .ToListAsync(cancellationToken);
            return students
                .Where(x => allowed.Contains(Normalize(x.FullName)) && !string.IsNullOrWhiteSpace(x.ClassName))
                .Select(x => x.ClassName.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
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
