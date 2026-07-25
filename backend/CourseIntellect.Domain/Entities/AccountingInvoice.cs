namespace CourseIntellect.Domain.Entities;

public sealed class AccountingInvoice : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Counterparty { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime IssueDateUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DueDateUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
