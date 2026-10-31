namespace CourseIntellect.Domain.Entities;

public sealed class AccountingAuditLog : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    /// <summary>Sıralama/süzme için gerçek zaman damgası; <see cref="Time"/> yalnız gösterim metnidir.</summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    /// <summary>İşlemi yapan personel (kayıt anında oturumdan damgalanır).</summary>
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
}
