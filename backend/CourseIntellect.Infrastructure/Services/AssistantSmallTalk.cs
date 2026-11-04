using System.Text.RegularExpressions;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Sohbet cümlesinin türü; her biri kendi insanca cevabını alır.</summary>
public enum SocialKind
{
    None,
    Greeting,
    HowAreYou,
    Identity,
    Thanks,
    Farewell,
    WellWish,
    Compliment,
    Apology,
    Frustration,
    Acknowledge,
}

/// <summary>
/// Selam, hâl hatır, teşekkür, vedalaşma, iltifat, özür, sitem ve "tamam" gibi sohbet cümlelerini
/// ayırt eder. Metin katlanmış (küçük harf, Türkçe karakter yok) gelir. İki aşamalıdır:
/// <see cref="Early"/> "nasıl" içeren kalıplar için yardım sorusundan önce, <see cref="Late"/> veri
/// kurallarından sonra çalışır; "Merhaba, Ali'nin notları" gibi cümleler veri sorusu kalır.
/// </summary>
public static partial class AssistantSmallTalk
{
    /// <summary>Asistanın adı; cevaplarda ve tanıtımda bu kullanılır.</summary>
    public const string Name = "Maydi";

    /// <summary>
    /// "Maydi, bugün kim gelmedi?" gibi hitaplardan adı çıkarır; ad bir öğrenci adı sanılmasın.
    /// Yalnız adı yazan kullanıcı ("Maydi!") selam vermiş sayılır.
    /// </summary>
    public static string WithoutName(string message)
    {
        if (!NameRegex().IsMatch(message)) return message;
        var rest = NameRegex().Replace(message, " ");
        rest = Regex.Replace(rest, @"\s+", " ").Trim().Trim(',', ';', ':', '-', ' ');
        var bare = rest.Trim('!', '.', '?', ' ');
        if (bare.Length == 0) return "merhaba";
        // "Maydi kim?" adın kendisini sorar; ad çıkınca tek başına "kim" kalır.
        return bare.ToLowerInvariant() is "kim" or "kimdir" or "who" or "who is" ? "sen kimsin" : rest;
    }

    private static readonly string[] HowAreYouTerms =
        ["nasilsin", "nasilsiniz", "naber", "ne haber", "iyi misin", "iyi misiniz", "nasil gidiyor", "ne var ne yok", "keyifler nasil", "how are you"];
    private static readonly string[] BotTerms =
        ["bot musun", "robot musun", "yapay zeka misin", "insan misin", "gercek misin", "are you human", "are you a bot"];
    private static readonly string[] IdentityTerms =
        ["neler yapabili", "ne yapabili", "ne ise yararsin", "sen kimsin", "kimsin", "adin ne", "ismin ne", "kendini tanit", "sistemi tanit", "sistemi anlat", "bu sistem ne",
         "who are you", "what can you do", "what is your name", .. BotTerms];
    private static readonly string[] ThanksTerms =
        ["tesekkur", "sag ol", "sagol", "eyvallah", "eline saglik", "emegine saglik", "yardimci oldun", "yardimci oldunuz", "isime yaradi", "minnettarim", "tsk", "thank", "thx"];
    private static readonly string[] FarewellTerms =
        ["gorusuruz", "gorusmek uzere", "hosca kal", "hoscakal", "iyi geceler", "bay bay", "bye", "kendine iyi bak", "kendinize iyi bakin", "see you", "good night"];
    private static readonly string[] WellWishTerms = ["kolay gelsin", "iyi calismalar", "hayirli isler", "hayirli gunler"];
    private static readonly string[] GreetingTerms =
        ["merhaba", "merhabalar", "selam", "selamlar", "gunaydin", "iyi aksamlar", "iyi gunler", "hayirli sabahlar", "mrb", "slm", "hey", "hello", "hi", "good morning", "good evening"];
    private static readonly string[] ComplimentTerms =
        ["harikasin", "supersin", "cok iyisin", "mukemmelsin", "muthissin", "efsanesin", "cok akillisin", "bravo", "aferin", "helal", "tebrikler", "seni seviyorum", "cok tatlisin",
         "great job", "awesome", "you are great", "you're great", "well done"];
    private static readonly string[] ApologyTerms = ["ozur dilerim", "pardon", "kusura bakma", "sorry"];
    private static readonly string[] FrustrationTerms =
        ["yanlis anladin", "anlamadin", "beni anlamiyorsun", "sacma", "ise yaramiyor", "ise yaramaz", "berbat", "aptal", "salak", "hic yardimci olmadin", "useless", "that's wrong", "you're wrong"];
    private static readonly string[] AcknowledgeTerms =
        ["tamam", "tamamdir", "anladim", "anlasildi", "ok", "okey", "peki", "oldu", "super", "guzel", "cok guzel", "harika", "iyi", "olur", "got it", "okay", "great", "nice", "cool"];

    /// <summary>"Nasıl" içeren sohbet ("nasılsın", "ne yapabiliyorsun"): yardım sorusundan önce ayıklanır.</summary>
    public static SocialKind Early(string folded)
    {
        var text = Words(folded);
        if (HasAny(text, HowAreYouTerms)) return SocialKind.HowAreYou;
        if (HasAny(text, IdentityTerms)) return SocialKind.Identity;
        return SocialKind.None;
    }

    /// <summary>Veri sorusu çıkmadıysa kalan sohbet türleri; sitem iltifattan, teşekkür vedadan önce gelir.</summary>
    public static SocialKind Late(string folded)
    {
        var text = Words(folded);
        if (HasAny(text, FrustrationTerms)) return SocialKind.Frustration;
        if (HasAny(text, ApologyTerms)) return SocialKind.Apology;
        if (HasAny(text, ComplimentTerms)) return SocialKind.Compliment;
        if (HasAny(text, ThanksTerms)) return SocialKind.Thanks;
        if (HasAny(text, FarewellTerms)) return SocialKind.Farewell;
        if (HasAny(text, WellWishTerms)) return SocialKind.WellWish;
        if (HasAny(text, GreetingTerms)) return SocialKind.Greeting;
        // "Tamam", "anladım" yalnız kısa cümlede onaydır; "tamam şimdi Ali'nin notları" bir sorudur.
        if (text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length <= 3 && HasAny(text, AcknowledgeTerms)) return SocialKind.Acknowledge;
        return SocialKind.None;
    }

    /// <summary>Servisin cevap seçerken kullandığı tek giriş: önce "nasıl" kalıpları, sonra diğerleri.</summary>
    public static SocialKind Classify(string folded)
    {
        var early = Early(folded);
        return early != SocialKind.None ? early : Late(folded);
    }

    public static bool Has(string folded, SocialKind kind) => kind switch
    {
        SocialKind.Greeting => HasAny(Words(folded), GreetingTerms),
        SocialKind.Farewell => HasAny(Words(folded), FarewellTerms),
        SocialKind.Thanks => HasAny(Words(folded), ThanksTerms),
        SocialKind.Identity => HasAny(Words(folded), BotTerms),
        _ => false,
    };

    /// <summary>Noktalama boşluğa çevrilir ve kenarlar boşlukla doldurulur; kısa kalıplar ("hi", "ok") kelime olarak aranır.</summary>
    private static string Words(string folded) => $" {NonWordRegex().Replace(folded, " ").Trim()} ";

    private static bool HasAny(string text, string[] terms) =>
        terms.Any(term => term.Length <= 4 ? text.Contains($" {term} ", StringComparison.Ordinal) : text.Contains(term, StringComparison.Ordinal));

    [GeneratedRegex(@"(?<![\p{L}\p{N}])[Mm][Aa][Yy][Dd][iIıİ](?:['’]?(?:c[iı]ğ[iı]m|c[iı]m|ye|ya|n[iı]n))?(?![\p{L}\p{N}])\s*[,!:;]?")]
    private static partial Regex NameRegex();

    [GeneratedRegex(@"[^\p{L}\p{N}']+")]
    private static partial Regex NonWordRegex();
}
