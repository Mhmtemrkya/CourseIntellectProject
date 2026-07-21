using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Kural motorunu yerel LLM ile destekleyen hibrit ayrıştırıcı.
///
/// Akış:
/// 1. Kural motoru çalışır (hızlı, bedava, deterministik). Bir niyet bulursa
///    ANINDA döner — mesajların çoğu buradan geçer, LLM hiç çağrılmaz.
/// 2. Kural motoru Unknown dönerse yerel LLM'e sorulur. Model yalnız bir NİYET
///    ETİKETİ seçer; varlıklar (ad, numara, sınıf) kuralın zaten çıkardığı
///    değerlerden gelir. Böylece LLM çıktısı doğrulanır ve ayrıştırma açıklanabilir kalır.
/// 3. LLM kapalı/ulaşılamaz/geçersiz cevap → kuralın Unknown sonucu döner.
///    Asistan hiçbir hâlde bloklanmaz veya çökmez.
///
/// GÜVENLİK: LLM yalnız bir etiket önerir. Kurum kapsamı, rol, modül ve yazma
/// onayı kapıları AssistantService'te aynen uygulanır; LLM hiçbir yetkiyi
/// yükseltemez. Yazma eylemleri bilerek LLM adaylarının dışında tutulur.
/// </summary>
public sealed class HybridAssistantIntentResolver(
    RuleBasedAssistantIntentResolver rules,
    ILocalLlmClient llm) : IAssistantIntentResolver
{
    public async Task<ParsedAssistantQuery> ResolveAsync(string message, CancellationToken cancellationToken = default)
    {
        var ruleResult = rules.Resolve(message);

        // Kural motoru sınıflayabildiyse LLM'e hiç gitme.
        if (ruleResult.Intent != AssistantIntent.Unknown || !llm.IsEnabled)
            return ruleResult;

        var raw = await llm.ClassifyIntentAsync(
            message,
            AssistantIntentCatalog.ClassifiableIntents.ToDictionary(x => x.Key.ToString(), x => x.Value),
            cancellationToken);

        // Model geçerli bir sınıflanabilir niyet döndürdüyse yalnız etiketi değiştir;
        // varlıklar kuralın çıkardığı değerlerde kalır.
        return AssistantIntentCatalog.TryParseClassifiable(raw, out var llmIntent)
            ? ruleResult with { Intent = llmIntent }
            : ruleResult;
    }
}
