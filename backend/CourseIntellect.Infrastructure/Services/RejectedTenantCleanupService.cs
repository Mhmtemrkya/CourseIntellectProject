using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

public sealed class RejectedTenantCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<RejectedTenantCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);
    private static readonly TimeSpan RejectionRetention = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // İlk çalışmadan önce kısa gecikme — uygulama başlatılırken DB migration'a engel olmasın.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Reddedilen kurumlar temizlenirken hata olustu.");
            }

            try
            {
                await Task.Delay(CheckInterval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }
        }
    }

    private async Task RunCleanupAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();

        var threshold = DateTime.UtcNow - RejectionRetention;
        var expired = await dbContext.Set<TenantWorkspace>()
            .Where(x => x.Status == "rejected"
                && x.RejectedAtUtc != null
                && x.RejectedAtUtc < threshold)
            .ToListAsync(cancellationToken);

        if (expired.Count == 0)
        {
            return;
        }

        dbContext.Set<TenantWorkspace>().RemoveRange(expired);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Reddedilen {Count} kurum 30 gunden eski oldugu icin silindi.",
            expired.Count);
    }
}
