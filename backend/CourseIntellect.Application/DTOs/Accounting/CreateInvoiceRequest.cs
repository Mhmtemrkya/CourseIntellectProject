namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record CreateInvoiceRequest(
    string Title,
    string Category,
    string Amount,
    string Date,
    string Reason,
    bool IsPaid = false,
    string? PaymentMethod = null,
    DateTime? DueDateUtc = null,
    string? Counterparty = null,
    string? InvoiceNumber = null);

public sealed record MarkInvoicePaidRequest(
    string PaymentMethod,
    DateTime? PaidAtUtc = null,
    string? Note = null);
