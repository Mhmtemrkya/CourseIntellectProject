using CourseIntellect.Application.DTOs.Analytics;

namespace CourseIntellect.Application.Interfaces;

public interface IAdminAnalyticsService
{
    Task<AdminAnalyticsResponse> GetAsync(
        string? period,
        DateTime? from,
        DateTime? to,
        CancellationToken cancellationToken = default);
}
