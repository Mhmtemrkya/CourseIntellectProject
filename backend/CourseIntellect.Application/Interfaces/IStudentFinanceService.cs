using CourseIntellect.Application.DTOs.StudentFinance;

namespace CourseIntellect.Application.Interfaces;

public interface IStudentFinanceService
{
    Task<EnrollmentContractDto> CreateEnrollmentAsync(
        CreateEnrollmentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    Task<StudentFinanceAccountDto> GetAccountAsync(
        Guid? studentUserId,
        string? studentName,
        CancellationToken cancellationToken = default);

    Task<FinancePaymentDto> RecordPaymentAsync(
        RecordPaymentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    Task<StudentFinanceSummaryDto> GetSummaryAsync(
        Guid? studentUserId,
        string? studentName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StudentFinanceSummaryDto>> GetAllSummariesAsync(
        string? className,
        CancellationToken cancellationToken = default);

    Task<FinancePaymentDto> RefundPaymentAsync(
        RefundRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    Task<FinanceDashboardDto> GetDashboardAsync(
        string? className,
        CancellationToken cancellationToken = default);

    Task<ReminderResultDto> SendDueRemindersAsync(
        int upcomingWindowDays,
        CancellationToken cancellationToken = default);
}
