namespace CourseIntellect.Domain.Entities;

public sealed class NotificationItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string TimeLabel { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string TargetRole { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsRead { get; set; }
}
