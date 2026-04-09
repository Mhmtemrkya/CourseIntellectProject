using CourseIntellect.Application.DTOs.AppSettings;

namespace CourseIntellect.Application.Interfaces;

public interface IAppSettingService
{
    Task<IReadOnlyList<AppSettingDto>> GetAllAsync(string? category, CancellationToken cancellationToken = default);
    Task<AppSettingDto?> GetByKeyAsync(string key, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AppSettingDto>> UpsertManyAsync(List<UpsertAppSettingRequest> items, CancellationToken cancellationToken = default);
}
