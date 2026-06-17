namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Merkezi idari denetim kaydı: kim, ne zaman, hangi varlıkta ne yaptı.
/// İdari işlemler için tek kaynak (KVKK/uyum ve izlenebilirlik).
/// </summary>
public sealed class AuditLogEntry : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Category { get; set; } = "Admin";
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
