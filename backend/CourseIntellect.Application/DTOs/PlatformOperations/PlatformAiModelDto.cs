namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record PlatformAiModelDto(
    string Id,
    string Name,
    string Provider,
    string Status,
    int Usage,
    decimal Cost
);
