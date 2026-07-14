using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <inheritdoc cref="IDrivingNotifier"/>
public sealed class DrivingNotifier(
    CourseIntellectDbContext dbContext,
    IPushNotificationService pushService,
    ILogger<DrivingNotifier> logger) : IDrivingNotifier
{
    /// <summary>Aynı olay bu süre içinde tekrar bildirilmez.</summary>
    private static readonly TimeSpan DedupeWindow = TimeSpan.FromHours(24);

    public async Task NotifyUserAsync(
        Guid userId,
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (await IsDuplicateAsync(dedupeKey, cancellationToken)) return;

            var role = await dbContext.Users.AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => x.PrimaryRole.ToString())
                .SingleOrDefaultAsync(cancellationToken);

            dbContext.Notifications.Add(new NotificationItem
            {
                TargetUserId = userId,
                TargetRole = role ?? string.Empty,
                Audience = "User",
                Title = Trim(title, 180),
                Message = Trim(message, 600),
                Category = category,
                TimeLabel = "Az önce",
                DedupeKey = dedupeKey,
                RelatedEntityType = relatedEntityType,
                RelatedEntityId = relatedEntityId,
            });
            await dbContext.SaveChangesAsync(cancellationToken);

            await pushService.SendToUserAsync(
                userId,
                title,
                message,
                BuildData(category, relatedEntityType, relatedEntityId),
                cancellationToken);
        }
        catch (Exception exception)
        {
            // Bildirim, asıl işlemi (randevu/tahsilat) asla geri aldırmaz.
            logger.LogWarning(exception, "Sürücü kursu bildirimi gönderilemedi: {Category}", category);
        }
    }

    public async Task NotifyStudentAsync(
        Guid studentDrivingProfileId,
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == studentDrivingProfileId)
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (_, student) => (Guid?)student.UserId)
            .SingleOrDefaultAsync(cancellationToken);

        if (userId is not Guid target || target == Guid.Empty) return;
        await NotifyUserAsync(target, title, message, category, dedupeKey, relatedEntityType, relatedEntityId, cancellationToken);
    }

    public async Task NotifyInstructorAsync(
        Guid instructorProfileId,
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = await dbContext.DrivingInstructorProfiles.AsNoTracking()
            .Where(x => x.Id == instructorProfileId)
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (_, staff) => (Guid?)staff.UserId)
            .SingleOrDefaultAsync(cancellationToken);

        if (userId is not Guid target || target == Guid.Empty) return;
        await NotifyUserAsync(target, title, message, category, dedupeKey, relatedEntityType, relatedEntityId, cancellationToken);
    }

    public async Task NotifyManagersAsync(
        string title,
        string message,
        string category,
        string? dedupeKey = null,
        string? relatedEntityType = null,
        string? relatedEntityId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (await IsDuplicateAsync(dedupeKey, cancellationToken)) return;

            dbContext.Notifications.Add(new NotificationItem
            {
                TargetUserId = null, // rol yayını
                TargetRole = "Admin",
                Audience = "Yönetim",
                Title = Trim(title, 180),
                Message = Trim(message, 600),
                Category = category,
                TimeLabel = "Az önce",
                DedupeKey = dedupeKey,
                RelatedEntityType = relatedEntityType,
                RelatedEntityId = relatedEntityId,
            });
            await dbContext.SaveChangesAsync(cancellationToken);

            await pushService.SendToRoleAsync(
                "Admin",
                title,
                message,
                BuildData(category, relatedEntityType, relatedEntityId),
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Sürücü kursu yönetim bildirimi gönderilemedi: {Category}", category);
        }
    }

    /// <summary>Aynı olay son 24 saatte bildirildiyse tekrar bildirme.</summary>
    private async Task<bool> IsDuplicateAsync(string? dedupeKey, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dedupeKey)) return false;

        var since = DateTime.UtcNow - DedupeWindow;
        return await dbContext.Notifications.AsNoTracking()
            .AnyAsync(x => x.DedupeKey == dedupeKey && x.CreatedAtUtc >= since, cancellationToken);
    }

    private static Dictionary<string, string> BuildData(string category, string? entityType, string? entityId)
    {
        var data = new Dictionary<string, string> { ["category"] = category };
        if (!string.IsNullOrWhiteSpace(entityType)) data["entityType"] = entityType;
        if (!string.IsNullOrWhiteSpace(entityId)) data["entityId"] = entityId;
        return data;
    }

    private static string Trim(string value, int max)
        => value.Length <= max ? value : value[..max];
}
