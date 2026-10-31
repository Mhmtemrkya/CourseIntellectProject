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

/// <summary>Ödenmemiş faturanın bilgilerini düzeltir; ödenmiş faturada tutar/tarih değişmez.</summary>
public sealed record UpdateInvoiceRequest(
    string Title,
    string Category,
    string Amount,
    string Date,
    string? Note = null,
    DateTime? DueDateUtc = null,
    string? Counterparty = null);

public sealed record CancelInvoiceRequest(string Reason);

/// <summary>Onaylı bordronun ödendiğini kaydeder; gider ve kasa bu tarihe yazılır.</summary>
public sealed record PaySalaryRequest(string PaymentMethod, DateTime? PaidAtUtc = null);
