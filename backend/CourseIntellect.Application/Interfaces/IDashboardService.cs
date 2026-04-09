using CourseIntellect.Application.DTOs.Dashboard;

namespace CourseIntellect.Application.Interfaces;

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DashboardActivityDto>> GetActivitiesAsync(int limit, CancellationToken cancellationToken = default);
}
