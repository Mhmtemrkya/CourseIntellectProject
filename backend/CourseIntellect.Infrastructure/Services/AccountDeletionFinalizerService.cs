using System.Text.Json;
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
/// Yıkıcı tamamlama yalnız kullanıcının onayladığı, süresi dolmuş talebi işler; üretimde etkin olmalı
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
        => configuration.GetValue("AccountDeletion:Enabled", true);

    public static bool InstitutionDeletionEnabled(IConfiguration configuration)
        => configuration.GetValue("InstitutionDeletion:Enabled", true);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!AccountDeletionEnabled(configuration) && !InstitutionDeletionEnabled(configuration))
        {
            logger.LogWarning("Hesap/kurum silme tamamlama servisi kapalı; kullanıcı talepleri tamamlanamayacak.");
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
            .Where(x => (x.Status == AccountDeletionStatus.Pending || x.Status == AccountDeletionStatus.Scheduled || x.Status == AccountDeletionStatus.Failed
                || (x.Status == AccountDeletionStatus.Processing && x.ProcessingStartedAtUtc < now.AddMinutes(-30)))
                && x.FinalizeAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var request in due)
        {
            if (request.TenantId is not Guid tenantId) continue;
            var claimed = await db.Set<AccountDeletionRequest>().IgnoreQueryFilters()
                .Where(x => x.Id == request.Id && x.Status == request.Status && x.ProcessingStartedAtUtc == request.ProcessingStartedAtUtc)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, AccountDeletionStatus.Processing)
                    .SetProperty(x => x.ProcessingStartedAtUtc, now), cancellationToken);
            if (claimed == 0) continue; // cancelled or already claimed by another worker
            db.ChangeTracker.Clear();
            var active = await db.Set<AccountDeletionRequest>().IgnoreQueryFilters().SingleAsync(x => x.Id == request.Id, cancellationToken);
            try
            {
                if (string.IsNullOrWhiteSpace(active.CompletionTokensJson) || active.CompletionTokensJson == "[]")
                {
                    var tokens = await db.PushDeviceRegistrations.IgnoreQueryFilters()
                        .Where(x => x.UserId == active.UserId && x.TenantId == tenantId && x.IsActive)
                        .Select(x => x.Token).ToListAsync(cancellationToken);
                    active.CompletionTokensJson = JsonSerializer.Serialize(tokens);
                    await db.SaveChangesAsync(cancellationToken);
                }
                var summary = await lifecycle.FinalizeAccountDeletionAsync(tenantId, active.UserId, cancellationToken);
                active.Status = AccountDeletionStatus.Completed;
                active.CompletedAtUtc = DateTime.UtcNow;
                active.RetainedSummaryJson = summary;
                active.FailureReason = null;
                var completionTokens = JsonSerializer.Deserialize<List<string>>(active.CompletionTokensJson) ?? [];
                active.CompletionTokensJson = "[]"; // temporary notification addresses are removed on completion
                await db.SaveChangesAsync(cancellationToken);
                if (push is not null)
                {
                    try
                    {
                        await push.SendToTokensAsync(completionTokens, "Hesabınız silindi",
                            "Hesap silme işleminiz tamamlandı.",
                            new Dictionary<string, string> { ["type"] = "account-deletion-completed" }, cancellationToken);
                    }
                    catch (Exception) when (!cancellationToken.IsCancellationRequested)
                    { logger?.LogWarning("Silme tamamlanma bildirimi teslim edilemedi."); }
                }
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                logger?.LogError("Hesap silme yeniden denenecek: {RequestId}; hata türü: {ErrorType}", request.Id, ex.GetType().Name);
                db.ChangeTracker.Clear();
                var failure = FailureCode(ex);
                await db.Set<AccountDeletionRequest>().IgnoreQueryFilters().Where(x => x.Id == request.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, AccountDeletionStatus.Failed)
                        .SetProperty(x => x.FailureReason, failure), cancellationToken);
            }
        }
    }

    private async Task RunInstitutionDeletionsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
        var lifecycle = scope.ServiceProvider.GetRequiredService<IAccountLifecycleService>();
        await ProcessDueInstitutionDeletionsAsync(db, lifecycle, DateTime.UtcNow, logger, cancellationToken);
    }

    private static string FailureCode(Exception exception)
        => exception is InvalidOperationException && exception.Message is "education-identity-review-required" or "legacy-identity-review-required"
            ? exception.Message : "finalize-retry-required";

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
            .Where(x => (x.Status == InstitutionDeletionStatus.Scheduled || x.Status == InstitutionDeletionStatus.Failed
                || (x.Status == InstitutionDeletionStatus.Processing && x.ProcessingStartedAtUtc < now.AddMinutes(-30)))
                && x.FinalizeAtUtc != null && x.FinalizeAtUtc <= now)
            .ToListAsync(cancellationToken);

        foreach (var request in due)
        {
            if (request.TenantId is not Guid tenantId) continue;
            var claimed = await db.Set<InstitutionDeletionRequest>().IgnoreQueryFilters()
                .Where(x => x.Id == request.Id && x.Status == request.Status && x.ProcessingStartedAtUtc == request.ProcessingStartedAtUtc)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, InstitutionDeletionStatus.Processing)
                    .SetProperty(x => x.ProcessingStartedAtUtc, now), cancellationToken);
            if (claimed == 0) continue;
            db.ChangeTracker.Clear();
            try
            {
                await lifecycle.FinalizeInstitutionDeletionAsync(tenantId, cancellationToken);
                await db.Set<InstitutionDeletionRequest>().IgnoreQueryFilters().Where(x => x.Id == request.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, InstitutionDeletionStatus.Completed)
                        .SetProperty(x => x.CompletedAtUtc, DateTime.UtcNow).SetProperty(x => x.FailureReason, (string?)null), cancellationToken);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                logger?.LogError("Kurum silme yeniden denenecek: {RequestId}; hata türü: {ErrorType}", request.Id, ex.GetType().Name);
                db.ChangeTracker.Clear();
                await db.Set<InstitutionDeletionRequest>().IgnoreQueryFilters().Where(x => x.Id == request.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, InstitutionDeletionStatus.Failed)
                        .SetProperty(x => x.FailureReason, "finalize-retry-required"), cancellationToken);
            }
        }
    }
}
