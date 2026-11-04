using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Bir kaydın bağlanacağı öğrenci: profil kimliği, kullanıcı kimliği ve gösterilecek ad.</summary>
public sealed record ResolvedStudentIdentity(Guid? StudentId, Guid? UserId, string Name);

/// <summary>
/// Öğrenciye ait kayıtları (yoklama, sınav sonucu) <c>StudentProfile.Id</c>'ye bağlar.
/// Kimlik geldiyse (ve bu kurumdaysa) o kullanılır, ad profildeki addır. Kimlik yoksa
/// ad ile aranır: önce aynı sınıfta, sonra kurumda TEK eşleşme varsa bağlanır; aynı
/// adlı birden çok öğrencide kimlik boş kalır (tahmin edilmez).
/// </summary>
public static class StudentIdentityResolver
{
    /// <summary>
    /// Ad karşılaştırma anahtarı: harf ve Türkçe karakterden bağımsız. Adlar kayıtta
    /// biçimlenir ("Ayşe DEMİR"); invariant küçültme "İ"yi değiştirmediği için önce elle katlanır.
    /// </summary>
    public static string NameKey(string? value) => string.Join(' ',
        (value ?? string.Empty).Trim().Replace('İ', 'i').ToLowerInvariant()
            .Replace("̇", string.Empty)
            .Replace('ı', 'i').Replace('ç', 'c').Replace('ğ', 'g')
            .Replace('ö', 'o').Replace('ş', 's').Replace('ü', 'u')
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

    /// <summary>İstek sırasıyla aynı sırada sonuç döner (ad boşsa ve kimlik yoksa o öğe atlanır).</summary>
    public static async Task<List<(T Item, ResolvedStudentIdentity Identity)>> ResolveAsync<T>(
        CourseIntellectDbContext dbContext,
        IEnumerable<T> items,
        Func<T, Guid?> studentId,
        Func<T, string?> name,
        Func<T, string?> className,
        CancellationToken cancellationToken)
    {
        var requested = items
            .Where(x => studentId(x) is not null || !string.IsNullOrWhiteSpace(name(x)))
            .ToList();
        if (requested.Count == 0) return [];

        var ids = requested.Select(studentId).Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        var names = requested.Select(x => name(x)?.Trim()).Where(x => !string.IsNullOrEmpty(x)).Select(x => x!).Distinct().ToList();
        var loweredNames = names.Select(x => x.ToLowerInvariant()).ToList();
        var classNames = requested.Select(x => className(x)?.Trim()).Where(x => !string.IsNullOrEmpty(x)).Select(x => x!).Distinct().ToList();

        // Kurum filtresi global sorgu filtresinden gelir: başka kurumun kimliği bulunmaz.
        // Adaylar kimlik, birebir/küçük harfli ad ve sınıfla daraltılır; karşılaştırma bellekte.
        var profiles = await dbContext.Students.AsNoTracking()
            .Where(x => ids.Contains(x.Id)
                || names.Contains(x.FullName)
                || loweredNames.Contains(x.FullName.ToLower())
                || classNames.Contains(x.ClassName))
            .Select(x => new { x.Id, x.UserId, x.FullName, x.ClassName })
            .ToListAsync(cancellationToken);

        var result = new List<(T, ResolvedStudentIdentity)>();
        foreach (var item in requested)
        {
            var byId = studentId(item) is { } id ? profiles.FirstOrDefault(x => x.Id == id) : null;
            if (byId is not null)
            {
                result.Add((item, new ResolvedStudentIdentity(byId.Id, byId.UserId, byId.FullName.Trim())));
                continue;
            }

            var itemName = name(item)?.Trim() ?? string.Empty;
            if (itemName.Length == 0) continue;
            var key = NameKey(itemName);
            var classKey = NameKey(className(item));
            var sameName = profiles.Where(x => NameKey(x.FullName) == key).ToList();
            var sameClass = sameName.Where(x => NameKey(x.ClassName) == classKey).ToList();
            var match = sameClass.Count == 1 ? sameClass[0] : sameClass.Count == 0 && sameName.Count == 1 ? sameName[0] : null;
            result.Add((item, match is null
                ? new ResolvedStudentIdentity(null, null, itemName)
                : new ResolvedStudentIdentity(match.Id, match.UserId, match.FullName.Trim())));
        }

        return result;
    }
}
