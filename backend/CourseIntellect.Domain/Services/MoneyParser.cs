using System.Globalization;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Para tutarı ayrıştırma/biçimleme için TEK kaynak. Daha önce aynı mantık
/// <c>AccountingService</c>, <c>AdminAnalyticsService</c> ve <c>AccountingController</c>
/// içinde ayrı ayrı kopyalanmıştı; kopyalar divergerse aynı tutar farklı okunurdu.
/// Artık tüm muhasebe/finans kodu buradan geçer.
///
/// <para>Türkçe ("1.500,50" → 1500.50) ve US ("1,500.50" → 1500.50) biçimlerini,
/// para simgesi/boşluk temizliğini ve binlik-ayraç sezgisini birlikte ele alır.</para>
/// </summary>
public static class MoneyParser
{
    /// <summary>Serbest metinden (₺, boşluk, TR/US ayraç) ondalık tutar çıkarır. Çözülemezse 0.</summary>
    public static decimal Parse(string? amount)
    {
        var cleaned = Normalize(amount);
        return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var value)
            ? value
            : 0m;
    }

    /// <summary>Metni InvariantCulture ile parse edilebilir kanonik biçime getirir.</summary>
    public static string Normalize(string? amount)
    {
        // Sadece rakam, ayraç ve eksi kalsın (₺, boşluk, harf atılır).
        var cleaned = new string((amount ?? string.Empty)
            .Where(ch => char.IsDigit(ch) || ch == ',' || ch == '.' || ch == '-').ToArray());
        var lastComma = cleaned.LastIndexOf(',');
        var lastDot = cleaned.LastIndexOf('.');

        // Hem virgül hem nokta var → SON gelen ondalık ayracıdır, diğeri binliktir.
        if (lastComma >= 0 && lastDot >= 0)
        {
            return lastComma > lastDot
                ? cleaned.Replace(".", string.Empty).Replace(',', '.') // TR: 1.500,50 → 1500.50
                : cleaned.Replace(",", string.Empty);                  // US: 1,500.50 → 1500.50
        }
        // Yalnız virgül → TR ondalık ayracı.
        if (lastComma >= 0)
        {
            return cleaned.Replace(".", string.Empty).Replace(',', '.'); // 1500,50 → 1500.50
        }
        // Yalnız nokta → 3 hane ise TR binlik ayracı (1.500 → 1500), değilse ondalık.
        if (lastDot >= 0)
        {
            var decimals = cleaned.Length - lastDot - 1;
            return decimals == 3 ? cleaned.Replace(".", string.Empty) : cleaned;
        }
        return cleaned;
    }

    /// <summary>Ondalık tutarı Türkçe para biçiminde gösterir (₺1.500,50).</summary>
    /// <summary>
    /// Gösterim biçimi ortak <see cref="MoneyText"/> kuralına bağlıdır
    /// ("5.000 TL"). Eskiden "₺5.000,00" üretiyordu; aynı tutar ekrana
    /// ekrandan farklı yazıldığı için tek kaynağa taşındı.
    /// </summary>
    public static string Format(decimal amount) => MoneyText.Format(amount);
}
