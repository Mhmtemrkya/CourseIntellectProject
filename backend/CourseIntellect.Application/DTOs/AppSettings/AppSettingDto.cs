namespace CourseIntellect.Application.DTOs.AppSettings;

public sealed record AppSettingDto(
    Guid Id,
    string Key,
    string Value,
    string Type,
    string Category,
    string Description,
    DateTime UpdatedAtUtc
);
