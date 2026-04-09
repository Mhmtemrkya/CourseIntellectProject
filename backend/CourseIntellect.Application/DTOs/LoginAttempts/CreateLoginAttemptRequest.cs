namespace CourseIntellect.Application.DTOs.LoginAttempts;

public sealed record CreateLoginAttemptRequest(
    Guid? UserId,
    string Email,
    string Role,
    bool Success,
    string IpAddress,
    string UserAgent,
    string DeviceId
);
