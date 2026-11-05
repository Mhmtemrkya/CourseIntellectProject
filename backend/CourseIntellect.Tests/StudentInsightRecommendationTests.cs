using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>Öneri katmanı: yeni teşhisler, öncelik, soru sayısı ve öğretmen için sınıf önerileri.</summary>
public sealed class StudentInsightRecommendationTests
{
    private static readonly Guid Me = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);

    private static IEnumerable<InsightAnswer> Answers(Guid student, string topic, string pattern, DateTime from, string subject = "Matematik")
        => pattern.Select((c, i) => new InsightAnswer(student, subject, topic,
            c == '1' ? AnswerOutcome.Correct : c == '0' ? AnswerOutcome.Wrong : AnswerOutcome.Blank, from.AddHours(i)));

    private static TopicInsightDto Topic(IReadOnlyList<InsightAnswer> answers, string topic)
        => StudentInsightCalculator.ComputeTopics(Me, answers).Single(item => item.Topic == topic);

    [Fact]
    public void Improving_WhenWeakButRecentHalfIsMuchBetter()
    {
        // İlk yarı 0/5, son yarı 4/5 → toplam %40 (zayıf) ama yükselişte.
        var answers = Answers(Me, "Kesirler", "0000011110", Start).ToList();
        var topic = Topic(answers, "Kesirler");
        Assert.Equal("up", topic.Trend);
        Assert.Equal("improving", topic.Diagnosis);
        Assert.InRange(topic.SuggestedQuestions ?? 0, 10, 15);
    }

    [Fact]
    public void ClassWide_WhenTheWholeClassIsAlsoLow()
    {
        var other = Guid.NewGuid();
        var answers = Answers(Me, "Olasılık", "00100", Start)
            .Concat(Answers(other, "Olasılık", "0010001", Start)).ToList();
        Assert.Equal("class_wide", Topic(answers, "Olasılık").Diagnosis);
    }

    [Fact]
    public void Stale_IsMeasuredAgainstNewestClassAnswer_NotTheClock()
    {
        // Konu Eylül başında çalışıldı; sınıfın en yeni cevabı 40 gün sonra (başka konu).
        var answers = Answers(Me, "Üslü Sayılar", "00100", Start)
            .Concat(Answers(Me, "Kesirler", "11111", Start.AddDays(40))).ToList();
        Assert.Equal("stale", Topic(answers, "Üslü Sayılar").Diagnosis);
        Assert.Equal(Start.AddHours(4), Topic(answers, "Üslü Sayılar").LastPracticedAtUtc);

        // Aynı veri her zaman aynı sonuç (deterministik).
        Assert.Equal(StudentInsightCalculator.ComputeTopics(Me, answers), StudentInsightCalculator.ComputeTopics(Me, answers));
    }

    [Fact]
    public void Priority_PutsTheLowestHeavilyPractisedTopicFirst()
    {
        var answers = Answers(Me, "A Konusu", "0000000000110000", Start)   // %12.5, çok soru
            .Concat(Answers(Me, "B Konusu", "11000", Start.AddDays(1)))         // %40, az soru
            .ToList();
        var weak = StudentInsightCalculator.RankWeak(StudentInsightCalculator.ComputeTopics(Me, answers));
        Assert.Equal(["A Konusu", "B Konusu"], weak.Select(item => item.Topic));
        Assert.Equal(1, weak[0].Priority);
    }

    [Theory]
    [InlineData(0, null, 10)]
    [InlineData(7, null, 15)]
    [InlineData(30, null, 40)]
    [InlineData(30, "improving", 15)]
    public void SuggestedQuestions_AreRoundedAndBounded(int missed, string? diagnosis, int expected)
        => Assert.Equal(expected, StudentInsightCalculator.SuggestedQuestionsFor(missed, diagnosis));

    [Fact]
    public void ClassActions_ReviewWhenManyStruggle_StudyGroupWhenFew_NothingOnThinData()
    {
        var topics = new List<ClassTopicInsightDto>
        {
            new("Matematik", "Olasılık", 120, 35m, 10, 5),   // %50 zorlanıyor → sınıf tekrarı
            new("Matematik", "Kesirler", 90, 70m, 10, 2),    // 2 öğrenci → etüt grubu
            new("Türkçe", "Fiiller", 40, 80m, 8, 1),         // tek öğrenci → öneri yok
        };
        var strugglers = new Dictionary<(string, string), IReadOnlyList<(string Name, int Missed)>>
        {
            [("Matematik", "Olasılık")] = [("A", 8), ("B", 6), ("C", 7), ("D", 9), ("E", 5)],
            [("Matematik", "Kesirler")] = [("Zeynep", 4), ("Ali", 6)],
            [("Türkçe", "Fiiller")] = [("Can", 3)],
        };

        var actions = StudentInsightCalculator.ComputeClassActions(topics, strugglers);

        var review = Assert.Single(actions, item => item.Kind == "class_review");
        Assert.Equal("Olasılık", review.Topic);
        Assert.Empty(review.StudentNames);
        var group = Assert.Single(actions, item => item.Kind == "study_group");
        Assert.Equal(["Ali", "Zeynep"], group.StudentNames);
        Assert.DoesNotContain(actions, item => item.Topic == "Fiiller");
        Assert.Empty(StudentInsightCalculator.ComputeClassActions([], new Dictionary<(string, string), IReadOnlyList<(string, int)>>()));
    }

    [Theory]
    [InlineData("1111100", 0, "improved")]     // %71 vs %40
    [InlineData("1100100", 0, "steady")]       // %43 vs %40
    [InlineData("0000000", 0, "declined")]     // %0 vs %40
    [InlineData("11", 0, "pending")]           // 2 yeni cevap yetmez
    [InlineData("", 10, "pending")]            // 10 gün, hiç cevap yok ama pencere dolmadı
    [InlineData("", 30, "not_practiced")]      // 28 gün geçti, konu hiç çalışılmadı
    public void Followup_ComparesAnswersAfterTheRecommendation(string after, int daysLater, string expected)
    {
        var issued = Start.AddDays(5);
        var answers = Answers(Me, "Kesirler", "0000011111", Start)          // öneriden önce: sayılmaz
            .Concat(Answers(Me, "Kesirler", after, issued.AddHours(1)))
            .Concat(Answers(Me, "Olasılık", "1111111", issued.AddHours(1))); // başka konu: sayılmaz
        var result = StudentInsightCalculator.EvaluateFollowup("Matematik", "Kesirler", "misconception", issued, 40m, answers, issued.AddDays(Math.Max(daysLater, 1)));
        Assert.Equal(expected, result.Status);
        Assert.Equal(after.Length, result.AfterSolved);
    }

    [Theory]
    [InlineData("improving")]
    [InlineData("class_wide")]
    [InlineData("stale")]
    [InlineData("skipping")]
    [InlineData("declining")]
    [InlineData("misconception")]
    public void EveryDiagnosis_HasLabelAndRecommendation(string diagnosis)
    {
        Assert.NotEmpty(StudentInsightCalculator.DiagnosisLabel(diagnosis));
        Assert.NotEmpty(StudentInsightCalculator.RecommendationFor(diagnosis));
    }
}
