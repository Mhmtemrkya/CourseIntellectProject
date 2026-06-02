namespace CourseIntellect.Domain.Entities;

public sealed class ContentItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Teacher { get; set; } = string.Empty;
    public string Info { get; set; } = string.Empty;
    public double Progress { get; set; }
    public string FileType { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public string Views { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public string? FileUrl { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? PlaylistKey { get; set; }
    public string? PlaylistTitle { get; set; }
    public int? PlaylistOrder { get; set; }
    public bool AllowDownload { get; set; } = true;
    public bool AllowNotes { get; set; } = true;
    public bool CompletionCertificate { get; set; }
    public string PublishStatus { get; set; } = "Aktif";
}
