namespace CourseIntellect.Application.DTOs.Translations;

public sealed record TranslationDto(
    Guid Id,
    string Key,
    string Language,
    string Value,
    string Category,
    DateTime UpdatedAtUtc
);
