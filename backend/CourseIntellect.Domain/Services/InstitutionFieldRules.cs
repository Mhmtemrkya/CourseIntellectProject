using System.Text.RegularExpressions;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Kurum kaydı / profil alanlarının normalizasyon ve doğrulaması. Her yardımcı
/// boş değeri (opsiyonel alan) null döndürür; dolu ama geçersiz değer için
/// <see cref="InvalidOperationException"/> fırlatır. Telefon/TC kuralları
/// <see cref="SchoolRegistrationRules"/> ile paylaşılır.
/// </summary>
public static partial class InstitutionFieldRules
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^(https?://)?([a-z0-9-]+\.)+[a-z]{2,}(/[^\s]*)?$", RegexOptions.IgnoreCase)]
    private static partial Regex WebsiteRegex();

    /// <summary>E-posta: biçim doğrulanır, küçültülür (invariant). Opsiyonel.</summary>
    public static string? NormalizeEmail(string? value, bool required = false, string label = "E-posta")
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return required ? throw new InvalidOperationException($"{label} zorunludur.") : null;
        }
        var lower = trimmed.ToLowerInvariant();
        if (lower.Length is < 6 or > 180 || !EmailRegex().IsMatch(lower))
        {
            throw new InvalidOperationException($"Geçerli bir {label.ToLowerInvariant()} adresi girin.");
        }
        return lower;
    }

    /// <summary>Web sitesi: http(s) öneki yoksa eklenir, biçim doğrulanır. Opsiyonel.</summary>
    public static string? NormalizeWebsite(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0) return null;
        if (trimmed.Length > 200 || !WebsiteRegex().IsMatch(trimmed))
        {
            throw new InvalidOperationException("Geçerli bir web sitesi adresi girin (örn: https://kurum.com).");
        }
        return trimmed.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? trimmed : $"https://{trimmed}";
    }

    /// <summary>MEB kurum kodu: 6-8 rakam. Opsiyonel.</summary>
    public static string? NormalizeMebCode(string? value)
    {
        var digits = DigitsOnly(value);
        if (digits.Length == 0) return null;
        if (digits.Length is < 6 or > 8)
        {
            throw new InvalidOperationException("MEB kurum kodu 6-8 haneli olmalıdır.");
        }
        return digits;
    }

    /// <summary>Vergi/TC no: 10 hane (VKN) ya da 11 hane (şahıs TCKN). Opsiyonel.</summary>
    public static string? NormalizeTaxNumber(string? value)
    {
        var digits = DigitsOnly(value);
        if (digits.Length == 0) return null;
        if (digits.Length == 11)
        {
            // Şahıs işletmesi: TCKN girilmişse checksum da doğrulanır.
            return SchoolRegistrationRules.NormalizeTcNo(digits);
        }
        if (digits.Length != 10)
        {
            throw new InvalidOperationException("Vergi numarası 10 haneli (ya da şahıs için 11 haneli TC) olmalıdır.");
        }
        return digits;
    }

    /// <summary>Posta kodu: tam 5 rakam. Opsiyonel.</summary>
    public static string? NormalizePostalCode(string? value)
    {
        var digits = DigitsOnly(value);
        if (digits.Length == 0) return null;
        if (digits.Length != 5)
        {
            throw new InvalidOperationException("Posta kodu 5 haneli olmalıdır.");
        }
        return digits;
    }

    /// <summary>Kurum sabit/cep telefonu: 10-11 hane. Opsiyonel (cep zorunluluğu çağırana ait).</summary>
    public static string? NormalizeInstitutionPhone(string? value)
    {
        var digits = DigitsOnly(value);
        if (digits.Length == 0) return null;
        // 0 ön ekli 11 hane de kabul; son 10 haneye indirgenir.
        var normalized = digits.Length == 11 && digits[0] == '0' ? digits[1..] : digits;
        if (normalized.Length != 10)
        {
            throw new InvalidOperationException("Geçerli bir telefon numarası girin (10 haneli).");
        }
        return normalized;
    }

    /// <summary>İl: 81 il listesinden doğrulanır, kanonik yazıma getirilir. Opsiyonel.</summary>
    public static string? NormalizeProvince(string? value, bool required = false)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (trimmed.Length == 0)
        {
            return required ? throw new InvalidOperationException("İl zorunludur.") : null;
        }
        return TurkishProvinces.Canonical(trimmed)
            ?? throw new InvalidOperationException("Geçerli bir il seçin.");
    }

    /// <summary>Serbest metin alanı (ilçe, adres, vergi dairesi, ünvan): kontrol karakterleri atılır, kırpılır.</summary>
    public static string? NormalizeText(string? value, int maxLength, bool required = false, string label = "Alan")
    {
        var cleaned = new string((value ?? string.Empty).Where(ch => !char.IsControl(ch)).ToArray()).Trim();
        if (cleaned.Length == 0)
        {
            return required ? throw new InvalidOperationException($"{label} zorunludur.") : null;
        }
        return cleaned.Length > maxLength ? cleaned[..maxLength] : cleaned;
    }

    private static string DigitsOnly(string? value) =>
        new((value ?? string.Empty).Where(char.IsDigit).ToArray());
}
