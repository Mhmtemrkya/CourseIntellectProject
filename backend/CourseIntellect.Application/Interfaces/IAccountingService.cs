using CourseIntellect.Application.DTOs.Accounting;

namespace CourseIntellect.Application.Interfaces;

public interface IAccountingService
{
    Task<AccountingDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default);
    Task<AccountingInvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest request, CancellationToken cancellationToken = default);
    Task<AccountingSalaryDto> CreateSalaryAsync(CreateSalaryRequest request, CancellationToken cancellationToken = default);
    Task<AccountingCollectionDto> CreateCollectionAsync(CreateCollectionRequest request, CancellationToken cancellationToken = default);
    Task<AccountingInstallmentDto> CreateInstallmentAsync(CreateInstallmentRequest request, CancellationToken cancellationToken = default);
    Task<AccountingInstallmentDto?> UpdateInstallmentAsync(Guid id, UpdateInstallmentRequest request, CancellationToken cancellationToken = default);
    Task<AccountingApprovalDto?> UpdateApprovalStatusAsync(Guid id, UpdateApprovalStatusRequest request, CancellationToken cancellationToken = default);
    Task<AccountingNotificationDto> CreateNotificationAsync(CreateAccountingNotificationRequest request, CancellationToken cancellationToken = default);
    Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken = default);
}
