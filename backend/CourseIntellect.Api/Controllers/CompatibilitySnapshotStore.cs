using System.Globalization;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

internal static class CompatibilitySnapshotStore
{
    private const string Language = "tr";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static async Task<List<T>> LoadListAsync<T>(
        CourseIntellectDbContext dbContext,
        string sectionKey,
        CancellationToken cancellationToken = default)
    {
        var raw = await dbContext.SiteContentItems
            .AsNoTracking()
            .Where(item => item.SectionKey == sectionKey && item.Language == Language)
            .OrderByDescending(item => item.Version)
            .Select(item => item.ContentJson)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<T>>(raw, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static async Task SaveListAsync<T>(
        CourseIntellectDbContext dbContext,
        string sectionKey,
        IReadOnlyList<T> items,
        string updatedBy,
        CancellationToken cancellationToken = default)
    {
        var publishedItems = await dbContext.SiteContentItems
            .Where(item => item.SectionKey == sectionKey && item.Language == Language && item.IsPublished)
            .ToListAsync(cancellationToken);

        foreach (var published in publishedItems)
        {
            published.IsPublished = false;
            published.UpdatedAtUtc = DateTime.UtcNow;
            published.UpdatedBy = updatedBy;
        }

        var latestVersion = await dbContext.SiteContentItems
            .Where(item => item.SectionKey == sectionKey && item.Language == Language)
            .MaxAsync(item => (int?)item.Version, cancellationToken) ?? 0;

        var snapshot = new SiteContentItem
        {
            Id = Guid.NewGuid(),
            SectionKey = sectionKey,
            ContentJson = JsonSerializer.Serialize(items, JsonOptions),
            Language = Language,
            Version = latestVersion + 1,
            IsPublished = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
            UpdatedBy = updatedBy,
        };

        await dbContext.SiteContentItems.AddAsync(snapshot, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public static List<string> DeserializeStringList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(raw, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static string NormalizeText(string? value)
    {
        return (value ?? string.Empty)
            .Trim()
            .Replace("-", string.Empty)
            .Replace(" ", string.Empty)
            .ToLowerInvariant()
            .Replace('ç', 'c')
            .Replace('ğ', 'g')
            .Replace('ı', 'i')
            .Replace('ö', 'o')
            .Replace('ş', 's')
            .Replace('ü', 'u');
    }

    public static string NormalizeClassName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        var match = System.Text.RegularExpressions.Regex.Match(trimmed, @"^(\d{1,2})\s*[-]?\s*([A-Za-zÇĞİÖŞÜçğıöşü])$");
        if (match.Success)
        {
            return $"{match.Groups[1].Value}-{match.Groups[2].Value.ToUpperInvariant()}";
        }

        return trimmed;
    }

    private static readonly CultureInfo? TurkishCulture = TryGetCulture("tr-TR");

    private static CultureInfo? TryGetCulture(string name)
    {
        try
        {
            return CultureInfo.GetCultureInfo(name);
        }
        catch (CultureNotFoundException)
        {
            return null;
        }
    }

    public static DateTime ParseDateLabel(string? value)
    {
        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return parsed;
        }

        var culture = TurkishCulture ?? CultureInfo.InvariantCulture;
        if (DateTime.TryParseExact(value, "dd.MM.yyyy", culture, DateTimeStyles.None, out parsed))
        {
            return parsed;
        }

        return DateTime.UtcNow;
    }
}
