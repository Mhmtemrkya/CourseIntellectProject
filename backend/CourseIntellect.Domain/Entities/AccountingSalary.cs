namespace CourseIntellect.Domain.Entities;

public sealed class AccountingSalary : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Employee { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string PayDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    /// <summary>Maaşın fiilen ödendiği an; gider/kasa bu tarihe yazılır.</summary>
    public DateTime? PaidAtUtc { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
}
