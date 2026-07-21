namespace CourseIntellect.Domain.Services;

public static class SchoolRegistrationRules
{
    /// <summary>
    /// TC kimlik numarasını normalize eder: yalnız rakamlar, 11 hane, 0 ile başlamaz ve
    /// resmi TCKN doğrulama algoritmasını (10. ve 11. hane) sağlar.
    /// <paramref name="required"/> true ise boş değer reddedilir; false ise boş değer boş
    /// string olarak döner (opsiyonel alanlar için).
    /// </summary>
    public static string NormalizeTcNo(string? value, bool required = true)
    {
        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length == 0)
        {
            if (required)
            {
                throw new InvalidOperationException("TC kimlik numarası zorunludur.");
            }

            return string.Empty;
        }

        if (digits.Length != 11 || digits[0] == '0' || !IsValidTcChecksum(digits))
        {
            throw new InvalidOperationException("Geçerli bir TC kimlik numarası girin (11 haneli ve doğrulama hanesi geçerli olmalı).");
        }

        return digits;
    }

    /// <summary>Girdi 11 sayısal karakter olduğunda TCKN checksum kurallarını doğrular.</summary>
    private static bool IsValidTcChecksum(string digits)
    {
        var d = new int[11];
        for (var i = 0; i < 11; i++)
        {
            d[i] = digits[i] - '0';
        }

        var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];   // 1, 3, 5, 7, 9. haneler
        var evenSum = d[1] + d[3] + d[5] + d[7];          // 2, 4, 6, 8. haneler

        var tenth = ((oddSum * 7) - evenSum) % 10;
        if (tenth < 0)
        {
            tenth += 10;
        }

        if (tenth != d[9])
        {
            return false;
        }

        var eleventh = (oddSum + evenSum + d[9]) % 10;
        return eleventh == d[10];
    }

    /// <summary>Telefonu ülke/başlangıç kodlarından arındırıp son 10 haneye indirger (5XXXXXXXXX).</summary>
    public static string NormalizePhone(string? value)
    {
        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        return digits.Length > 10 ? digits[^10..] : digits;
    }

    /// <summary>Türkiye cep telefonu biçimini (5 ile başlayan 10 hane) doğrular.</summary>
    public static bool IsValidTrMobile(string? value)
    {
        var digits = NormalizePhone(value);
        return digits.Length == 10 && digits[0] == '5';
    }

    /// <summary>
    /// Doğum tarihini (varsa) doğrular: geçerli tarih olmalı, gelecekte olamaz ve makul
    /// bir aralıkta (son 120 yıl) bulunmalıdır. Boş değer kabul edilir (opsiyonel).
    /// </summary>
    public static void ValidateBirthDate(string? birthDate)
    {
        if (string.IsNullOrWhiteSpace(birthDate))
        {
            return;
        }

        if (!DateOnly.TryParse(birthDate, System.Globalization.CultureInfo.InvariantCulture, out var parsed))
        {
            throw new InvalidOperationException("Doğum tarihi geçersiz.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (parsed > today)
        {
            throw new InvalidOperationException("Doğum tarihi gelecekte olamaz.");
        }

        if (parsed < today.AddYears(-120))
        {
            throw new InvalidOperationException("Doğum tarihi geçersiz (çok eski).");
        }
    }

    public static string NextSchoolNumber(IEnumerable<string?> existingNumbers)
    {
        long max = 1000;
        foreach (var value in existingNumbers)
        {
            if (long.TryParse(value, out var parsed) && parsed > max)
            {
                max = parsed;
            }
        }

        if (max == long.MaxValue)
        {
            throw new InvalidOperationException("Yeni okul numarası üretilemedi.");
        }

        return (max + 1).ToString(System.Globalization.CultureInfo.InvariantCulture);
    }
}
