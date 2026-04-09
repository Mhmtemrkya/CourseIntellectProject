namespace CourseIntellect.Application.DTOs.Translations;

public sealed record UpsertTranslationRequest(
    string Key,
    string Language,
    string Value,
    string Category
);
