namespace CourseIntellect.Application.DTOs.System;

public sealed record SystemStatusDto(
    bool MaintenanceMode,
    string? MaintenanceMessage,
    DateTime? MaintenanceSinceUtc,
    DateTime ServerTimeUtc
);
