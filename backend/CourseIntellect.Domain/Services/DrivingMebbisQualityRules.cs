using System.Globalization;
using System.Text.RegularExpressions;

namespace CourseIntellect.Domain.Services;

public enum MebbisQualitySeverity
{
    Green = 0,
    Yellow = 1,
    Orange = 2,
    Red = 3,
}

public sealed record MebbisQualityCheck(
    string Key,
    string Title,
    string Category,
    MebbisQualitySeverity Severity,
    string Message);

public sealed record MebbisImageInfo(string Format, int Width, int Height);

public static partial class DrivingMebbisQualityRules
{
    public static int MinimumAgeFor(string? licenseClass) => licenseClass?.Trim().ToUpperInvariant() switch
    {
        "M" or "A1" or "B1" => 16,
        "A2" or "B" or "BE" or "C1" or "C1E" or "F" or "G" => 18,
        "A" => 20,
        "C" or "CE" or "D1" or "D1E" => 21,
        "D" or "DE" => 24,
        _ => 18,
    };

    public static bool TryParseBirthDate(string? value, out DateOnly birthDate)
    {
        birthDate = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        var formats = new[] { "yyyy-MM-dd", "dd.MM.yyyy", "d.M.yyyy", "dd/MM/yyyy", "d/M/yyyy" };
        return DateOnly.TryParseExact(value.Trim(), formats, CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.None, out birthDate)
            || DateOnly.TryParse(value.Trim(), CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.None, out birthDate);
    }

    public static int AgeOn(DateOnly birthDate, DateOnly date)
    {
        var age = date.Year - birthDate.Year;
        if (birthDate > date.AddYears(-age)) age--;
        return age;
    }

    public static bool IsValidPhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("90", StringComparison.Ordinal) && digits.Length == 12) digits = digits[2..];
        if (digits.StartsWith('0') && digits.Length == 11) digits = digits[1..];
        return digits.Length == 10 && digits[0] == '5';
    }

    public static bool IsPlausibleIdentitySerial(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var normalized = value.Replace(" ", string.Empty, StringComparison.Ordinal).Replace("-", string.Empty, StringComparison.Ordinal).ToUpperInvariant();
        return NewIdentitySerialRegex().IsMatch(normalized) || OldIdentitySerialRegex().IsMatch(normalized);
    }

    public static MebbisImageInfo? InspectImageHeader(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 24 && bytes[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            return new("PNG", ReadBigEndianInt32(bytes[16..20]), ReadBigEndianInt32(bytes[20..24]));

        if (bytes.Length >= 12 && bytes[0] == 0xFF && bytes[1] == 0xD8)
        {
            var offset = 2;
            while (offset + 9 < bytes.Length)
            {
                if (bytes[offset] != 0xFF) { offset++; continue; }
                var marker = bytes[offset + 1];
                if (marker is 0xD8 or 0xD9) { offset += 2; continue; }
                var length = (bytes[offset + 2] << 8) | bytes[offset + 3];
                if (length < 2 || offset + length + 2 > bytes.Length) break;
                if (marker is >= 0xC0 and <= 0xC3 or >= 0xC5 and <= 0xC7 or >= 0xC9 and <= 0xCB or >= 0xCD and <= 0xCF)
                    return new("JPEG", (bytes[offset + 7] << 8) | bytes[offset + 8], (bytes[offset + 5] << 8) | bytes[offset + 6]);
                offset += length + 2;
            }
        }
        return null;
    }

    private static int ReadBigEndianInt32(ReadOnlySpan<byte> value)
        => (value[0] << 24) | (value[1] << 16) | (value[2] << 8) | value[3];

    [GeneratedRegex("^[A-Z][0-9]{8}$", RegexOptions.CultureInvariant)]
    private static partial Regex NewIdentitySerialRegex();

    [GeneratedRegex("^[A-Z]{2}[0-9]{6}$", RegexOptions.CultureInvariant)]
    private static partial Regex OldIdentitySerialRegex();
}
