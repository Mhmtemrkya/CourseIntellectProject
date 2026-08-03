using System.Globalization;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Kullanıcıya GÖSTERİLEN para metinlerinin tek kaynağı (bildirim, not, mesaj).
///
/// Aynı tutar bildirimde "₺5.000,00", hatırlatmada "5.000,00 ₺", sertifikada
/// "5000.00 TRY" olarak yazılıyordu. İstemcilerdeki `format.js` / `format.dart`
/// ile aynı kural: tam sayıda kuruş yazılmaz, para birimi sonda kısaltmadır.
/// Belge/PDF tabloları bu sınıfı KULLANMAZ; orada iki hane sabittir.
/// </summary>
public static class MoneyText
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private static readonly Dictionary<string, string> Labels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TRY"] = "TL",
        ["TL"] = "TL",
        ["USD"] = "USD",
        ["EUR"] = "EUR",
        ["GBP"] = "GBP",
    };

    /// <summary>"5.000 TL" / "5.000,50 TL"</summary>
    public static string Format(decimal amount, string currency = "TRY")
    {
        var text = amount == decimal.Truncate(amount)
            ? amount.ToString("N0", Tr)
            : amount.ToString("N2", Tr);

        var code = string.IsNullOrWhiteSpace(currency) ? "TRY" : currency.Trim();
        var label = Labels.TryGetValue(code, out var known) ? known : code.ToUpperInvariant();
        return $"{text} {label}";
    }
}
