namespace CourseIntellect.Application.DTOs.PlatformSubscriptions;

public sealed record MarkPlatformInvoicePaidRequest(
    DateTime? PaidAtUtc = null,
    string? Notes = null
);
