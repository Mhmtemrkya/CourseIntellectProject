using System.Globalization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Haftalık özet bildirimi (Pazartesi sabahı). Kurallar:
/// • Varsayılan kapalı: "Assistant:WeeklyDigest:Enabled" = true değilse hiçbir şey gönderilmez.
/// • Kurum bazında çalışır; her kurum için tenant override kurulur ve her zaman temizlenir.
/// • Bildirim metni yalnız SAYI içerir (öğrenci adı yok): push kilit ekranında görünür.
/// • Aynı hafta için aynı kişiye ikinci kez gönderilmez (DedupeKey: hafta + kullanıcı); iş yeniden
///   denenirse tekrar gönderim olmaz.
/// • Önerisi olmayan öğretmene bildirim gönderilmez (gürültü yok).
/// </summary>
public sealed class WeeklyDigestJob(
    CourseIntellectDbContext dbContext,
    IStudentInsightService insights,
    IPushNotificationService push,
    IConfiguration configuration,
    ILogger<WeeklyDigestJob> logger) : IWeeklyDigestJob
{
    public const string Category = "WeeklyDigest";

    public bool Enabled => bool.TryParse(configuration["Assistant:WeeklyDigest:Enabled"], out var enabled) && enabled;

    public async Task<int> RunAsync(CancellationToken cancellationToken = default)
    {
        if (!Enabled)
        {
            logger.LogInformation("Haftalık özet kapalı (Assistant:WeeklyDigest:Enabled).");
            return 0;
        }

        var week = WeekKey(DateTime.UtcNow.AddHours(3));
        var sent = 0;
        var tenantIds = await dbContext.TenantWorkspaces.AsNoTracking().Where(t => t.Status == "active").Select(t => t.Id).ToListAsync(cancellationToken);
        foreach (var tenantId in tenantIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                dbContext.SetTenantOverride(tenantId);
                sent += await RunTenantAsync(week, cancellationToken);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Kurum {TenantId} için haftalık özet başarısız.", tenantId);
            }
            finally
            {
                dbContext.SetTenantOverride(null);
            }
        }
        logger.LogInformation("Haftalık özet bitti: {Count} bildirim.", sent);
        return sent;
    }

    private async Task<int> RunTenantAsync(string week, CancellationToken ct)
    {
        var slots = await dbContext.TeacherTimetableSlots.AsNoTracking()
            .Where(x => x.TeacherUserId != null)
            .Select(x => new { TeacherUserId = x.TeacherUserId!.Value, x.ClassName })
            .ToListAsync(ct);
        var classActions = new Dictionary<string, (int Reviews, int Groups)>(StringComparer.Ordinal);
        var sent = 0;
        foreach (var teacher in slots.GroupBy(x => x.TeacherUserId))
        {
            var reviews = 0;
            var groups = 0;
            var classesWithActions = 0;
            foreach (var className in teacher.Select(x => x.ClassName.Trim()).Where(x => x.Length > 0).Distinct(StringComparer.Ordinal))
            {
                if (!classActions.TryGetValue(className, out var counts))
                {
                    var actions = (await insights.GetClassAsync(className, ct))?.Actions ?? [];
                    counts = (actions.Count(a => a.Kind == "class_review"), actions.Count(a => a.Kind == "study_group"));
                    classActions[className] = counts;
                }
                reviews += counts.Reviews;
                groups += counts.Groups;
                if (counts.Reviews + counts.Groups > 0) classesWithActions++;
            }
            if (reviews + groups == 0) continue;

            var dedupe = $"weekly-digest:{week}:{teacher.Key:N}";
            if (await dbContext.Notifications.AsNoTracking().AnyAsync(x => x.DedupeKey == dedupe && x.TargetUserId == teacher.Key, ct)) continue;

            const string title = "Haftalık özetiniz hazır";
            var parts = new List<string>();
            if (reviews > 0) parts.Add($"{reviews} sınıf tekrarı");
            if (groups > 0) parts.Add($"{groups} etüt grubu");
            var message = $"{classesWithActions} sınıfınız için {string.Join(" ve ", parts)} önerim var. Ayrıntılar Maydi'de ve konu analizinde.";
            dbContext.Notifications.Add(new NotificationItem
            {
                Title = title,
                Message = message,
                TimeLabel = "Şimdi",
                Audience = "Öğretmen",
                TargetRole = "Teacher",
                Category = Category,
                TargetUserId = teacher.Key,
                DedupeKey = dedupe,
            });
            await dbContext.SaveChangesAsync(ct);
            try
            {
                await push.SendToUserAsync(teacher.Key, title, message, new Dictionary<string, string> { ["category"] = Category }, ct);
            }
            catch (Exception ex)
            {
                // Push başarısızsa uygulama içi bildirim yine durur; tekrar gönderim yapılmaz.
                logger.LogInformation(ex, "Haftalık özet push gönderilemedi.");
            }
            sent++;
        }
        return sent;
    }

    /// <summary>ISO hafta anahtarı (Türkiye saatine göre), ör. "2026-W45".</summary>
    public static string WeekKey(DateTime localNow) =>
        $"{ISOWeek.GetYear(localNow)}-W{ISOWeek.GetWeekOfYear(localNow):00}";
}
