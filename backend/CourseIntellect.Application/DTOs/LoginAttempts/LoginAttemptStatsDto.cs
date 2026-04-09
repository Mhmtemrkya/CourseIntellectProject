namespace CourseIntellect.Application.DTOs.LoginAttempts;

public sealed record LoginAttemptStatsDto(
    int Total,
    int SuccessCount,
    int FailedCount,
    double SuccessRate
);
