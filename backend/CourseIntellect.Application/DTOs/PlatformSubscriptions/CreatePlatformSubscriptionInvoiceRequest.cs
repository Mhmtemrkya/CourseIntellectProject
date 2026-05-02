namespace CourseIntellect.Application.DTOs.PlatformSubscriptions;

public sealed record CreatePlatformSubscriptionInvoiceRequest(
    string PlanId,
    string PlanName,
    decimal Amount,
    string BillingPeriod,           // "Aylık" / "Yıllık"
    string? Currency = "TRY",
    string? Notes = null,
    Guid? TenantId = null           // optional override (admin only)
);
