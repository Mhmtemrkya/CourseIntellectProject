namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Genel onay/iş akışı kaydı: izin, satınalma, masraf, evrak, personel vb.
/// idari süreçlerin tamamı bu tek boruya düşer (rol/limit bazlı, audit'li).
/// </summary>
public sealed class ApprovalRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Category { get; set; } = "General";
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? RequesterUserId { get; set; }
    public string RequesterName { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string Priority { get; set; } = "Normal";
    public string Status { get; set; } = "Pending";
    public string DecisionNote { get; set; } = string.Empty;
    public Guid? DecidedByUserId { get; set; }
    public string DecidedByName { get; set; } = string.Empty;
    public string ReferenceType { get; set; } = string.Empty;
    public string ReferenceKey { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAtUtc { get; set; }
}
