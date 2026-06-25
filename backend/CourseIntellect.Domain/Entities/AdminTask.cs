namespace CourseIntellect.Domain.Entities;

/// <summary>
/// İdari görev/iş takip kaydı: atama, öncelik, başlangıç/bitiş aralığı, kabul/red ve durum.
/// </summary>
public sealed class AdminTask : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "Genel";
    public Guid? AssignedToUserId { get; set; }
    public string AssignedToName { get; set; } = string.Empty;
    public string Priority { get; set; } = "Normal";
    public string Status { get; set; } = "Open";
    public Guid? CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime? DueDateUtc { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }
    public string ResponseStatus { get; set; } = "Pending";
    public string RejectionReason { get; set; } = string.Empty;
    public DateTime? RespondedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
}
