namespace CourseIntellect.Application.DTOs.PlatformConfigurations;

public sealed record PlatformConfigurationDto(
    Guid Id,
    string ConfigurationType,
    string ScopeKey,
    string DisplayName,
    string PayloadJson,
    DateTime UpdatedAtUtc
);
