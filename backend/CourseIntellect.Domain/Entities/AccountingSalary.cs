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
}
