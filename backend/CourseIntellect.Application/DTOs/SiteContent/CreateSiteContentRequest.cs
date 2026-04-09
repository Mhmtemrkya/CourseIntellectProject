namespace CourseIntellect.Application.DTOs.SiteContent;

public sealed record CreateSiteContentRequest(
    string SectionKey,
    string ContentJson,
    string Language,
    bool Publish
);
