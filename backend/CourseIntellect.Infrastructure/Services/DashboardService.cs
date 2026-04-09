using CourseIntellect.Application.DTOs.Dashboard;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class DashboardService(CourseIntellectDbContext dbContext) : IDashboardService
{
    public async Task<DashboardStatsDto> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var totalUsers = await dbContext.Users.CountAsync(cancellationToken);
        var activeUsers = await dbContext.Users.CountAsync(x => x.Status == UserStatus.Active, cancellationToken);

        var totalCourses = await dbContext.CourseItems.CountAsync(cancellationToken);
        var activeCourses = await dbContext.CourseItems.CountAsync(x => x.IsActive, cancellationToken);

        var totalMessages = await dbContext.ContactMessages.CountAsync(cancellationToken);
        var unreadMessages = await dbContext.ContactMessages.CountAsync(x => x.Status == "Okunmadı", cancellationToken);

        var totalLoginAttempts = await dbContext.LoginAttempts.CountAsync(cancellationToken);
        var failedLoginAttempts = await dbContext.LoginAttempts.CountAsync(x => !x.Success, cancellationToken);

        return new DashboardStatsDto(
            totalUsers,
            activeUsers,
            totalCourses,
            activeCourses,
            totalMessages,
            unreadMessages,
            totalUsers,
            0,
            totalLoginAttempts,
            failedLoginAttempts);
    }

    public async Task<IReadOnlyList<DashboardActivityDto>> GetActivitiesAsync(int limit, CancellationToken cancellationToken = default)
    {
        return await dbContext.LoginAttempts
            .OrderByDescending(x => x.Timestamp)
            .Take(limit)
            .Select(x => new DashboardActivityDto(
                x.Id,
                x.UserId,
                x.Success ? "login_success" : "login_failed",
                "User",
                x.Email,
                x.IpAddress,
                x.Timestamp))
            .ToListAsync(cancellationToken);
    }
}
