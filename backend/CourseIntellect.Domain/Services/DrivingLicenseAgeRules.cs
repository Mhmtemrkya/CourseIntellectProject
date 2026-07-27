namespace CourseIntellect.Domain.Services;

/// <summary>
/// Sürücü belgesi sınıflarına göre asgari yaş (Karayolları Trafik Yönetmeliği).
/// Kayıt sırasında adayın kursa alınıp alınamayacağını yerelde kesin olarak
/// söyleyebildiğimiz tek resmî kuraldır; NVİ servisine ihtiyaç duymaz.
/// </summary>
public static class DrivingLicenseAgeRules
{
    private static readonly Dictionary<string, int> MinimumAges = new(StringComparer.OrdinalIgnoreCase)
    {
        ["M"] = 16, ["A1"] = 16, ["B1"] = 16,
        ["A2"] = 18, ["B"] = 18, ["BE"] = 18, ["C1"] = 18, ["C1E"] = 18, ["F"] = 18, ["G"] = 18,
        ["A"] = 20,
        ["C"] = 21, ["CE"] = 21, ["D1"] = 21, ["D1E"] = 21,
        ["D"] = 24, ["DE"] = 24,
    };

    /// <summary>Sınıf için asgari yaş; tanımsız sınıfta <c>null</c>.</summary>
    public static int? MinimumAgeFor(string? licenseClass) =>
        !string.IsNullOrWhiteSpace(licenseClass) && MinimumAges.TryGetValue(licenseClass.Trim(), out var age)
            ? age
            : null;

    /// <summary>Doğum tarihine göre verilen andaki tam yaş.</summary>
    public static int AgeAt(DateTime birthDate, DateTime nowUtc)
    {
        var age = nowUtc.Year - birthDate.Year;
        if (birthDate.Date > nowUtc.Date.AddYears(-age)) age--;
        return age;
    }

    /// <summary>
    /// Aday, sınıf için yaş şartını sağlıyor mu? Sınıf tanımsızsa <c>null</c>
    /// (karar verilemez) döner — bilinmeyen sınıf yüzünden kayıt engellenmez.
    /// </summary>
    public static bool? MeetsMinimumAge(string? licenseClass, DateTime birthDate, DateTime nowUtc)
    {
        var required = MinimumAgeFor(licenseClass);
        return required is null ? null : AgeAt(birthDate, nowUtc) >= required;
    }
}
