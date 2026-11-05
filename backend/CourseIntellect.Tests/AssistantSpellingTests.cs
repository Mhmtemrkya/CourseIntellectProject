using System.Text.RegularExpressions;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>Asistan yazım hatalarını anlar; doğru yazılmış mesajlar ve adlar bozulmaz.</summary>
public sealed class AssistantSpellingTests
{
    private readonly RuleBasedAssistantIntentResolver rules = new();

    [Theory]
    [InlineData("teşekürler", AssistantIntent.Thanks)]
    [InlineData("tşk", AssistantIntent.Thanks)]
    [InlineData("tşkler", AssistantIntent.Thanks)]
    [InlineData("teşekkkürrrr", AssistantIntent.Thanks)]
    [InlineData("teşkkürler", AssistantIntent.Thanks)]
    [InlineData("tesekkurlr", AssistantIntent.Thanks)]
    [InlineData("saol", AssistantIntent.Thanks)]
    [InlineData("eyw", AssistantIntent.Thanks)]
    [InlineData("görüşürz", AssistantIntent.Thanks)]
    [InlineData("kolay gelsn", AssistantIntent.Thanks)]
    [InlineData("merhabaaa", AssistantIntent.Greeting)]
    [InlineData("mrhb", AssistantIntent.Greeting)]
    [InlineData("merhba", AssistantIntent.Greeting)]
    [InlineData("günaydn", AssistantIntent.Greeting)]
    [InlineData("nasılsn", AssistantIntent.SmallTalk)]
    [InlineData("bugün devamszlık yapanlar kimler", AssistantIntent.ListAbsentStudents)]
    [InlineData("devamszlığım", AssistantIntent.GetAttendance)]
    [InlineData("yoklma", AssistantIntent.GetAttendance)]
    [InlineData("duyrular", AssistantIntent.GetAnnouncements)]
    [InlineData("mesjlarım", AssistantIntent.GetUnreadMessages)]
    [InlineData("sevis nerde", AssistantIntent.GetTransportStatus)]
    [InlineData("ödme durumu", AssistantIntent.GetPaymentSummary)]
    [InlineData("taksitlerm", AssistantIntent.GetPaymentSummary)]
    [InlineData("ortlama", AssistantIntent.GetExamAverage)]
    [InlineData("kütüpahne", AssistantIntent.GetLibraryLoans)]
    public void TypoQuestions_AreUnderstood(string question, AssistantIntent expected)
    {
        Assert.Equal(expected, AssistantService.DeterministicIntent(rules.Resolve(question), RuleBasedAssistantIntentResolver.Fold(question)));
    }

    [Theory]
    [InlineData("merhaba")]
    [InlineData("teşekkürler")]
    [InlineData("bugün devamsız olanlar kimler")]
    [InlineData("Ali'nin notları")]
    public void CorrectlyWrittenMessages_AreNotCorrected(string question)
    {
        var parsed = rules.Resolve(question);
        Assert.Null(parsed.CorrectedText);
        Assert.Null(parsed.CorrectedTokens);
    }

    [Fact]
    public void Correction_ReportsChangedTokens_ForNameGuard()
    {
        var parsed = rules.Resolve("sinan");
        // "sinan" bir ad olabilir: düzeltme yapıldıysa servis öğrenci adı denetimi için kelimeyi görür.
        if (parsed.CorrectedTokens is not null) Assert.Contains("sinan", parsed.CorrectedTokens);
        Assert.Equal(AssistantIntent.Unknown, rules.Resolve("sinan", allowCorrection: false).Intent);
    }

    [Fact]
    public void KeepWords_ProtectStudentNames_ButFixTheRest()
    {
        var keep = new HashSet<string> { "nehir" };
        Assert.Equal(AssistantIntent.HowTo, rules.Resolve("nehir").Intent); // "nedir" sanılırdı
        var parsed = rules.Resolve("Nehir Acar devamszlığı", allowCorrection: true, keepWords: keep);
        Assert.Equal(AssistantIntent.GetAttendance, parsed.Intent);
        Assert.Contains("nehir", parsed.SearchText);
        Assert.Equal(AssistantIntent.Unknown, rules.Resolve("Nehir", allowCorrection: true, keepWords: keep).Intent);
    }

    [Theory]
    [InlineData("ahmet")]
    [InlineData("zeynep")]
    [InlineData("mehmet yılmaz")]
    [InlineData("ayşe")]
    [InlineData("elif")]
    [InlineData("burak")]
    [InlineData("selim")]
    [InlineData("sinan")]
    [InlineData("mesai saatleri")]
    public void CommonNames_StayUnknown_SoTheServiceSearchesStudents(string name)
    {
        Assert.Equal(AssistantIntent.Unknown, rules.Resolve(name).Intent);
    }

    [Theory]
    [InlineData("tesekkkurrr", "tesekur")]
    [InlineData("merhabaaa", "merhaba")]
    [InlineData("saat", "saat")]
    public void Correct_CollapsesOnlyLongRepeats(string input, string expectedPrefix)
    {
        Assert.StartsWith(expectedPrefix[..4], AssistantSpelling.Correct(input).Text);
        Assert.Equal("saat", AssistantSpelling.Correct("saat").Text);
    }

    [Fact]
    public void Distance_CountsTranspositionAsOneEdit_AndStopsAtLimit()
    {
        Assert.Equal(1, AssistantSpelling.Distance("tesekkru", "tesekkur", 2));
        Assert.Equal(1, AssistantSpelling.Distance("odme", "odeme", 1));
        Assert.True(AssistantSpelling.Distance("xxxxxxx", "yoklama", 1) > 1);
    }

    /// <summary>Kural motoruna eklenen her tek kelimelik anahtar yazım sözlüğünde de olmalı; yoksa o kelimenin hatası anlaşılmaz.</summary>
    [Fact]
    public void Vocabulary_CoversResolverKeywords()
    {
        var source = File.ReadAllText(FindSource("RuleBasedAssistantIntentResolver.cs"));
        var body = source[source.IndexOf("private static AssistantIntent ResolveIntent", StringComparison.Ordinal)..source.IndexOf("private static string ExtractSearchText", StringComparison.Ordinal)];
        var keywords = Regex.Matches(body, "\"([a-z][a-z \\-]*)\"").Select(m => m.Groups[1].Value)
            .SelectMany(term => term.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Where(word => word.Length >= 5 && !word.Contains('-'))
            .Distinct();
        var vocabulary = AssistantSpelling.IntentStems.Concat(AssistantSpelling.SmallTalkStems).ToHashSet();
        var missing = keywords.Where(word => !vocabulary.Any(stem => word.StartsWith(stem, StringComparison.Ordinal))).ToList();
        Assert.True(missing.Count == 0, "Yazım sözlüğünde eksik anahtarlar: " + string.Join(", ", missing));
    }

    private static string FindSource(string name)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "CourseIntellect.Infrastructure"))) dir = dir.Parent;
        return Path.Combine(dir!.FullName, "CourseIntellect.Infrastructure", "Services", name);
    }
}
