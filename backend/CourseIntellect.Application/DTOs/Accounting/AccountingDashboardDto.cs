namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingDashboardDto(
    IReadOnlyList<AccountingInvoiceDto> Invoices,
    IReadOnlyList<AccountingSalaryDto> Salaries,
    IReadOnlyList<AccountingApprovalDto> Approvals,
    IReadOnlyList<AccountingCollectionDto> Collections,
    IReadOnlyList<AccountingInstallmentDto> Installments,
    IReadOnlyList<AccountingNotificationDto> Notifications,
    IReadOnlyList<AccountingAuditLogDto> AuditLogs);
