namespace CourseIntellect.Application.DTOs.AppSettings;

public sealed record UpsertAppSettingRequest(
    string Key,
    string Value,
    string Type,
    string Category,
    string Description
);
