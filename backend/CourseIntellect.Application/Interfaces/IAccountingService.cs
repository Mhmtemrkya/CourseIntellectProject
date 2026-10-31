using CourseIntellect.Application.DTOs.Accounting;

namespace CourseIntellect.Application.Interfaces;

public interface IAccountingService
{
    Task<AccountingDashboardDto> GetDashboardAsync(
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default);
    Task<AccountingInvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest request, CancellationToken cancellationToken = default);
    Task<AccountingSalaryDto> CreateSalaryAsync(CreateSalaryRequest request, CancellationToken cancellationToken = default);
    Task<AccountingCollectionDto> CreateCollectionAsync(CreateCollectionRequest request, Guid? createdByUserId = null, CancellationToken cancellationToken = default);
    Task<AccountingInstallmentDto> CreateInstallmentAsync(CreateInstallmentRequest request, CancellationToken cancellationToken = default);
    Task<AccountingInstallmentDto?> UpdateInstallmentAsync(Guid id, UpdateInstallmentRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default);
    Task<AccountingApprovalDto?> UpdateApprovalStatusAsync(Guid id, UpdateApprovalStatusRequest request, CancellationToken cancellationToken = default);
    Task<AccountingNotificationDto> CreateNotificationAsync(CreateAccountingNotificationRequest request, CancellationToken cancellationToken = default);
    Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken = default);
    // Fatura/bordro yaşam döngüsü. Bulunamazsa null/false; kural ihlalinde
    // InvalidOperationException, geçersiz girdide ArgumentException.
    Task<AccountingInvoiceDto?> UpdateInvoiceAsync(Guid id, UpdateInvoiceRequest request, CancellationToken cancellationToken = default);
    Task<AccountingInvoiceDto?> CancelInvoiceAsync(Guid id, string reason, CancellationToken cancellationToken = default);
    Task<bool> DeleteInvoiceAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AccountingSalaryDto?> PaySalaryAsync(Guid id, PaySalaryRequest request, CancellationToken cancellationToken = default);
}
