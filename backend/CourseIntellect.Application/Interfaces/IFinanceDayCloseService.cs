using CourseIntellect.Application.DTOs.StudentFinance;

namespace CourseIntellect.Application.Interfaces;

/// <summary>Gün sonu kasa özeti, kapanışı ve (yönetici) yeniden açma.</summary>
public interface IFinanceDayCloseService
{
    Task<FinanceDaySummaryDto> GetSummaryAsync(DateTime day, CancellationToken cancellationToken = default);

    Task<FinanceDayClosingDto> CloseAsync(CloseFinanceDayRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default);

    Task<bool> ReopenAsync(DateTime day, string reason, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FinanceDayClosingDto>> ListAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default);
}
