using CourseIntellect.Application.DTOs.Translations;

namespace CourseIntellect.Application.Interfaces;

public interface ITranslationService
{
    Task<IReadOnlyList<TranslationDto>> GetAllAsync(string? language, string? category, string? search, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TranslationDto>> UpsertManyAsync(List<UpsertTranslationRequest> items, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TranslationDto>> ExportAsync(string language, CancellationToken cancellationToken = default);
}
