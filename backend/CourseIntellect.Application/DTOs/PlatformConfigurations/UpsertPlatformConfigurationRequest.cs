namespace CourseIntellect.Application.DTOs.PlatformConfigurations;

public sealed record UpsertPlatformConfigurationRequest(
    string ConfigurationType,
    string ScopeKey,
    string DisplayName,
    string PayloadJson
);
