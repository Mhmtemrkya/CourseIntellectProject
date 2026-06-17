namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// PDF/Word/görsel dosyalardan temiz metin + layout çıkaran OCR katmanı
/// (Azure Document Intelligence prebuilt-layout). Soruları yorumlamaz;
/// yalnızca yapısal metni döndürür, parse işini bizim katman yapar.
/// </summary>
public interface IDocumentIntelligenceService
{
    /// <summary>
    /// Geliştirici panelinden açık (Enabled) VE endpoint+anahtar tanımlıysa true.
    /// Ayar veritabanından (app settings) okunduğu için asenkrondur.
    /// </summary>
    Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default);

    Task<DocumentLayoutResult> AnalyzeLayoutAsync(
        byte[] content,
        string fileName,
        CancellationToken cancellationToken = default);
}

public sealed record DocumentLayoutResult(
    bool Succeeded,
    string Text,
    int PageCount,
    int TableCount,
    int SelectionMarkCount,
    string? Error)
{
    public static DocumentLayoutResult Failure(string error) =>
        new(false, string.Empty, 0, 0, 0, error);
}
