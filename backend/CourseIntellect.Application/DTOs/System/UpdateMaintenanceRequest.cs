namespace CourseIntellect.Application.DTOs.System;

public sealed record UpdateMaintenanceRequest(
    bool Enabled,
    string? Message
);
