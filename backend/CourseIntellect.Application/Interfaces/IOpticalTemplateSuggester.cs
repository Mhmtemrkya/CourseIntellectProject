using CourseIntellect.Application.DTOs.OpticalExams;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Optik çıktı dosyasından şablon (karakter düzeni) önerisi. Veritabanına dokunmaz; konumlar
/// kurallı kodla hesaplanır, yerel model (varsa) yalnız aday alanları etiketlemeye yardım eder.
/// </summary>
public interface IOpticalTemplateSuggester
{
    Task<OpticalTemplateSuggestionDto> SuggestAsync(byte[] file, string? encoding, CancellationToken cancellationToken = default);
}
