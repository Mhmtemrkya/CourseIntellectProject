namespace CourseIntellect.Domain.Entities;

public sealed class AccountingAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string Time { get; set; } = string.Empty;
}
