namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record PlatformAiLogDto(
    string Id,
    string Time,
    string User,
    string Tenant,
    string Model,
    int Tokens,
    string Duration,
    string Status
);
