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
/// - Teşhis (yalnız zayıf konuda), bu sırayla: boşlar çoksa skipping, düşüşteyse declining, yükselişteyse
///   improving, sınıfın da başarısı düşükse class_wide, konuda son cevap sınıfın en yeni cevabından
///   <see cref="StaleDays"/>+ gün önceyse stale, aksi hâlde misconception. "Bugün" kullanılmaz: aynı veri
///   her zaman aynı sonucu verir.
/// - Öncelik: zayıf konular başarı açığı (%60'a ve sınıf ortalamasına göre), düşüş ve çözülen soru
///   sayısıyla puanlanır; çok soru çözülmüş ve en düşük konu önce gelir. Sınav ağırlığı varsayılmaz.
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
    public const int StaleDays = 30;
    public const decimal PriorityTarget = 60m;
    public const int MinSuggestedQuestions = 10;
    public const int MaxSuggestedQuestions = 40;
    // Sınıf önerisi: en az bu kadar öğrenci zorlanıyorsa ve konuda soru çözenlerin bu oranındaysa sınıf tekrarı.
    public const int ClassReviewMinStudents = 3;
    public const decimal ClassReviewShare = 40m;
    public const int StudyGroupMinStudents = 2;
    // Öneri ölçümü: en az bu kadar yeni cevap gelince değerlendirilir; fark bu kadar puansa ilerleme/düşüş.
    public const int FollowupMinAnswers = 5;
    public const decimal FollowupDelta = 15m;
    public const int RecommendationWindowDays = 28;

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
        var reference = classAnswers.Count == 0 ? DateTime.MinValue : classAnswers.Max(item => item.AtUtc);
        var others = classAnswers.Where(item => item.StudentUserId != studentUserId)
            .GroupBy(item => (item.Subject, item.Topic))
            .ToDictionary(group => group.Key, group => (Correct: group.Count(item => item.Outcome == AnswerOutcome.Correct), Total: group.Count()));

        var topics = mine
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
                var lastPracticed = ordered[^1].AtUtc;
                if (weak)
                {
                    var blankShare = Rate(blank, ordered.Count);
                    diagnosis = blankShare >= SkippingBlankShare && blank >= wrong ? "skipping"
                        : trend == "down" ? "declining"
                        : trend == "up" ? "improving"
                        : classRate is decimal everyone && everyone < WeakAbsolute ? "class_wide"
                        : (reference - lastPracticed).TotalDays >= StaleDays ? "stale"
                        : "misconception";
                }

                return new TopicInsightDto(group.Key.Subject, group.Key.Topic, ordered.Count, correct, wrong, blank, success,
                    classRate, previous, recent, trend, enough, weak, strong, diagnosis,
                    LastPracticedAtUtc: weak ? lastPracticed : null,
                    SuggestedQuestions: weak ? SuggestedQuestionsFor(wrong + blank, diagnosis) : null);
            })
            .ToList();

        // Öncelik sırası yalnız zayıf konular arasında verilir (1 = önce çalışılacak).
        var ranked = topics.Where(item => item.IsWeak)
            .OrderByDescending(PriorityScore)
            .ThenBy(item => item.SuccessRate)
            .ThenByDescending(item => item.Solved)
            .ThenBy(item => item.Topic, TrComparer)
            .Select((item, index) => (Key: (item.Subject, item.Topic), Rank: index + 1))
            .ToDictionary(item => item.Key, item => item.Rank);
        return topics
            .Select(item => ranked.TryGetValue((item.Subject, item.Topic), out var rank) ? item with { Priority = rank } : item)
            .OrderBy(item => item.Subject, TrComparer)
            .ThenBy(item => item.Topic, TrComparer)
            .ToList();
    }

    /// <summary>
    /// Zayıf konunun öncelik puanı: hedefe (%60) ve sınıf ortalamasına göre açık, düşüş ve konuda çözülen
    /// soru sayısı (çok çalışılıp hâlâ düşük olan konu önce). Toparlanan konu biraz geriye alınır.
    /// </summary>
    public static decimal PriorityScore(TopicInsightDto topic)
    {
        var gap = Math.Max(0m, PriorityTarget - topic.SuccessRate);
        var classGap = topic.ClassSuccessRate is decimal rate ? Math.Max(0m, rate - topic.SuccessRate) / 2m : 0m;
        var volume = Math.Min(topic.Solved, 40) / 4m;
        var trend = topic.Trend switch { "down" => 15m, "up" => -10m, _ => 0m };
        var stale = topic.Diagnosis == "stale" ? 5m : 0m;
        return gap + classGap + volume + trend + stale;
    }

    /// <summary>Bu hafta için önerilen soru sayısı: yanlış ve boşun iki katı, 5'e yuvarlanmış, 10–40 arası.
    /// Toparlanan konuda pekiştirme yeterli (en fazla 15).</summary>
    public static int SuggestedQuestionsFor(int missed, string? diagnosis)
    {
        var raw = (int)Math.Ceiling(missed * 2 / 5.0) * 5;
        var max = diagnosis == "improving" ? 15 : MaxSuggestedQuestions;
        return Math.Clamp(raw, MinSuggestedQuestions, max);
    }

    /// <summary>
    /// Önerinin sonucu: öneriden SONRAKİ cevaplar öneri anındaki başarıyla karşılaştırılır. Yeterli yeni
    /// cevap yoksa pending; pencere (28 gün) dolup hiç çalışılmadıysa not_practiced.
    /// </summary>
    public static RecommendationFollowupDto EvaluateFollowup(
        string subject, string topic, string diagnosis, DateTime issuedAtUtc, decimal baseline,
        IEnumerable<InsightAnswer> studentAnswers, DateTime nowUtc)
    {
        var after = studentAnswers
            .Where(item => item.Subject == subject && item.Topic == topic && item.AtUtc > issuedAtUtc)
            .ToList();
        if (after.Count < FollowupMinAnswers)
        {
            var status = (nowUtc - issuedAtUtc).TotalDays >= RecommendationWindowDays && after.Count == 0 ? "not_practiced" : "pending";
            return new RecommendationFollowupDto(subject, topic, diagnosis, issuedAtUtc, baseline, after.Count, null, status);
        }
        var rate = Rate(after.Count(item => item.Outcome == AnswerOutcome.Correct), after.Count);
        var delta = rate - baseline;
        var outcome = delta >= FollowupDelta ? "improved" : delta <= -FollowupDelta ? "declined" : "steady";
        return new RecommendationFollowupDto(subject, topic, diagnosis, issuedAtUtc, baseline, after.Count, rate, outcome);
    }

    public static FollowupSummaryDto Summarize(IEnumerable<RecommendationFollowupDto> followups)
    {
        var list = followups.ToList();
        return new FollowupSummaryDto(
            list.Count(item => item.Status == "improved"),
            list.Count(item => item.Status == "steady"),
            list.Count(item => item.Status == "declined"),
            list.Count(item => item.Status == "pending"),
            list.Count(item => item.Status == "not_practiced"));
    }

    /// <summary>Zayıf konular öncelik sırasıyla (1 önce).</summary>
    public static IReadOnlyList<TopicInsightDto> RankWeak(IEnumerable<TopicInsightDto> topics) => topics
        .Where(item => item.IsWeak)
        .OrderBy(item => item.Priority ?? int.MaxValue)
        .ThenBy(item => item.SuccessRate)
        .ThenByDescending(item => item.Solved)
        .ToList();

    /// <summary>
    /// Sınıf düzeyinde öneriler. Konuda soru çözenlerin en az %<see cref="ClassReviewShare"/>'ı ve en az
    /// <see cref="ClassReviewMinStudents"/> öğrenci zorlanıyorsa sınıf tekrarı; daha az ama en az
    /// <see cref="StudyGroupMinStudents"/> öğrenci zorlanıyorsa etüt grubu. Veri yetersizse öneri yok.
    /// </summary>
    public static IReadOnlyList<ClassActionDto> ComputeClassActions(
        IReadOnlyList<ClassTopicInsightDto> topics,
        IReadOnlyDictionary<(string Subject, string Topic), IReadOnlyList<(string Name, int Missed)>> strugglers)
    {
        var reviews = new List<ClassActionDto>();
        var groups = new List<ClassActionDto>();
        foreach (var topic in topics.Where(item => item.StrugglingStudentCount > 0))
        {
            var list = strugglers.TryGetValue((topic.Subject, topic.Topic), out var found) ? found : [];
            var missed = list.Count == 0 ? 0 : (int)Math.Round(list.Average(item => item.Missed));
            var questions = SuggestedQuestionsFor(missed, null);
            var share = topic.StudentCount == 0 ? 0m : topic.StrugglingStudentCount * 100m / topic.StudentCount;
            if (topic.StrugglingStudentCount >= ClassReviewMinStudents && share >= ClassReviewShare)
            {
                reviews.Add(new ClassActionDto("class_review", topic.Subject, topic.Topic, topic.StrugglingStudentCount,
                    topic.StudentCount, topic.SuccessRate, [], questions));
            }
            else if (topic.StrugglingStudentCount >= StudyGroupMinStudents)
            {
                groups.Add(new ClassActionDto("study_group", topic.Subject, topic.Topic, topic.StrugglingStudentCount,
                    topic.StudentCount, topic.SuccessRate, list.Select(item => item.Name).OrderBy(name => name, TrComparer).ToList(), questions));
            }
        }
        return reviews
            .OrderByDescending(item => item.StrugglingStudentCount).ThenBy(item => item.SuccessRate).Take(3)
            .Concat(groups.OrderByDescending(item => item.StrugglingStudentCount).ThenBy(item => item.SuccessRate).Take(3))
            .ToList();
    }

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
        "improving" => "Toparlanma var; aynı tempoda devam edip haftada bir kısa tekrarla kazanımı pekiştirmesi önerilir.",
        "class_wide" => "Birçok öğrencinin zorlandığı bir konu; temel örneklerden başlayıp adım adım zorlaşan alıştırmalarla ilerlemesi önerilir.",
        "stale" => "Bu konu uzun süredir çalışılmamış; kısa bir hatırlatma tekrarı ve birkaç soruyla konuyu tazelemesi önerilir.",
        _ => string.Empty,
    };

    public static string DiagnosisLabel(string? diagnosis) => diagnosis switch
    {
        "skipping" => "boş bırakma eğilimi",
        "declining" => "son çalışmalarda düşüş",
        "misconception" => "yanlışlar ağırlıkta",
        "improving" => "toparlanıyor",
        "class_wide" => "birçok öğrencinin zorlandığı konu",
        "stale" => "uzun süredir çalışılmamış",
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
