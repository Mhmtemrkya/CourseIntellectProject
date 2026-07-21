using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Hibrit ayrıştırıcı: kural motoru önce, yerel LLM yalnız yedek. Bu testler
/// hem doğru davranışı hem de kritik güvenlik sınırlarını kilitler — özellikle
/// LLM'in bir YAZMA eylemi ya da geçersiz etiket döndürdüğü durumları.
/// </summary>
public sealed class HybridAssistantIntentResolverTests
{
    /// <summary>Testte LLM yerine geçen sahte istemci — ne döndüreceği ayarlanır, çağrıldı mı sayılır.</summary>
    private sealed class FakeLlm(string? returns, bool enabled = true) : ILocalLlmClient
    {
        public int CallCount { get; private set; }
        public bool IsEnabled => enabled;

        public Task<string?> ClassifyIntentAsync(string message, IReadOnlyDictionary<string, string> candidates, CancellationToken ct)
        {
            CallCount++;
            return Task.FromResult(returns);
        }
    }

    private static HybridAssistantIntentResolver Build(ILocalLlmClient llm)
        => new(new RuleBasedAssistantIntentResolver(), llm);

    [Fact]
    public async Task RuleMatch_DoesNotCallLlm()
    {
        var llm = new FakeLlm("GetFinanceOverview");
        var resolver = Build(llm);

        var result = await resolver.ResolveAsync("bekleyen ödevlerimi göster");

        Assert.Equal(AssistantIntent.GetHomework, result.Intent);
        Assert.Equal(0, llm.CallCount); // kural yakaladı, LLM'e gidilmedi
    }

    [Fact]
    public async Task Unknown_WithValidLlmLabel_SwapsIntent_KeepsParsedFields()
    {
        // Kuralın sınıflayamadığı nötr bir cümle (entity/anahtar kelime yok).
        // NOT: Kural motoru bir sınıf/numara/anahtar kelime bulursa zaten Unknown
        // dönmez ve LLM'e hiç gidilmez; bu yüzden gerçek yedek yolu ancak böyle
        // nötr bir cümleyle test edilir.
        const string message = "şu konuyu inceleyelim lütfen";
        var ruleOnly = new RuleBasedAssistantIntentResolver().Resolve(message);
        Assert.Equal(AssistantIntent.Unknown, ruleOnly.Intent); // önkoşul

        var resolver = Build(new FakeLlm("GetAnnouncements"));
        var result = await resolver.ResolveAsync(message);

        Assert.Equal(AssistantIntent.GetAnnouncements, result.Intent);
        // LLM yalnız etiketi değiştirir; kuralın ürettiği diğer alanlar korunur.
        Assert.Equal(ruleOnly.SearchText, result.SearchText);
        Assert.Equal(ruleOnly.NormalizedMessage, result.NormalizedMessage);
    }

    [Fact]
    public async Task Unknown_WithDisabledLlm_StaysUnknown()
    {
        var llm = new FakeLlm("GetHomework", enabled: false);
        var resolver = Build(llm);

        var result = await resolver.ResolveAsync("anlamsız bir şeyler zxcv");

        Assert.Equal(AssistantIntent.Unknown, result.Intent);
        Assert.Equal(0, llm.CallCount); // kapalıyken çağrılmaz
    }

    [Fact]
    public async Task Unknown_WithNullLlm_StaysUnknown()
    {
        // Ollama ulaşılamaz → istemci null döner → eski davranış korunur.
        var resolver = Build(new FakeLlm(null));

        var result = await resolver.ResolveAsync("qwerty asdf");

        Assert.Equal(AssistantIntent.Unknown, result.Intent);
    }

    /// <summary>
    /// GÜVENLİK: LLM bir yazma eylemi (SendDocumentReminder) döndürse bile kabul
    /// edilmez — yazma eylemleri sınıflanabilir listede yok. Aksi hâlde bulanık
    /// bir cümle onay kapısını tetikleyebilir, bu istenmez.
    /// </summary>
    [Fact]
    public async Task Llm_CannotSelectWriteAction()
    {
        // Nötr cümle → kural Unknown → LLM'e gidilir. LLM yazma eylemi önerir.
        const string message = "şunu bir halledelim artık";
        Assert.Equal(AssistantIntent.Unknown, new RuleBasedAssistantIntentResolver().Resolve(message).Intent);

        var resolver = Build(new FakeLlm("SendDocumentReminder"));
        var result = await resolver.ResolveAsync(message);

        Assert.Equal(AssistantIntent.Unknown, result.Intent);
    }

    [Fact]
    public async Task Llm_GarbageLabel_StaysUnknown()
    {
        var resolver = Build(new FakeLlm("HerpDerp"));

        var result = await resolver.ResolveAsync("bir şey");

        Assert.Equal(AssistantIntent.Unknown, result.Intent);
    }

    /// <summary>LLM, kurum kapsamından bağımsız yalnız etiket verir; kapsam kontrolü serviste kalır.</summary>
    [Fact]
    public async Task Llm_MayReturnAnyClassifiableLabel_ScopeEnforcedElsewhere()
    {
        // Okulda anlamsız olan bir sürücü niyetini bile LLM önerebilir; kurum
        // kapsamı burada değil AssistantService'te uygulanır. Burada yalnız
        // "geçerli sınıflanabilir etiket kabul edildi" doğrulanır.
        var resolver = Build(new FakeLlm("GetDrivingProgress"));

        var result = await resolver.ResolveAsync("adayın durumu ne alemde");

        Assert.Equal(AssistantIntent.GetDrivingProgress, result.Intent);
    }
}
