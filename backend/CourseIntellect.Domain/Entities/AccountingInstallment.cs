namespace CourseIntellect.Domain.Entities;

public sealed class AccountingInstallment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Student { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Due { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}
