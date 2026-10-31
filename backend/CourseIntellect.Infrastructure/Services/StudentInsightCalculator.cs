using System.Globalization;
using CourseIntellect.Application.DTOs.Insights;

namespace CourseIntellect.Infrastructure.Services;

public enum AnswerOutcome { Correct, Wrong, Blank }

/// <summary>Konu bilgisi taşıyan tek bir cevap (online sınav ya da soru bankası çalışması).</summary>
public sealed record InsightAnswer(Guid StudentUserId, string Subject, string Topic, AnswerOutcome Outcome, DateTime AtUtc);

/// <summary>
/// Deterministik konu analizi. Yapay zekâ kullanmaz; aynı veriye her zaman aynı sonucu verir.
/// Kurallar:
/// - Bir konu en az <see cref="MinSample"/> cevaplanmış soru yoksa "zayıf" sayılmaz (gürültü).
/// - Zayıf: başarı %<see cref="WeakAbsolute"/> altında, sınıfın geri kalanından en az
///   <see cref="WeakRelative"/> puan düşük ya da düşüşte ve son yarıdaki başarı %<see cref="WeakAbsolute"/> altında.
/// - Eğilim: öğrencinin o konudaki cevapları zamana göre ikiye bölünür; iki yarıda da en az
///   <see cref="TrendMinEach"/> cevap varsa ve fark <see cref="TrendDelta"/> puan ya da fazlaysa yükseliş/düşüş.
/// - Teşhis (yalnız zayıf konuda): boşlar çoksa skipping, düşüşteyse declining, aksi hâlde misconception.
/// </summary>
public static class StudentInsightCalculator
{
    public const int MinSample = 5;
    public const decimal WeakAbsolute = 50m;
    public const decimal WeakRelative = 15m;
    public const decimal StrongRate = 80m;
    // Az cevapla tek bir soru oranı 15-25 puan oynatır; eğilim için iki yarıda da yeterli cevap şart.
    public const int TrendMinEach = 5;
    public const decimal TrendDelta = 20m;
    public const decimal SkippingBlankShare = 30m;

    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static readonly StringComparer TrComparer = StringComparer.Create(Tr, ignoreCase: true);

    public static string NormalizeLabel(string? value, string fallback = "Genel")
    {
        var trimmed = (value ?? string.Empty).Trim();
        return trimmed.Length == 0 ? fallback : trimmed;
    }

    public static decimal Rate(int correct, int total) => total == 0 ? 0m : Math.Round(correct * 100m / total, 1);

    /// <summary>Bir öğrencinin konu tablosu. <paramref name="classAnswers"/> sınıfın tüm cevaplarıdır (öğrenci dahil).</summary>
    public static IReadOnlyList<TopicInsightDto> ComputeTopics(
        Guid studentUserId,
        IReadOnlyList<InsightAnswer> classAnswers)
    {
        var mine = classAnswers.Where(item => item.StudentUserId == studentUserId).ToList();
        var others = classAnswers.Where(item => item.StudentUserId != studentUserId)
            .GroupBy(item => (item.Subject, item.Topic))
            .ToDictionary(group => group.Key, group => (Correct: group.Count(item => item.Outcome == AnswerOutcome.Correct), Total: group.Count()));

        return mine
            .GroupBy(item => (item.Subject, item.Topic))
            .Select(group =>
            {
                var ordered = group.OrderBy(item => item.AtUtc).ToList();
                var correct = ordered.Count(item => item.Outcome == AnswerOutcome.Correct);
                var wrong = ordered.Count(item => item.Outcome == AnswerOutcome.Wrong);
                var blank = ordered.Count(item => item.Outcome == AnswerOutcome.Blank);
                var success = Rate(correct, ordered.Count);

                decimal? classRate = others.TryGetValue(group.Key, out var other) && other.Total >= MinSample
                    ? Rate(other.Correct, other.Total)
                    : null;

                decimal? previous = null, recent = null;
                var trend = "unknown";
                var half = ordered.Count / 2;
                if (half >= TrendMinEach)
                {
                    var older = ordered.Take(ordered.Count - half).ToList();
                    var newer = ordered.Skip(ordered.Count - half).ToList();
                    previous = Rate(older.Count(item => item.Outcome == AnswerOutcome.Correct), older.Count);
                    recent = Rate(newer.Count(item => item.Outcome == AnswerOutcome.Correct), newer.Count);
                    var delta = recent.Value - previous.Value;
                    trend = delta >= TrendDelta ? "up" : delta <= -TrendDelta ? "down" : "flat";
                }

                var enough = ordered.Count >= MinSample;
                var weak = enough && (success < WeakAbsolute
                    || (classRate is decimal rate && success <= rate - WeakRelative)
                    || (trend == "down" && recent < WeakAbsolute));
                var strong = enough && !weak && success >= StrongRate;
                string? diagnosis = null;
                if (weak)
                {
                    var blankShare = Rate(blank, ordered.Count);
                    diagnosis = blankShare >= SkippingBlankShare && blank >= wrong ? "skipping"
                        : trend == "down" ? "declining"
                        : "misconception";
                }

                return new TopicInsightDto(group.Key.Subject, group.Key.Topic, ordered.Count, correct, wrong, blank, success,
                    classRate, previous, recent, trend, enough, weak, strong, diagnosis);
            })
            .OrderBy(item => item.Subject, TrComparer)
            .ThenBy(item => item.Topic, TrComparer)
            .ToList();
    }

    /// <summary>Zayıf konular en kötüden iyiye: düşüşte olan önce, sonra başarıya göre.</summary>
    public static IReadOnlyList<TopicInsightDto> RankWeak(IEnumerable<TopicInsightDto> topics) => topics
        .Where(item => item.IsWeak)
        .OrderBy(item => item.Trend == "down" ? 0 : 1)
        .ThenBy(item => item.SuccessRate)
        .ThenByDescending(item => item.Solved)
        .ToList();

    public static IReadOnlyList<SubjectInsightDto> ComputeSubjects(IReadOnlyList<InsightAnswer> mine, IReadOnlyList<TopicInsightDto> topics) => mine
        .GroupBy(item => item.Subject)
        .Select(group => new SubjectInsightDto(
            group.Key,
            group.Count(),
            Rate(group.Count(item => item.Outcome == AnswerOutcome.Correct), group.Count()),
            topics.Count(item => item.IsWeak && item.Subject == group.Key)))
        .OrderBy(item => item.Subject, TrComparer)
        .ToList();

    /// <summary>
    /// Teşhise karşılık gelen sabit öneri (öğretmenlerin onayladığı katalog). Yapay zekâ bu
    /// metni değiştirmez; istemciler aynı anahtarla kendi dillerinde gösterir.
    /// </summary>
    public static string RecommendationFor(string? diagnosis) => diagnosis switch
    {
        "skipping" => "Soruları boş bırakmaya eğilimli; kolaydan zora sıralanmış kısa testlerle soruya başlama alışkanlığı kazanması önerilir.",
        "declining" => "Son çalışmalarında düşüş var; kısa bir konu tekrarı yapıp son yanlışlarını yeniden çözmesi önerilir.",
        "misconception" => "Yanlışları ağırlıkta, kavram yanılgısı olabilir; temel kuralları tekrar edip çözümlü örneklerle hata analizi yapması önerilir.",
        _ => string.Empty,
    };

    public static string DiagnosisLabel(string? diagnosis) => diagnosis switch
    {
        "skipping" => "boş bırakma eğilimi",
        "declining" => "son çalışmalarda düşüş",
        "misconception" => "yanlışlar ağırlıkta",
        _ => string.Empty,
    };

    /// <summary>Aynı teşhisli zayıf konular tek maddede toplanır (en fazla 3 konu, en kötüden iyiye).</summary>
    private static IReadOnlyList<(string Diagnosis, IReadOnlyList<TopicInsightDto> Topics)> GroupWeak(IReadOnlyList<TopicInsightDto> weak) => weak
        .Take(3)
        .GroupBy(item => item.Diagnosis ?? string.Empty)
        .Select(group => (group.Key, (IReadOnlyList<TopicInsightDto>)group.ToList()))
        .ToList();

    // Konu adları "ve" içerebildiği için ("Kuvvet ve Hareket") liste virgülle ayrılır.
    private static string JoinTopics(IEnumerable<TopicInsightDto> topics) => string.Join(", ", topics.Select(item => item.Topic));

    private static string TopicPhrase(IReadOnlyCollection<TopicInsightDto> topics) =>
        $"{JoinTopics(topics)} {(topics.Count == 1 ? "konusunda" : "konularında")}";

    /// <summary>
    /// Yapay zekâya ve şablon nota giden sözel taslak. Ad, sınıf, okul ya da sayı içermez
    /// (takma adlı/özet veri). En fazla 3 zayıf ve 2 güçlü konu; aynı teşhis tek maddede.
    /// </summary>
    public static string BuildDraft(IReadOnlyList<TopicInsightDto> weak, IReadOnlyList<TopicInsightDto> strong)
    {
        var lines = GroupWeak(weak)
            .Select(group => $"- Zayıf konu(lar): {JoinTopics(group.Topics)}. Teşhis: {DiagnosisLabel(group.Diagnosis)}. Öneri: {RecommendationFor(group.Diagnosis)}")
            .ToList();
        if (strong.Count > 0)
        {
            lines.Add($"- Güçlü konu(lar): {JoinTopics(strong.Take(2))}. Bu konular için öneri yazma.");
        }
        return string.Join('\n', lines);
    }

    /// <summary>Yapay zekâ kapalıyken ya da doğrulamadan geçmezse gösterilen not.</summary>
    public static string BuildTemplateNote(IReadOnlyList<TopicInsightDto> weak, IReadOnlyList<TopicInsightDto> strong)
    {
        if (weak.Count == 0)
        {
            return strong.Count > 0
                ? $"Belirgin bir zayıf konu görünmüyor. {TopicPhrase(strong.Take(2).ToList())} başarılı; daha zor sorularla ilerleyebilir."
                : "Belirgin bir zayıf konu görünmüyor.";
        }
        var parts = GroupWeak(weak).Select(group => $"{TopicPhrase(group.Topics)}: {RecommendationFor(group.Diagnosis)}");
        var note = string.Join(" ", parts);
        if (strong.Count > 0)
        {
            note += $" {TopicPhrase(strong.Take(2).ToList())} başarılı.";
        }
        return note;
    }
}
