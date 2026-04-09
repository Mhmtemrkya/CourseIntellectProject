namespace CourseIntellect.Application.DTOs.SiteContent;

public sealed record SiteContentDto(
    Guid Id,
    string SectionKey,
    string ContentJson,
    string Language,
    int Version,
    bool IsPublished,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    string UpdatedBy
);
