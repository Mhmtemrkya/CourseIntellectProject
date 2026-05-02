namespace CourseIntellect.Application.DTOs.PlatformSubscriptions;

public sealed record PlatformSubscriptionInvoiceDto(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string TenantContactEmail,
    string InvoiceNumber,
    string PlanId,
    string PlanName,
    decimal Amount,
    string Currency,
    string BillingPeriod,
    DateTime PeriodStartUtc,
    DateTime PeriodEndUtc,
    string Status,
    DateTime IssuedAtUtc,
    DateTime DueAtUtc,
    DateTime? PaidAtUtc,
    string? Notes
);
