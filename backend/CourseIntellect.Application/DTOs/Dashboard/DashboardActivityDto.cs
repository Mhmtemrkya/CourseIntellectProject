namespace CourseIntellect.Application.DTOs.Dashboard;

public sealed record DashboardActivityDto(
    Guid Id,
    Guid? UserId,
    string Action,
    string? EntityType,
    string? EntityId,
    string? IpAddress,
    DateTimeOffset Timestamp
);
