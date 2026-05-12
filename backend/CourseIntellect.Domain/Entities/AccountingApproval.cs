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
}
