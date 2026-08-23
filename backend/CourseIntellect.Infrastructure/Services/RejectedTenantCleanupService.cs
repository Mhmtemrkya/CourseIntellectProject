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

        // Reddedilen BAŞVURULAR (asıl kaynak, P1 sonrası).
        var expiredApplications = await dbContext.TenantRegistrationApplications
            .Where(x => x.Status == "rejected"
                && x.RejectedAtUtc != null
                && x.RejectedAtUtc < threshold)
            .ToListAsync(cancellationToken);

        // P1 öncesinden kalan, kurum tablosuna yazılmış reddedilmiş satırlar.
        var expiredTenants = await dbContext.Set<TenantWorkspace>()
            .Where(x => x.Status == "rejected"
                && x.RejectedAtUtc != null
                && x.RejectedAtUtc < threshold)
            .ToListAsync(cancellationToken);

        // Doğrulama e-postası gidip yanıtlanmamış başvurular: kuyrukta hiç görünmedikleri
        // için birikirler. Bağlantının ömrü 48 saat; 7 gün sonra kalıcı çöp sayılırlar.
        var staleUnverifiedThreshold = DateTime.UtcNow - TimeSpan.FromDays(7);
        var staleUnverified = await dbContext.TenantRegistrationApplications
            .Where(x => x.Status == "pending"
                && x.VerifiedAtUtc == null
                && x.VerificationSentAtUtc != null
                && x.CreatedAtUtc < staleUnverifiedThreshold)
            .ToListAsync(cancellationToken);

        if (staleUnverified.Count > 0)
        {
            dbContext.TenantRegistrationApplications.RemoveRange(staleUnverified);
        }

        if (expiredApplications.Count == 0 && expiredTenants.Count == 0 && staleUnverified.Count == 0)
        {
            return;
        }

        dbContext.TenantRegistrationApplications.RemoveRange(expiredApplications);
        dbContext.Set<TenantWorkspace>().RemoveRange(expiredTenants);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Reddedilen {ApplicationCount} basvuru, {TenantCount} kurum ve dogrulanmamis {StaleCount} basvuru silindi.",
            expiredApplications.Count,
            expiredTenants.Count,
            staleUnverified.Count);
    }
}
