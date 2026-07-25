using System.Globalization;
using System.Text.RegularExpressions;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Kurum kayıtlarında kişi adlarını tek biçime getirir:
/// ad/adlar baş harfi büyük, soyadın tamamı büyük.
/// </summary>
public static partial class PersonNameFormatter
{
    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    public static string FormatFullName(string? value)
    {
        var parts = SplitParts(value);
        if (parts.Length == 0) return string.Empty;
        if (parts.Length == 1) return FormatGivenNames(parts[0]);

        var givenNames = string.Join(' ', parts[..^1].Select(FormatGivenNames));
        var surname = FormatSurname(parts[^1]);
        return $"{givenNames} {surname}";
    }

    public static string FormatGivenNames(string? value)
    {
        var parts = SplitParts(value);
        return string.Join(' ', parts.Select(FormatCompoundGivenName));
    }

    public static string FormatSurname(string? value)
    {
        var parts = SplitParts(value);
        return string.Join(' ', parts).ToUpper(Turkish);
    }

    private static string FormatCompoundGivenName(string value) =>
        string.Join('-', value.Split('-', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => string.Join('\'', part.Split('\'', StringSplitOptions.RemoveEmptyEntries)
                .Select(TitleCasePart))));

    private static string TitleCasePart(string value)
    {
        var lower = value.ToLower(Turkish);
        return lower.Length == 0
            ? string.Empty
            : $"{char.ToUpper(lower[0], Turkish)}{lower[1..]}";
    }

    private static string[] SplitParts(string? value) =>
        MultiSpaceRegex()
            .Replace((value ?? string.Empty).Trim(), " ")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

    [GeneratedRegex(@"\s+")]
    private static partial Regex MultiSpaceRegex();
}
