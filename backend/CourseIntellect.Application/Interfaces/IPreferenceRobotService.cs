using CourseIntellect.Application.DTOs.Preference;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// LGS/YKS tercih robotu. Veri yalnız resmî yayımlardan gelir (ÖSYM yerleştirme
/// tabloları gömülüdür; LGS okul verisi platform yöneticisince CSV ile yüklenir).
/// Net→puan dönüşümü tahminidir; gerçek puanı ÖSYM/MEB hesaplar.
/// </summary>
public interface IPreferenceRobotService
{
    Task<PreferenceMetaDto> GetMetaAsync(string? exam = null, CancellationToken cancellationToken = default);
    PreferenceEstimateDto Estimate(PreferenceNetInput input);
    Task<PreferenceSearchResultDto> SearchAsync(PreferenceSearchRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PreferenceChoiceDto>> GetChoicesAsync(Guid studentUserId, string exam, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PreferenceChoiceDto>> SaveChoicesAsync(Guid studentUserId, SavePreferenceChoicesRequest request, CancellationToken cancellationToken = default);
    /// <summary>Gömülü ÖSYM verisinden eksik yılları yükler (idempotent).</summary>
    Task EnsureBuiltInDataAsync(CancellationToken cancellationToken = default);
    /// <summary>LGS okul verisi CSV'si: Kurum Kodu;Okul;İl;İlçe;Okul Türü;Kontenjan;Taban Puan;Yüzdelik Dilim</summary>
    Task<PreferenceImportResultDto> ImportLgsCsvAsync(int year, string source, string sourceUrl, Stream csv, CancellationToken cancellationToken = default);
}
