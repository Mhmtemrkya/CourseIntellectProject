using System.Text;
using System.Text.RegularExpressions;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistana yazılan mesajlardaki yazım hatalarını, kural motorunun bildiği kelimelere göre düzeltir
/// ("teşekürler" → "tesekkurler", "devamszlık" → "devamsizlik", "tşk" → "tesekkurler").
///
/// Kurallar (yanlış eşleşmeyi önlemek için bilerek tutucu):
/// • Yalnız katlanmış metinde çalışır (küçük harf, Türkçe karakter yok) ve hiçbir veri dışarı gitmez.
/// • 3+ kez tekrarlanan harf tek harfe iner ("tesekkkurrr", "merhabaaa").
/// • Kısaltma sözlüğü ("tsk", "slm", "nbr", "tmm"…) tam kelime olarak açılır.
/// • Harf toleransı yalnız 5+ harfli kelime köklerinde ve ilk harf tutuyorsa: 5–7 harfte 1, 8+ harfte 2
///   hata (eksik/fazla/yanlış/yer değiştirmiş harf). Kelimenin kökten sonraki eki korunur.
/// • Bilinen bir kökle başlayan kelime ve 4 harften kısa kelime değiştirilmez.
/// • İki farklı köke eşit uzaklıktaysa (belirsiz) kelime değiştirilmez.
/// Kural motoru bunu yalnız mesaj düzeltmesiz anlaşılmadığında dener; servis, değişen kelime bir
/// öğrenci adıysa düzeltmeyi geri alır (ör. "Sinan" ≠ "sınav").
/// </summary>
public static partial class AssistantSpelling
{
    /// <summary>Düzeltme sonucu: yeni metin ve değişen ORİJİNAL kelimeler (öğrenci adı denetimi için).</summary>
    public sealed record SpellingResult(string Text, IReadOnlyList<string> ChangedTokens)
    {
        public bool Changed => ChangedTokens.Count > 0;
    }

    // Kural motorunun (RuleBasedAssistantIntentResolver) ve sohbet kalıplarının (AssistantSmallTalk)
    // kullandığı kökler. Yeni anahtar kelime eklenince buraya da eklenmeli; test listeyi denetler.
    public static readonly string[] IntentStems =
    [
        "hatirlatma", "hatirlat", "gonder", "uyari", "evrak", "belge", "veliye", "veliyi", "velisine", "bildir", "haber",
        "bilgilendir", "mesaj", "devamsiz", "devamsizlik", "genel", "durum", "durumu", "gidiyor", "programim", "derslerim",
        "notlarim", "odevlerim", "borcum", "devamsizligim", "sinavlarim", "nedir", "nereden", "nerede", "nereye", "yardim",
        "ogret", "zayif", "zorland", "konulara", "konularda", "konularim", "calismaliyim", "calismam", "gereken", "eksik",
        "eksiklerim", "analiz", "borcumuz", "odemem", "odemelerim", "taksitim", "taksitlerim", "aidatim", "tahsilat",
        "gelirimiz", "gelirler", "toplam", "ozeti", "kursiyer", "ogrenci", "ogrenciler", "mezun", "sayisi", "istatistik",
        "sertifika", "kitap", "kutuphane", "odunc", "tarihi", "randevu", "yaklasan", "ilerleme", "dakika", "surus",
        "direksiyon", "sinav", "yoklama", "gelmedi", "gelmeyen", "okula", "gitmis", "gelmis", "bugun", "bugunku",
        "yarinki", "haftalik", "olanlar", "kimler", "listele", "cocugum", "cocugumun", "odeme", "program", "dersim",
        "dersleri", "duyuru", "servis", "durak", "binmedi", "taksit", "aidat", "ucret", "puan", "altinda", "dusuk",
        "ortalama", "sonuc", "karne", "deneme", "sinif", "kimdir", "komutlar", "sorabilirim", "getir", "saglik", "raporu",
        "sicil", "nasil", "yarar", "bulur", "hangi", "calis", "kadar", "gelir", "zaman", "gider", "kurum", "dosya",
        "almaya", "kalan", "gitti", "geldi", "bindi", "alanlar",
    ];

    public static readonly string[] SmallTalkStems =
    [
        "tesekkur", "tesekkurler", "eyvallah", "saglik", "yardimci", "oldun", "oldunuz", "yaradi", "minnettarim",
        "gorusuruz", "gorusmek", "uzere", "hosca", "hoscakal", "geceler", "kendine", "kendinize", "bakin", "kolay",
        "gelsin", "calismalar", "hayirli", "isler", "gunler", "merhaba", "merhabalar", "selam", "selamlar", "gunaydin",
        "aksamlar", "sabahlar", "harikasin", "supersin", "mukemmelsin", "muthissin", "efsanesin", "akillisin", "bravo",
        "aferin", "tebrikler", "seviyorum", "tatlisin", "dilerim", "pardon", "kusura", "bakma", "anladin", "anlamadin",
        "anlamiyorsun", "yaramiyor", "yaramaz", "berbat", "olmadin", "tamam", "tamamdir", "anladim", "anlasildi",
        "harika", "guzel", "nasilsin", "nasilsiniz", "gidiyor", "keyifler", "musun", "misin", "misiniz", "yapabili",
        "yararsin", "kimsin", "ismin", "tanit", "sistemi", "anlat",
    ];

    // Tam kelime kısaltmalar ve yaygın ağız/klavye yazımları → kural motorunun bildiği karşılık.
    private static readonly Dictionary<string, string> Shorthands = new(StringComparer.Ordinal)
    {
        ["tsk"] = "tesekkurler", ["tskler"] = "tesekkurler", ["tsklr"] = "tesekkurler", ["tskkrler"] = "tesekkurler",
        ["tskrler"] = "tesekkurler", ["tsekkurler"] = "tesekkurler", ["tesk"] = "tesekkurler", ["tskr"] = "tesekkurler",
        ["saol"] = "sagol", ["saolun"] = "sagolun", ["sgol"] = "sagol", ["sagolasin"] = "sagol", ["eyv"] = "eyvallah",
        ["eyw"] = "eyvallah", ["eywallah"] = "eyvallah", ["slm"] = "selam", ["slmlar"] = "selamlar", ["mrb"] = "merhaba",
        ["mrhb"] = "merhaba", ["mrba"] = "merhaba", ["meraba"] = "merhaba", ["naber"] = "naber", ["nbr"] = "naber",
        ["nasilsn"] = "nasilsin", ["nslsn"] = "nasilsin", ["nasi"] = "nasil", ["gnydn"] = "gunaydin", ["gunaydn"] = "gunaydin",
        ["tmm"] = "tamam", ["tmam"] = "tamam", ["tamm"] = "tamam", ["tmmdr"] = "tamamdir", ["tmmdir"] = "tamamdir",
        ["kib"] = "kendine iyi bak", ["gorusuz"] = "gorusuruz", ["grsrz"] = "gorusuruz", ["gorusruz"] = "gorusuruz",
        ["bb"] = "bay bay", ["iyiaksamlar"] = "iyi aksamlar", ["iyigeceler"] = "iyi geceler", ["kolaygelsin"] = "kolay gelsin",
        ["slmlr"] = "selamlar", ["ogr"] = "ogrenci", ["ogrnc"] = "ogrenci", ["dvmsz"] = "devamsiz", ["dvmszlk"] = "devamsizlik",
    };

    // Bir anahtar kelimeye tek harf uzak ama kendisi gerçek bir kelime/yaygın ad olanlar: asla düzeltilmez.
    // (Öğrenci adları ayrıca serviste kurumun öğrenci listesiyle korunur; bu liste öğretmen/veli adları içindir.)
    private static readonly HashSet<string> NeverCorrect = new(StringComparer.Ordinal)
    {
        "selim", "sinan", "mesai", "sinir", "selin", "sevim", "gelin", "kalem", "mesut", "sevda", "duygu", "dursun",
    };

    private static readonly (string Stem, int MaxDistance)[] FuzzyStems = IntentStems.Concat(SmallTalkStems)
        .Distinct(StringComparer.Ordinal)
        .Where(stem => stem.Length >= 5)
        .Select(stem => (stem, stem.Length >= 8 ? 2 : 1))
        .ToArray();

    private static readonly string[] KnownStems = IntentStems.Concat(SmallTalkStems)
        .Distinct(StringComparer.Ordinal)
        .OrderByDescending(stem => stem.Length)
        .ToArray();

    /// <summary>Katlanmış metni düzeltir; değişmeyen metin aynen döner. <paramref name="keep"/> içindeki
    /// kelimeler (ör. kurumdaki öğrenci adları) hiç değiştirilmez.</summary>
    public static SpellingResult Correct(string folded, IReadOnlySet<string>? keep = null)
    {
        if (string.IsNullOrWhiteSpace(folded)) return new SpellingResult(folded ?? string.Empty, []);
        var changed = new List<string>();
        var text = WordRegex().Replace(folded, match =>
        {
            var original = match.Value;
            if (keep is not null && keep.Contains(original)) return original;
            var fixedWord = CorrectWord(original);
            if (fixedWord == original) return original;
            changed.Add(original);
            return fixedWord;
        });
        return new SpellingResult(text, changed);
    }

    private static string CorrectWord(string word)
    {
        if (word.Any(char.IsDigit)) return word;
        var collapsed = CollapseRepeats(word);
        if (Shorthands.TryGetValue(collapsed, out var expanded)) return expanded;
        if (collapsed.Length < 4 || NeverCorrect.Contains(collapsed)) return collapsed;
        if (IsKnown(collapsed)) return collapsed;

        string? best = null;
        var bestDistance = int.MaxValue;
        var ambiguous = false;
        foreach (var (stem, maxDistance) in FuzzyStems)
        {
            // İlk harf tutmalı: insanlar ilk harfi nadiren yanlış yazar, ama "burak"/"durak",
            // "masa"/"kasa" gibi ad ve sıradan kelimeler tam da ilk harfte ayrışır.
            if (stem[0] != collapsed[0]) continue;
            // Kökün başı karşılaştırılır; ek ("-ler", "-lik", "-im") olduğu gibi kalır.
            for (var length = Math.Max(4, stem.Length - maxDistance); length <= Math.Min(collapsed.Length, stem.Length + maxDistance); length++)
            {
                var distance = Distance(collapsed.AsSpan(0, length), stem, maxDistance);
                if (distance > maxDistance) continue;
                var candidate = stem + collapsed[length..];
                if (distance < bestDistance)
                {
                    best = candidate;
                    bestDistance = distance;
                    ambiguous = false;
                }
                else if (distance == bestDistance && candidate != best && !SameStemFamily(best, candidate))
                {
                    ambiguous = true;
                }
            }
        }

        return best is null || ambiguous ? collapsed : best;
    }

    // "devamsiz" ve "devamsizlik" gibi aynı aileden iki kök aynı düzeltmeyi farklı yazabilir; belirsizlik sayılmaz.
    private static bool SameStemFamily(string? left, string right)
        => left is not null && (left.StartsWith(right[..Math.Min(right.Length, 6)], StringComparison.Ordinal));

    /// <summary>Kelime asistanın bildiği bir anahtar/sohbet kelimesi ya da kısaltma mı? (Ad sanılmaması için.)</summary>
    public static bool IsVocabularyWord(string word)
    {
        var collapsed = CollapseRepeats(word);
        return Shorthands.ContainsKey(collapsed) || IsKnown(collapsed);
    }

    private static bool IsKnown(string word)
    {
        foreach (var stem in KnownStems)
        {
            if (word.StartsWith(stem, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    /// <summary>3+ kez tekrarlanan harf tek harfe iner; Türkçedeki çift harfler ("tesekkur", "saat") korunur.</summary>
    private static string CollapseRepeats(string word)
    {
        var builder = new StringBuilder(word.Length);
        for (var i = 0; i < word.Length; i++)
        {
            var run = 1;
            while (i + run < word.Length && word[i + run] == word[i]) run++;
            builder.Append(word[i], run >= 3 ? 1 : run);
            i += run - 1;
        }
        return builder.ToString();
    }

    /// <summary>Optimal string alignment (Damerau-Levenshtein): eksik, fazla, yanlış ve yer değiştirmiş harf; sınır aşılırsa erken çıkar.</summary>
    public static int Distance(ReadOnlySpan<char> source, string target, int limit)
    {
        if (Math.Abs(source.Length - target.Length) > limit) return limit + 1;
        var previous2 = new int[target.Length + 1];
        var previous = new int[target.Length + 1];
        var current = new int[target.Length + 1];
        for (var j = 0; j <= target.Length; j++) previous[j] = j;
        for (var i = 1; i <= source.Length; i++)
        {
            current[0] = i;
            var rowMin = current[0];
            for (var j = 1; j <= target.Length; j++)
            {
                var cost = source[i - 1] == target[j - 1] ? 0 : 1;
                var value = Math.Min(Math.Min(previous[j] + 1, current[j - 1] + 1), previous[j - 1] + cost);
                if (i > 1 && j > 1 && source[i - 1] == target[j - 2] && source[i - 2] == target[j - 1])
                    value = Math.Min(value, previous2[j - 2] + 1);
                current[j] = value;
                rowMin = Math.Min(rowMin, value);
            }
            if (rowMin > limit) return limit + 1;
            (previous2, previous, current) = (previous, current, previous2);
        }
        return previous[target.Length];
    }

    [GeneratedRegex(@"\p{L}[\p{L}\p{N}]*")]
    private static partial Regex WordRegex();
}
