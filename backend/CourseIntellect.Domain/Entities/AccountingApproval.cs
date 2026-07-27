namespace CourseIntellect.Domain.Entities;

public sealed class AccountingApproval : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public string SourceKey { get; set; } = string.Empty;

    /// <summary>
    /// Kaydın oluşturulma/son güncellenme anı. Finans Audit Log'da onay satırları
    /// zamansız kaldığı için "Zaman yok" görünüyordu. Eski satırlarda null olabilir.
    /// </summary>
    public DateTime? UpdatedAtUtc { get; set; }
}
