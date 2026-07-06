using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Zamanlanmış hatırlatma orkestrasyonu. HttpContext olmadığı için tenant
/// bağlamını elle kurar: her kurum için DbContext override'ı set eder, mevcut
/// hatırlatma servislerini çağırır, sonra override'ı temizler. Böylece hem
/// sorgu filtresi hem yeni bildirimlerin tenant-stamp'i doğru kuruma göre işler.
/// </summary>
public sealed class ReminderJobService(
    CourseIntellectDbContext dbContext,
    IStudentFinanceService studentFinanceService,
    ILibraryReminderService libraryReminderService,
    ILogger<ReminderJobService> logger) : IReminderJobService
{
    private const int FinanceUpcomingWindowDays = 7;
    private const int StaleTokenDays = 90;

    public async Task RunFinanceRemindersAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachTenantAsync(async _ =>
        {
            var result = await studentFinanceService.SendDueRemindersAsync(FinanceUpcomingWindowDays, cancellationToken);
            total += result.Notified;
        }, "ödeme", cancellationToken);
        logger.LogInformation("Ödeme hatırlatma işi bitti. Toplam bildirim: {Count}.", total);
    }

    public async Task RunLibraryRemindersAsync(CancellationToken cancellationToken = default)
    {
        var total = 0;
        await ForEachTenantAsync(async _ =>
        {
            total += await libraryReminderService.SendDueRemindersAsync(cancellationToken);
        }, "kütüphane", cancellationToken);
        logger.LogInformation("Kütüphane hatırlatma işi bitti. Toplam bildirim: {Count}.", total);
    }

    public async Task CleanupStalePushTokensAsync(CancellationToken cancellationToken = default)
    {
        // Tenant-agnostik: override yok → tüm kurumlardaki eski token'lar.
        var threshold = DateTime.UtcNow.AddDays(-StaleTokenDays);
        var affected = await dbContext.PushDeviceRegistrations
            .Where(d => d.IsActive && d.LastSeenAtUtc < threshold)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.IsActive, false), cancellationToken);

        if (affected > 0)
        {
            logger.LogInformation("{Count} ölü push token pasiflendi ({Days} gündür görülmeyen).", affected, StaleTokenDays);
        }
    }

    /// <summary>Her kurum için override kurup verilen işi çalıştırır; kurum bazında
    /// hata izole edilir (biri patlarsa diğerleri devam eder), override her zaman temizlenir.</summary>
    private async Task ForEachTenantAsync(Func<Guid, Task> action, string label, CancellationToken cancellationToken)
    {
        // Override yokken (job bağlamı) filtre kapalı → tüm kurumlar görünür.
        var tenantIds = await dbContext.Set<Domain.Entities.TenantWorkspace>()
            .AsNoTracking()
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        logger.LogInformation("{Label} hatırlatma işi başladı: {Count} kurum.", label, tenantIds.Count);

        foreach (var tenantId in tenantIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                dbContext.SetTenantOverride(tenantId);
                await action(tenantId);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Kurum {TenantId} için {Label} hatırlatması başarısız.", tenantId, label);
            }
            finally
            {
                dbContext.SetTenantOverride(null);
            }
        }
    }
}
