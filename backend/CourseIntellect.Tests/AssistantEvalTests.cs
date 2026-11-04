using System.Diagnostics;
using System.Text.Json;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// Asistan ölçüm seti (AssistantEval/cases.json). Her soru için beklenen niyet ve varsa sınıf/eşik,
/// her rol için niyet izni doğrulanır. Kural motoru CI'da her değişiklikte koşar; yerel model
/// ölçümü yalnız ASSISTANT_EVAL_LLM=1 ile ve yalnız rapor üretir (CI Ollama'ya bağlı değildir).
/// Bilinen hatalar "knownFailure" ile gerekçesiyle işaretlenir; düzelince test işaretin kaldırılmasını ister.
/// </summary>
public sealed class AssistantEvalTests(ITestOutputHelper output)
{
    public sealed record EvalCase(string Q, string Intent, int? Grade, string? Section, decimal? Threshold, string? Note, string? KnownFailure)
    {
        public override string ToString() => Q;
    }

    public sealed record RoleCase(string Intent, string Role, bool Allowed)
    {
        public override string ToString() => $"{Intent} / {Role}";
    }

    private sealed record EvalFile(List<EvalCase> Cases, List<RoleCase> Roles);

    private static readonly Lazy<EvalFile> File = new(() =>
    {
        var path = Path.Combine(AppContext.BaseDirectory, "AssistantEval", "cases.json");
        return JsonSerializer.Deserialize<EvalFile>(System.IO.File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("Ölçüm seti okunamadı.");
    });

    public static IEnumerable<object[]> Cases() => File.Value.Cases.Select(item => new object[] { item });
    public static IEnumerable<object[]> Roles() => File.Value.Roles.Select(item => new object[] { item });

    private readonly RuleBasedAssistantIntentResolver rules = new();

    /// <summary>Yerel model kapalıyken sorunun varacağı niyet: kural motoru + analiz ifadelerinin kural aracı yönlendirmesi.</summary>
    private AssistantIntent Routed(string question) =>
        AssistantService.DeterministicIntent(rules.Resolve(question), RuleBasedAssistantIntentResolver.Fold(question));

    /// <summary>Beklentiyi karşılamayan alanlar; boşsa doğru.</summary>
    private static List<string> Mismatches(EvalCase item, AssistantIntent intent, int? grade, string? section, decimal? threshold)
    {
        var problems = new List<string>();
        if (intent.ToString() != item.Intent) problems.Add($"niyet {intent} (beklenen {item.Intent})");
        if (item.Grade is not null && grade != item.Grade) problems.Add($"sınıf {grade?.ToString() ?? "-"} (beklenen {item.Grade})");
        if (item.Section is not null && !string.Equals(section, item.Section, StringComparison.OrdinalIgnoreCase)) problems.Add($"şube {section ?? "-"} (beklenen {item.Section})");
        if (item.Threshold is not null && threshold != item.Threshold) problems.Add($"eşik {threshold?.ToString() ?? "-"} (beklenen {item.Threshold})");
        return problems;
    }

    [Fact]
    public void Fixture_IsWellFormed()
    {
        var file = File.Value;
        Assert.True(file.Cases.Count >= 150, $"ölçüm seti küçük: {file.Cases.Count}");
        Assert.All(file.Cases, item => Assert.True(Enum.TryParse<AssistantIntent>(item.Intent, out _), $"bilinmeyen niyet: {item.Intent}"));
        Assert.All(file.Roles, item => Assert.True(Enum.TryParse<AssistantIntent>(item.Intent, out _), $"bilinmeyen niyet: {item.Intent}"));
        Assert.Equal(file.Cases.Count, file.Cases.Select(item => item.Q.Trim().ToLowerInvariant()).Distinct().Count());
        // Yazma eylemleri yerel modelin seçebileceği niyetler arasında olmamalı (onay kapısı).
        Assert.DoesNotContain(AssistantIntentCatalog.ClassifiableIntents.Keys, AssistantIntentCatalog.IsWriteAction);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void RuleResolver_MatchesExpectation(EvalCase item)
    {
        var result = rules.Resolve(item.Q);
        var problems = Mismatches(item, Routed(item.Q), result.GradeLevel, result.SectionName, result.ScoreThreshold);
        if (item.KnownFailure is null)
        {
            Assert.True(problems.Count == 0, $"\"{item.Q}\": {string.Join(", ", problems)}");
        }
        else
        {
            Assert.False(problems.Count == 0, $"\"{item.Q}\" artık doğru çözülüyor; cases.json'daki knownFailure işaretini kaldırın.");
        }
    }

    [Theory]
    [MemberData(nameof(Roles))]
    public void RoleScope_MatchesExpectation(RoleCase item)
    {
        var intent = Enum.Parse<AssistantIntent>(item.Intent);
        Assert.Equal(item.Allowed, AssistantIntentCatalog.IsAllowedForRole(intent, item.Role));
    }

    /// <summary>Kategori bazında doğruluk özeti (test çıktısında okunur).</summary>
    [Fact]
    public void RuleResolver_Summary()
    {
        var results = File.Value.Cases.Select(item =>
        {
            var result = rules.Resolve(item.Q);
            var routed = Routed(item.Q);
            return (item, ok: Mismatches(item, routed, result.GradeLevel, result.SectionName, result.ScoreThreshold).Count == 0, got: routed);
        }).ToList();
        var correct = results.Count(row => row.ok);
        output.WriteLine($"Kural motoru + kural araçları: {correct}/{results.Count} doğru (%{correct * 100 / results.Count}).");
        foreach (var group in results.GroupBy(row => row.item.Intent).Where(group => group.Any(row => !row.ok && row.item.KnownFailure is null)))
            output.WriteLine($"  {group.Key}: {group.Count(row => row.ok)}/{group.Count()} — yanlış: {string.Join(" | ", group.Where(row => !row.ok).Select(row => $"\"{row.item.Q}\"→{row.got}"))}");
        foreach (var item in File.Value.Cases.Where(item => item.KnownFailure is not null))
            output.WriteLine($"  bilinen: \"{item.Q}\" — {item.KnownFailure}");
        Assert.Empty(results.Where(row => !row.ok && row.item.KnownFailure is null));
    }

    /// <summary>
    /// Yerel model ile hibrit çözücünün ölçümü. Yalnız ASSISTANT_EVAL_LLM=1 iken çalışır (Ollama gerekir);
    /// yalnız rapor üretir. Model: ASSISTANT_EVAL_MODEL (varsayılan qwen2.5:7b).
    /// </summary>
    [Fact]
    public async Task HybridResolver_LocalModelReport()
    {
        if (Environment.GetEnvironmentVariable("ASSISTANT_EVAL_LLM") != "1")
        {
            output.WriteLine("Atlandı: ASSISTANT_EVAL_LLM=1 değil.");
            return;
        }
        var model = Environment.GetEnvironmentVariable("ASSISTANT_EVAL_MODEL") ?? "qwen2.5:7b";
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Assistant:Llm:Enabled"] = "true",
            ["Assistant:Llm:Model"] = model,
            ["Assistant:Llm:TimeoutSeconds"] = "30",
        }).Build();
        using var http = new HttpClient();
        var hybrid = new HybridAssistantIntentResolver(rules, new OllamaIntentClient(http, configuration, NullLogger<OllamaIntentClient>.Instance));

        var correct = 0;
        var llmCalls = 0;
        var llmCorrect = 0;
        var watch = new Stopwatch();
        foreach (var item in File.Value.Cases)
        {
            var ruleIntent = rules.Resolve(item.Q).Intent;
            watch.Start();
            var result = await hybrid.ResolveAsync(item.Q);
            watch.Stop();
            // Servisteki gibi: modelin etiketinden sonra analiz ifadeleri kural aracına yönlendirilir.
            var routed = AssistantService.DeterministicIntent(result, RuleBasedAssistantIntentResolver.Fold(item.Q));
            var ok = Mismatches(item, routed, result.GradeLevel, result.SectionName, result.ScoreThreshold).Count == 0;
            if (ok) correct++;
            if (ruleIntent == AssistantIntent.Unknown)
            {
                llmCalls++;
                if (ok) llmCorrect++;
                output.WriteLine($"  model: \"{item.Q}\" → {routed} {(ok ? "✓" : $"✗ (beklenen {item.Intent})")}");
            }
        }
        output.WriteLine($"Hibrit ({model}): {correct}/{File.Value.Cases.Count} doğru; modele giden {llmCalls} sorudan {llmCorrect} doğru; toplam süre {watch.Elapsed.TotalSeconds:0.0} sn.");
    }
}
