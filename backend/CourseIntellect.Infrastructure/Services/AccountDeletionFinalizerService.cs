using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Bekleme penceresi dolan hesap/kurum silme taleplerini otomatik tamamlar.
/// YIKICI — bu yüzden config bayrağıyla opt-in ve ÜRETİMDE KAPALI olmalı
/// (bkz. <see cref="RejectedTenantCleanupService"/> aynı desen). Talep oluşturma/
/// görüntüleme/iptal her zaman çalışır; gerçek silme yalnız bayrak açıkken olur.
/// </summary>
public sealed class AccountDeletionFinalizerService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<AccountDeletionFinalizerService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(15);

    public static bool AccountDeletionEnabled(IConfiguration configuration)
        => configuration.GetValue("AccountDeletion:Enabled", false);

    public static bool InstitutionDeletionEnabled(IConfiguration configuration)
        => configuration.GetValue("InstitutionDeletion:Enabled", false);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!AccountDeletionEnabled(configuration) && !InstitutionDeletionEnabled(configuration))
        {
            logger.LogInformation("Hesap/kurum silme finalizer'ı yapılandırmayla kapalı (üretim varsayılanı).");
            return;
        }

        try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (AccountDeletionEnabled(configuration)) await RunAccountDeletionsAsync(stoppingToken);
                if (InstitutionDeletionEnabled(configuration)) await RunInstitutionDeletionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Silme talepleri tamamlanırken hata oluştu.");
            }

            try { await Task.Delay(CheckInterval, stoppingToken); } catch (TaskCanceledException) { return; }
        }
    }

    private async Task RunAccountDeletionsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
        var lifecycle = scope.ServiceProvider.GetRequiredService<IAccountLifecycleService>();
        var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();
        await ProcessDueAccountDeletionsAsync(db, lifecycle, push, DateTime.UtcNow, logger, cancellationToken);
    }

    /// <summary>
    /// Süresi dolmuş (iptal edilmemiş) hesap silme taleplerini tamamlar. Test edilebilir
    /// olması için ayrı: iptal edilenlere ve süresi dolmayanlara DOKUNMAZ.
    /// </summary>
    public static async Task ProcessDueAccountDeletionsAsync(
        CourseIntellectDbContext db,
        IAccountLifecycleService lifecycle,
        IPushNotificationService? push,
        DateTime now,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var due = await db.Set<AccountDeletionRequest>()
            .IgnoreQueryFilters()
            .Where(x => (x.Status == AccountDeletionStatus.Pending || x.Status == AccountDeletionStatus.Scheduled)
                && x.FinalizeAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var request in due)
        {
            if (request.TenantId is not Guid tenantId) continue;
            try
            {
                // Tamamlanma bildirimi: tokenlar silinmeden ÖNCE gönder (best-effort).
                if (push is not null)
                {
                    try
                    {
                        await push.SendToUserAsync(request.UserId, "Hesabınız silindi",
                            "Hesap silme talebiniz tamamlandı. Kişisel verileriniz temizlendi.",
                            new Dictionary<string, string> { ["type"] = "account-deletion-completed" });
                    }
                    catch (Exception ex) { logger?.LogWarning(ex, "Silme tamamlanma bildirimi gönderilemedi."); }
                }

                var summary = await lifecycle.FinalizeAccountDeletionAsync(tenantId, request.UserId, cancellationToken);

                request.Status = AccountDeletionStatus.Completed;
                request.CompletedAtUtc = DateTime.UtcNow;
                request.RetainedSummaryJson = summary;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Hesap silme tamamlanamadı: {RequestId}", request.Id);
                request.Status = AccountDeletionStatus.Failed;
                request.FailureReason = "finalize-error";
            }
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task RunInstitutionDeletionsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
        var lifecycle = scope.ServiceProvider.GetRequiredService<IAccountLifecycleService>();
        await ProcessDueInstitutionDeletionsAsync(db, lifecycle, DateTime.UtcNow, logger, cancellationToken);
    }

    /// <summary>
    /// Süresi dolmuş, onaylı (Scheduled) kurum silme taleplerini tamamlar. Test edilebilir
    /// olması için ayrı. InstitutionDeletionRequest retain listesinde olduğundan purge sonrası
    /// güncellenebilir (silinmez).
    /// </summary>
    public static async Task ProcessDueInstitutionDeletionsAsync(
        CourseIntellectDbContext db,
        IAccountLifecycleService lifecycle,
        DateTime now,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var due = await db.Set<InstitutionDeletionRequest>()
            .IgnoreQueryFilters()
            .Where(x => x.Status == InstitutionDeletionStatus.Scheduled
                && x.FinalizeAtUtc != null && x.FinalizeAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var request in due)
        {
            if (request.TenantId is not Guid tenantId) continue;
            try
            {
                await lifecycle.FinalizeInstitutionDeletionAsync(tenantId, cancellationToken);
                request.Status = InstitutionDeletionStatus.Completed;
                request.CompletedAtUtc = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Kurum silme tamamlanamadı: {RequestId}", request.Id);
                request.Status = InstitutionDeletionStatus.Failed;
                request.FailureReason = "finalize-error";
            }
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}
