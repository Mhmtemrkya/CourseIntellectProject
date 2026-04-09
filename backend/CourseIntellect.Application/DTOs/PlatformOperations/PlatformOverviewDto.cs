namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record PlatformOverviewDto(
    PlatformOverviewStatsDto Stats,
    IReadOnlyList<TenantWorkspaceDto> RecentTenants,
    IReadOnlyList<PlatformAiModelDto> AiModels,
    IReadOnlyList<PlatformAiLogDto> AiLogs
);
