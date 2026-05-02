namespace CourseIntellect.Domain.Entities;

/// <summary>
/// CourseIntellect platformunun, kurumlara abonelik paketleri için kestiği fatura.
/// AccountingInvoice'tan ayrı bir kavramdır (o öğrenci faturaları içindir).
/// </summary>
public sealed class PlatformSubscriptionInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Hangi kuruma kesildi
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantContactEmail { get; set; } = string.Empty;

    // İnsan-okur fatura numarası (CI-2026-000001)
    public string InvoiceNumber { get; set; } = string.Empty;

    // Plan bilgileri (snapshot — fiyatlar değişse bile bu fatura sabit kalır)
    public string PlanId { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "TRY";

    // Aylık / Yıllık
    public string BillingPeriod { get; set; } = "Aylık";
    public DateTime PeriodStartUtc { get; set; }
    public DateTime PeriodEndUtc { get; set; }

    // pending / paid / overdue / cancelled
    public string Status { get; set; } = "pending";

    public DateTime IssuedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime DueAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }

    public string? Notes { get; set; }
}
