namespace CourseIntellect.Domain.Entities;

public sealed class SiteContentItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string SectionKey { get; set; } = string.Empty;
    public string ContentJson { get; set; } = string.Empty;
    public string Language { get; set; } = "tr";
    public int Version { get; set; } = 1;
    public bool IsPublished { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = string.Empty;
}
