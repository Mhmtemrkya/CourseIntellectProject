using System.Text.Json;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Asistan ajanının konuştuğu, kurumun KENDİ sunucusundaki dil modeli (Ollama, araç çağırma).
/// Model rolün izinli araçlarından birini seçer; araç sunucuda, rol kapsamıyla çalışır ve
/// sonucu modele geri verilir. Araç sonuçları (öğrenci verisi) modele gider; bu yüzden model
/// yalnız yerel ağda olmalıdır — bulut adresi verilmez.
/// </summary>
public interface IAssistantChatModel
{
    bool IsEnabled { get; }

    /// <summary>
    /// Analiz aracından sonra modele ikinci kez gidilip kısa yorum yazdırılsın mı? Kapalıyken
    /// araç özeti gösterilir (GPU'suz sunucuda cevap süresini yarıya indirir).
    /// </summary>
    bool NarrateResults { get; }

    /// <summary>Bir sorunun bütün model çağrıları için toplam süre; aşılırsa kural yoluna düşülür.</summary>
    TimeSpan Budget { get; }

    /// <summary>
    /// Tek tur. Model kapalı, ulaşılamaz, zaman aşımı ya da bozuk cevap → null (asla fırlatmaz);
    /// çağıran kural motoruna düşer.
    /// </summary>
    Task<AssistantChatTurn?> ChatAsync(
        IReadOnlyList<AssistantChatMessage> messages,
        IReadOnlyList<AssistantToolSpec> tools,
        CancellationToken cancellationToken);
}

/// <summary>Sohbet mesajı. Role: system, user, assistant, tool.</summary>
public sealed record AssistantChatMessage(string Role, string Content, IReadOnlyList<AssistantToolCall>? ToolCalls = null, string? ToolName = null);

public sealed record AssistantToolCall(string Name, JsonElement Arguments);

/// <summary>Modele tanıtılan araç: ad, Türkçe açıklama ve JSON şema parametreleri.</summary>
public sealed record AssistantToolSpec(string Name, string Description, JsonElement Parameters);

public sealed record AssistantChatTurn(string Content, IReadOnlyList<AssistantToolCall> ToolCalls);
