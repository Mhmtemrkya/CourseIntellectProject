namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Kurumun KENDİ sunucusunda çalışan yerel dil modeli (Ollama). Yalnız niyet
/// sınıflama için kullanılır: kullanıcının cümlesi + aday niyet listesi gider,
/// tek bir niyet etiketi döner. Öğrenci verisi bu servise ASLA gönderilmez.
///
/// Veri dışarı çıkmaz (model localhost'ta), per-token ücret yoktur.
/// </summary>
public interface ILocalLlmClient
{
    /// <summary>Model kapalı/ulaşılamaz olduğunda hızlı ayırt etmek için.</summary>
    bool IsEnabled { get; }

    /// <summary>
    /// Cümleyi verilen adaylardan birine sınıflar. Adaylardan hiçbiri uymuyorsa,
    /// model kapalıysa, zaman aşımına uğrarsa veya hata olursa <c>null</c> döner —
    /// asla istisna fırlatmaz. Çağıran, null'da eski (kural) davranışına düşer.
    /// </summary>
    Task<string?> ClassifyIntentAsync(
        string message,
        IReadOnlyDictionary<string, string> candidates,
        CancellationToken cancellationToken);
}
