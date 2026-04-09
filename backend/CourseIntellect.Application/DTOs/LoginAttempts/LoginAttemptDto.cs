namespace CourseIntellect.Application.DTOs.LoginAttempts;

public sealed record LoginAttemptDto(
    Guid Id,
    Guid? UserId,
    string Email,
    string Role,
    bool Success,
    string IpAddress,
    string UserAgent,
    string DeviceId,
    DateTimeOffset Timestamp
);
