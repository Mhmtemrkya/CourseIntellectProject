using System.Text.Json;

namespace CourseIntellect.Application.DTOs.SiteContent;

public sealed record SiteContentDto(
    Guid Id,
    string Section,
    JsonElement Content,
    string Language,
    int Version,
    bool IsPublished,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? UpdatedBy
);
