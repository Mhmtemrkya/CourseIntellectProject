namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Merkezi idari denetim kaydı: kim, ne zaman, hangi varlıkta ne yaptı.
/// İdari işlemler için tek kaynak (KVKK/uyum ve izlenebilirlik).
/// </summary>
public sealed class AuditLogEntry : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    // Şube izolasyonu: şube müdürü yalnızca kendi şubesinin kayıtlarını görür;
    // kurum sahibi tüm şubeleri görür (X-Branch-Filter ile şube şube odaklanabilir).
    public Guid? BranchId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Category { get; set; } = "Admin";
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
