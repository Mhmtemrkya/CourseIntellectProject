using System.Globalization;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Sınav ve ödev tarihleri metin olarak saklanıyor ("25.10.2026", "2026-11-05", "13 Mart 2026").
/// Metin sıralaması yanlış sonuç verdiği için (örn. "13 Mart" &lt; "2 Nisan") asistan bu
/// etiketleri tarihe çevirerek sıralar. Çözülemeyen etiket null döner ve sona konur.
/// </summary>
public static class AssistantDates
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private static readonly string[] Formats =
    [
        "yyyy-MM-dd", "yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd HH:mm",
        "dd.MM.yyyy", "d.M.yyyy", "dd.MM.yyyy HH:mm", "d.M.yyyy HH:mm",
        "dd/MM/yyyy", "d/M/yyyy",
        "d MMMM yyyy", "dd MMMM yyyy", "d MMMM yyyy HH:mm", "d MMMM yyyy dddd",
    ];

    public static DateTime? TryParse(string? label)
    {
        var text = (label ?? string.Empty).Trim();
        if (text.Length == 0) return null;
        if (DateTime.TryParseExact(text, Formats, Tr, DateTimeStyles.AllowWhiteSpaces, out var exact)) return exact.Date;
        if (DateTime.TryParseExact(text, Formats, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var invariant)) return invariant.Date;
        return DateTime.TryParse(text, Tr, DateTimeStyles.AllowWhiteSpaces, out var loose) ? loose.Date : null;
    }

    /// <summary>Türkiye saatine göre bugünün tarihi (sunucu UTC çalışır).</summary>
    public static DateTime TodayTr => DateTime.UtcNow.AddHours(3).Date;

    public static string Short(DateTime date) => date.ToString("dd.MM.yyyy", Tr);
}
