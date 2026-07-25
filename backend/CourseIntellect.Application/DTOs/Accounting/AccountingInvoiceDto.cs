namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingInvoiceDto(
    string Id,
    string InvoiceNumber,
    string Title,
    string Counterparty,
    string Category,
    string Subtitle,
    string Amount,
    string Status,
    DateTime IssueDateUtc,
    DateTime? DueDateUtc,
    DateTime? PaidAtUtc,
    string PaymentMethod,
    string Note);
