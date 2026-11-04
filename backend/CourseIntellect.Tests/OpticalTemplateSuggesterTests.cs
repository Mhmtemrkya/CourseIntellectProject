using System.Text;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Dosyadan şablon önerisi. Sabit genişlikli örnek dosyalar burada üretilir; internetten alınan
/// üçüncü taraf örneği (sanal veri) yalnız yerelde varsa okunur, depoya kopyalanmaz.
/// </summary>
public sealed class OpticalTemplateSuggesterTests
{
    static OpticalTemplateSuggesterTests() => Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

    private static readonly string[] Names =
        ["AYŞE DEMİR", "IŞIL ÇAĞLAR ÖZGÜR", "MEHMET ŞAHİN", "Ali Can", "ZEYNEP NUR KAYA", "ÖMER FARUK YILDIZ", "ECE", "BURAK İNCE", "GÜLŞEN AK", "UĞUR TAŞ", "SELİN ÇELİK", "HAKAN YÜCE"];

    private static string Answers(int seed, int count, int blanks = 0, int multi = 0)
    {
        var random = new Random(seed);
        var chars = Enumerable.Range(0, count).Select(_ => "ABCDE"[random.Next(5)]).ToArray();
        for (var i = 0; i < blanks; i++) chars[random.Next(count)] = ' ';
        for (var i = 0; i < multi; i++) chars[random.Next(count)] = '*';
        return new string(chars);
    }

    /// <summary>Düzen 1: no(10, baştaki sıfır) | ad(25) | sınıf(4) | kitapçık(1) | cevaplar(40).</summary>
    private static List<string> LayoutOne(int rows = 24) => Enumerable.Range(0, rows).Select(i =>
        $"{(i * 37 + 1001).ToString("D10")}{Names[i % Names.Length].PadRight(25)}{$"{9 + i % 4}-{"ABC"[i % 3]}".PadRight(4)}{"AB"[i % 2]}{Answers(i, 40, blanks: i % 3, multi: i % 5 == 0 ? 1 : 0)}").ToList();

    /// <summary>Düzen 2: ad(20) | kurum kodu(5, sabit) | no(6) | cevaplar(30) — sınıf ve kitapçık yok.</summary>
    private static List<string> LayoutTwo(int rows = 20) => Enumerable.Range(0, rows).Select(i =>
        $"{Names[i % Names.Length].PadRight(20)}34001{(i * 50003 + 100).ToString().PadLeft(6)}{Answers(100 + i, 30, blanks: 1)}").ToList();

    private static byte[] Utf8(IEnumerable<string> lines) => Encoding.UTF8.GetBytes(string.Join("\r\n", lines));
    private static byte[] Cp1254(IEnumerable<string> lines) => Encoding.GetEncoding(1254).GetBytes(string.Join("\r\n", lines));

    private static OpticalTemplateSuggestionDto Detect(byte[] bytes, string encoding = "auto") => OpticalLayoutDetector.Detect(bytes, encoding).Suggestion;
    private static OpticalSuggestedFieldDto Field(OpticalTemplateSuggestionDto suggestion, string key) => suggestion.Fields.Single(item => item.Key == key);

    [Theory]
    [InlineData("utf-8")]
    [InlineData("windows-1254")]
    public void LayoutOne_DetectsAllFields_WithTurkishText(string encoding)
    {
        var bytes = encoding == "utf-8" ? Utf8(LayoutOne()) : Cp1254(LayoutOne());
        var result = Detect(bytes);

        Assert.True(result.Supported);
        Assert.Equal(encoding, result.Encoding);
        Assert.Equal((1, 10), (Field(result, "studentNo").Start, Field(result, "studentNo").Length));
        Assert.Equal((11, 25), (Field(result, "name").Start, Field(result, "name").Length));
        Assert.Equal((36, 4), (Field(result, "class").Start, Field(result, "class").Length));
        Assert.Equal((40, 1), (Field(result, "booklet").Start, Field(result, "booklet").Length));
        var block = Assert.Single(result.AnswerBlocks);
        Assert.Equal(("Cevap bloğu 1", 41, 40), (block.Label, block.Start, block.Count));
        Assert.Equal(["A", "B"], result.Booklets);
        Assert.Contains("Baştaki sıfırlar", Field(result, "studentNo").Reason);
        Assert.Contains(result.Warnings, item => item.Contains("soru sıralarının aynı olduğu varsayılmadı"));
        Assert.Equal("not-needed", result.AiStatus);
    }

    [Fact]
    public void LayoutTwo_MissingFieldsAreNotInvented_AndConstantCodeIsNotStudentNumber()
    {
        var result = Detect(Utf8(LayoutTwo()));

        Assert.Equal((1, 20), (Field(result, "name").Start, Field(result, "name").Length));
        Assert.Equal((26, 6), (Field(result, "studentNo").Start, Field(result, "studentNo").Length));
        Assert.Equal("none", Field(result, "class").Confidence);
        Assert.Equal(0, Field(result, "class").Length);
        Assert.Contains("Algılanamadı", Field(result, "booklet").Reason);
        Assert.Equal(0, Field(result, "booklet").Length);
        var code = Assert.Single(result.NumberCandidates, item => item.Constant);
        Assert.Equal((21, 5), (code.Start, code.Length));
        Assert.Contains(result.Warnings, item => item.Contains("kurum ya da sınav kodu"));
        Assert.Equal((32, 30), (result.AnswerBlocks[0].Start, result.AnswerBlocks[0].Count));
    }

    [Fact]
    public void TwoVaryingNumberFields_AreOfferedAsCandidates_WithLowConfidence()
    {
        var lines = Enumerable.Range(0, 20).Select(i =>
            $"{Names[i % Names.Length].PadRight(20)}{(i * 7 + 500).ToString("D5")} {(i * 31 + 100000).ToString("D8")}{Answers(i, 20)}");
        var result = Detect(Utf8(lines));

        Assert.Equal(2, result.NumberCandidates.Count(item => !item.Constant));
        Assert.Equal("low", Field(result, "studentNo").Confidence);
        Assert.Contains(result.Confirmations, item => item.Contains("Birden fazla rakam alanı"));
    }

    [Fact]
    public void TrailingBlanksAndShortLines_AskToConfirmQuestionCount()
    {
        var lines = LayoutOne().Select((line, i) => i % 4 == 0 ? line.TrimEnd() + "" : line + "     ").ToList();
        lines[3] = lines[3][..70];
        var result = Detect(Utf8(lines));
        var block = Assert.Single(result.AnswerBlocks);
        Assert.True(block.CountNeedsConfirmation);
        Assert.Contains(result.Confirmations, item => item.Contains("Gerçek soru sayısını doğrulayın"));
    }

    [Fact]
    public void HeaderAndAnswerKeyLines_AreFlagged_NotCountedSilently()
    {
        var lines = LayoutOne();
        lines.Insert(0, "OGRENCI NO ADI SOYADI              SINIF K CEVAPLAR".PadRight(80));
        // Kitapçık sütunu boş bırakılmış anahtar satırı: ilk turda kitapçığı bozar, ayıklanınca ikinci turda bulunur.
        lines.Insert(1, new string(' ', 40) + Answers(999, 40));
        var result = Detect(Utf8(lines));

        Assert.Contains(result.FlaggedLines, item => item.Line == 1 && item.Kind is "header" or "length");
        Assert.True(result.FlaggedLines.Any(item => item.Line == 2 && item.Kind == "answer-key"),
            string.Join(" | ", result.Fields.Select(f => $"{f.Key}:{f.Start}/{f.Length}")) + " blocks " + string.Join(",", result.AnswerBlocks.Select(b => $"{b.Start}/{b.Count}")));
        Assert.Equal((11, 25), (Field(result, "name").Start, Field(result, "name").Length));
        Assert.Equal((40, 1), (Field(result, "booklet").Start, Field(result, "booklet").Length));
        Assert.Equal((41, 40), (result.AnswerBlocks[0].Start, result.AnswerBlocks[0].Count));
    }

    [Fact]
    public void DelimitedFile_IsNotTreatedAsFixedWidth()
    {
        var result = Detect(Utf8(Enumerable.Range(0, 10).Select(i => $"{1000 + i};{Names[i]};10-A;A;{Answers(i, 20)}")));
        Assert.False(result.Supported);
        Assert.Equal("delimited", result.Format);
        Assert.Contains("yalnız sabit genişlikli", result.Message);
        Assert.True(result.ManualRecommended);
    }

    [Fact]
    public void GarbageFile_RecommendsManualEntry()
    {
        var result = Detect(Utf8(["merhaba dünya", "bu bir optik dosyası değil", "123"]));
        Assert.True(result.ManualRecommended);
        Assert.Empty(result.AnswerBlocks);
    }

    /// <summary>Üçüncü tarafın yayımladığı sanal örnek (Universal Analiz). Bilinen konumlar yalnız test beklentisidir.</summary>
    [Fact]
    public void InternetSample_MatchesKnownPositions_WhenAvailable()
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../output/optik-internet-ornek-2026-11-02/universal-analiz-orijinal.dat"));
        if (!File.Exists(path)) return;
        var result = Detect(File.ReadAllBytes(path));

        Assert.Equal("utf-8", result.Encoding);
        Assert.Equal((1, 20), (Field(result, "name").Start, Field(result, "name").Length));
        Assert.Equal((21, 10), (Field(result, "studentNo").Start, Field(result, "studentNo").Length));
        Assert.Equal((31, 1), (Field(result, "booklet").Start, Field(result, "booklet").Length));
        Assert.Equal((32, 95), (result.AnswerBlocks[0].Start, result.AnswerBlocks[0].Count));
        Assert.Equal(["A", "B", "C", "D"], result.Booklets);
        Assert.Equal(0, Field(result, "class").Length);
        Assert.True(result.AnswerBlocks[0].CountNeedsConfirmation);
    }

    // ─── Yerel model ─────────────────────────────────────────────────────────

    private sealed class FakeGenerator(Func<CancellationToken, Task<string?>> respond, bool enabled = true) : IInsightTextGenerator
    {
        public int Calls;
        public string LastPrompt = string.Empty;
        public bool IsEnabled => enabled;
        public string Model => "fake";
        public Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken)
        {
            Calls++;
            LastPrompt = messages[0].Content;
            return respond(cancellationToken);
        }
    }

    private static byte[] Ambiguous() => Utf8(Enumerable.Range(0, 20).Select(i =>
        $"{Names[i % Names.Length].PadRight(20)}{(i * 7 + 500).ToString("D5")} {(i * 31 + 100000).ToString("D8")}{Answers(i, 20)}"));

    [Fact]
    public async Task Model_Disabled_Unavailable_Invalid_Timeout_KeepRuleBasedSuggestion()
    {
        var baseline = Detect(Ambiguous());

        var disabled = await new OpticalTemplateSuggester(new FakeGenerator(_ => Task.FromResult<string?>(null), enabled: false)).SuggestAsync(Ambiguous(), "auto");
        Assert.Equal("disabled", disabled.AiStatus);

        var unavailable = await new OpticalTemplateSuggester(new FakeGenerator(_ => Task.FromResult<string?>(null))).SuggestAsync(Ambiguous(), "auto");
        Assert.Equal("unavailable", unavailable.AiStatus);

        var invalid = await new OpticalTemplateSuggester(new FakeGenerator(_ => Task.FromResult<string?>("{ bu json değil"))).SuggestAsync(Ambiguous(), "auto");
        Assert.Equal("invalid", invalid.AiStatus);

        var unknownId = await new OpticalTemplateSuggester(new FakeGenerator(_ => Task.FromResult<string?>("""{"segments":[{"id":"s99","label":"name","reason":"x"}]}"""))).SuggestAsync(Ambiguous(), "auto");
        Assert.Equal("invalid", unknownId.AiStatus);

        // Model hiç yanıt vermez; bütçe dolunca iptal sinyali modele ulaşır ve kurallı öneri döner (dış istek iptal edilmez).
        var cancelledByBudget = false;
        var hang = new FakeGenerator(async token =>
        {
            try { await Task.Delay(Timeout.Infinite, token); }
            catch (OperationCanceledException) { cancelledByBudget = true; throw; }
            return null;
        });
        using var outer = new CancellationTokenSource();
        var timedOut = await new OpticalTemplateSuggester(hang) { Budget = TimeSpan.FromMilliseconds(300) }.SuggestAsync(Ambiguous(), "auto", outer.Token);
        Assert.Equal("timeout", timedOut.AiStatus);
        Assert.True(cancelledByBudget);
        Assert.False(outer.IsCancellationRequested);

        foreach (var result in new[] { disabled, unavailable, invalid, unknownId, timedOut })
            Assert.Equal(baseline.Fields.Select(item => (item.Key, item.Start, item.Length, item.Confidence)), result.Fields.Select(item => (item.Key, item.Start, item.Length, item.Confidence)));
    }

    [Fact]
    public async Task Model_GetsMaskedShapesOnly_AndCanOnlyPickAmongCandidates()
    {
        var detection = OpticalLayoutDetector.Detect(Ambiguous(), "auto");
        var second = detection.Segments.Single(item => item.Kind == "digits" && item.Start == 21);
        var others = detection.Segments.Where(item => item.Id != second.Id).Select(item => $$"""{"id":"{{item.Id}}","label":"{{(item.Kind == "digits" ? "institutionCode" : item.Kind == "text" ? "name" : "answers")}}","reason":"r"}""");
        var json = $$"""{"segments":[{"id":"{{second.Id}}","label":"studentNo","reason":"öğrenciye göre değişiyor"},{{string.Join(',', others)}}]}""";
        var fake = new FakeGenerator(_ => Task.FromResult<string?>(json));

        var result = await new OpticalTemplateSuggester(fake).SuggestAsync(Ambiguous(), "auto");

        Assert.Equal(1, fake.Calls);
        Assert.DoesNotContain("AYŞE", fake.LastPrompt);
        Assert.DoesNotContain("MEHMET", fake.LastPrompt);
        Assert.Equal("used", result.AiStatus);
        var number = Field(result, "studentNo");
        Assert.Equal((21, 5, "low"), (number.Start, number.Length, number.Confidence));
        Assert.Contains("Yerel model", number.Reason);
    }

    [Fact]
    public async Task Model_LabelingBothNumbersAsStudentNo_MeansUndecided_NotChosen()
    {
        var detection = OpticalLayoutDetector.Detect(Ambiguous(), "auto");
        var digits = detection.Segments.Where(item => item.Kind == "digits").Select(item => $$"""{"id":"{{item.Id}}","label":"studentNo","reason":"x"}""");
        var json = $$"""{"segments":[{{string.Join(',', digits)}}]}""";
        var baseline = Detect(Ambiguous());
        var result = await new OpticalTemplateSuggester(new FakeGenerator(_ => Task.FromResult<string?>(json))).SuggestAsync(Ambiguous(), "auto");
        Assert.Equal("used", result.AiStatus);
        Assert.Contains(result.AiNotes, item => item.Contains("karar veremedi"));
        Assert.Equal((Field(baseline, "studentNo").Start, "low"), (Field(result, "studentNo").Start, Field(result, "studentNo").Confidence));
    }

    [Fact]
    public async Task Model_ContradictingKind_IsRejected()
    {
        var detection = OpticalLayoutDetector.Detect(Ambiguous(), "auto");
        var text = detection.Segments.First(item => item.Kind == "text");
        var json = $$"""{"segments":[{"id":"{{text.Id}}","label":"studentNo","reason":"x"}]}""";
        var result = await new OpticalTemplateSuggester(new FakeGenerator(_ => Task.FromResult<string?>(json))).SuggestAsync(Ambiguous(), "auto");
        Assert.Equal("invalid", result.AiStatus);
    }

    [Fact]
    public async Task ClearFile_DoesNotCallModel()
    {
        var fake = new FakeGenerator(_ => Task.FromResult<string?>("{}"));
        var result = await new OpticalTemplateSuggester(fake).SuggestAsync(Utf8(LayoutOne()), "auto");
        Assert.Equal(0, fake.Calls);
        Assert.Equal("not-needed", result.AiStatus);
    }
}
