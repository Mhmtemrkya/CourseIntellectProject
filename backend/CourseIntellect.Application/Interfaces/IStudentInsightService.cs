using CourseIntellect.Application.DTOs.Insights;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Öğrenci konu analizi. Sayılar, zayıf konu seçimi ve teşhis her zaman deterministik
/// analizden gelir; yapay zekâ (açıksa) yalnız kısa bir öğretmen notu yazar ve bu not
/// doğrulamadan geçmezse şablon metin kullanılır. Kaynak: online sınav cevapları ve soru
/// bankası çalışmaları (konu bilgisi taşıyan veriler).
/// </summary>
public interface IStudentInsightService
{
    Task<InsightOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<ClassInsightDto?> GetClassAsync(string className, CancellationToken cancellationToken = default);
    Task<StudentInsightDto?> GetStudentAsync(Guid studentUserId, CancellationToken cancellationToken = default);
    /// <summary>Not üretimini kuyruğa alır (veri değişmediyse mevcut notu döndürür).</summary>
    Task<InsightNoteDto?> RequestNoteAsync(Guid studentUserId, Guid? requestedByUserId, CancellationToken cancellationToken = default);
    /// <summary>Öğretmen değerlendirmesi; düzeltilen metin eğitim örneği olarak saklanır.</summary>
    Task<InsightNoteDto?> ReviewNoteAsync(Guid noteId, ReviewInsightNoteRequest request, Guid? reviewerUserId, CancellationToken cancellationToken = default);
    /// <summary>Arka plan işi: notu üretir (tenant override kurar).</summary>
    Task GenerateNoteAsync(Guid tenantId, Guid noteId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Öneri metni yazan yerel model istemcisi (Ollama). Hata, zaman aşımı ya da kapalıysa
/// null döner; asla fırlatmaz. Model adresi ayardan gelir (geliştirmede bu Mac, canlıda LLM kasası).
/// </summary>
public interface IInsightTextGenerator
{
    bool IsEnabled { get; }
    string Model { get; }
    Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken);
}
