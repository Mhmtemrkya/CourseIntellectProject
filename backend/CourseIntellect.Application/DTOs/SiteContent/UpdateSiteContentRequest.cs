namespace CourseIntellect.Application.DTOs.SiteContent;

public sealed record UpdateSiteContentRequest(
    string ContentJson,
    string Language,
    bool Publish
);
