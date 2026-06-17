namespace CourseIntellect.Domain.Entities;

public sealed class AccountingCollection : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}
