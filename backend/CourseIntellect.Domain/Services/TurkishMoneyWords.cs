using System.Globalization;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Tutarı Türkçe yazıya çevirir — resmî ekstre/makbuz belgelerindeki
/// "Yalnız OnikiBinDörtYüzElli TL" satırı için. Sayı yazıyla da basıldığında
/// belge üzerinde tutar sonradan değiştirilemez hale gelir.
/// </summary>
public static class TurkishMoneyWords
{
    private static readonly string[] Ones = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
    private static readonly string[] Tens = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
    private static readonly string[] Scales = ["", "bin", "milyon", "milyar", "trilyon"];

    /// <summary>
    /// Tutarı "Yalnız" satırında kullanılacak metne çevirir; kuruş varsa ayrı yazılır.
    /// Örn. 12.450,00 → "OnikiBinDörtYüzElli TL", 1.234,56 → "BinİkiYüzOtuzDört TL ElliAltı Kr".
    /// </summary>
    public static string Format(decimal amount, string currencyLabel = "TL", string subUnitLabel = "Kr")
    {
        var negative = amount < 0;
        var absolute = Math.Round(Math.Abs(amount), 2, MidpointRounding.AwayFromZero);
        var whole = decimal.Truncate(absolute);
        var cents = (int)decimal.Round((absolute - whole) * 100, 0, MidpointRounding.AwayFromZero);
        if (cents == 100)
        {
            whole += 1;
            cents = 0;
        }

        var text = $"{Words(whole)} {currencyLabel}".Trim();
        if (cents > 0)
        {
            text = $"{text} {Words(cents)} {subUnitLabel}".Trim();
        }

        return negative ? $"Eksi {text}" : text;
    }

    /// <summary>Tam sayıyı Türkçe yazıya çevirir ("Sıfır", "Oniki", "BinÜçYüz"…).</summary>
    public static string Words(decimal value)
    {
        var number = decimal.Truncate(Math.Abs(value));
        if (number == 0) return "Sıfır";

        // Ondalıksız en büyük desteklenen aralık trilyon; üstü sayıyla bırakılır.
        if (number >= 1_000_000_000_000_000m) return number.ToString("N0", Tr);

        // 3'lük gruplara ayır (en küçük grup başta).
        var groups = new List<int>();
        while (number > 0)
        {
            groups.Add((int)(number % 1000));
            number = decimal.Truncate(number / 1000);
        }

        var tokens = new List<string>();
        for (var index = groups.Count - 1; index >= 0; index--)
        {
            var group = groups[index];
            if (group == 0) continue;

            // "bir bin" yazılmaz, yalnız "bin" denir.
            if (!(group == 1 && index == 1))
            {
                tokens.AddRange(GroupTokens(group));
            }

            if (index > 0) tokens.Add(Scales[index]);
        }

        return string.Concat(tokens.Select(Capitalize));
    }

    /// <summary>0-999 arası grubu yazı parçalarına böler ("dört", "yüz", "elli" → DörtYüzElli).</summary>
    private static IEnumerable<string> GroupTokens(int group)
    {
        var hundreds = group / 100;
        var tens = group % 100 / 10;
        var ones = group % 10;

        if (hundreds > 0)
        {
            // "bir yüz" yazılmaz, yalnız "yüz" denir.
            if (hundreds > 1) yield return Ones[hundreds];
            yield return "yüz";
        }

        // Onlar ve birler tek parça olarak yazılır: "on iki" → "Oniki".
        var tail = $"{Tens[tens]}{Ones[ones]}";
        if (tail.Length > 0) yield return tail;
    }

    // "iki" → "İki": baş harf Türkçe kültürle büyütülür, yoksa noktasız I çıkar.
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private static string Capitalize(string token) =>
        token.Length == 0 ? token : string.Concat(token[..1].ToUpper(Tr), token[1..]);
}
