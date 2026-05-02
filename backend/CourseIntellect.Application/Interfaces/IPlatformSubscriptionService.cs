using CourseIntellect.Application.DTOs.PlatformSubscriptions;

namespace CourseIntellect.Application.Interfaces;

public interface IPlatformSubscriptionService
{
    /// <summary>
    /// Yeni abonelik faturası oluşturur. tenantId verilmezse JWT'den alınır.
    /// Şu an direkt onaylama: created → status "paid" olarak da işaretlenebilir (autoApprove).
    /// </summary>
    Task<PlatformSubscriptionInvoiceDto> CreateAsync(
        Guid? actorUserId,
        Guid tenantId,
        CreatePlatformSubscriptionInvoiceRequest request,
        bool autoApprove,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetAllAsync(
        string? statusFilter = null,
        string? search = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetForTenantAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    Task<PlatformSubscriptionInvoiceDto?> GetByIdAsync(
        Guid invoiceId,
        CancellationToken cancellationToken = default);

    Task<PlatformSubscriptionInvoiceDto?> MarkPaidAsync(
        Guid invoiceId,
        MarkPlatformInvoicePaidRequest request,
        CancellationToken cancellationToken = default);

    Task<PlatformSubscriptionInvoiceDto?> CancelAsync(
        Guid invoiceId,
        string? notes,
        CancellationToken cancellationToken = default);
}
