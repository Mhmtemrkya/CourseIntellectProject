using CourseIntellect.Application.DTOs.PlatformConfigurations;

namespace CourseIntellect.Application.Interfaces;

public interface IPlatformConfigurationService
{
    Task<IReadOnlyList<PlatformConfigurationDto>> GetAsync(string? configurationType, CancellationToken cancellationToken = default);
    Task<PlatformConfigurationDto> UpsertAsync(UpsertPlatformConfigurationRequest request, CancellationToken cancellationToken = default);
}
