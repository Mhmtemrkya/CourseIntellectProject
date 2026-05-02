using System.Text.Json;

namespace CourseIntellect.Application.DTOs.SiteContent;

public sealed record UpdateSiteContentRequest(
    JsonElement Content,
    string Language,
    bool Publish
);
