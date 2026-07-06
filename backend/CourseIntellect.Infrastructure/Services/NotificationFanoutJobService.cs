using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Ağır bildirim fan-out'unun arka plan (Hangfire) implementasyonu. Her metot
/// tenant override'ı kurar (kuyruk işinde HttpContext yok), işini yapar, temizler.
/// Fan-out mantığı buraya taşındı; controller/servisler yalnız işi kuyruğa atar.
/// </summary>
public sealed class NotificationFanoutJobService(
    CourseIntellectDbContext dbContext,
    INotificationService notificationService,
    IPushNotificationService pushNotificationService,
    IParentNotifier parentNotifier,
    ILogger<NotificationFanoutJobService> logger) : INotificationFanoutJobService
{
    public async Task HomeworkAssignedAsync(Guid tenantId, Guid assignmentId, CancellationToken cancellationToken = default)
    {
        dbContext.SetTenantOverride(tenantId);
        try
        {
            var entity = await dbContext.Set<HomeworkAssignment>().AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == assignmentId, cancellationToken);
            if (entity is null) return;

            var normalizedClass = entity.ClassName.Trim().ToLowerInvariant();
            var students = (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
                .Where(s => s.ClassName.Trim().ToLowerInvariant() == normalizedClass)
                .ToList();

            var title = "Yeni ödev";
            var message = $"{entity.Subject} — {entity.Title} (son teslim: {entity.DeadlineLabel})";
            var data = new Dictionary<string, string> { ["category"] = "homework" };
            foreach (var student in students)
            {
                await notificationService.CreateNotificationAsync(new CreateNotificationRequest(
                    title, message, "Şimdi", student.FullName, "Student", "homework"), cancellationToken);
                await pushNotificationService.SendToUserByNameAsync(student.FullName, title, message, data, cancellationToken);
                await parentNotifier.NotifyStudentParentAsync(student.FullName, title, $"{student.FullName}: {message}", "homework", cancellationToken);
            }
            logger.LogInformation("Ödev fan-out bitti: {Count} öğrenci ({Assignment}).", students.Count, assignmentId);
        }
        finally
        {
            dbContext.SetTenantOverride(null);
        }
    }

    public async Task AnnouncementPublishedAsync(Guid tenantId, Guid announcementId, CancellationToken cancellationToken = default)
    {
        dbContext.SetTenantOverride(tenantId);
        try
        {
            var item = await dbContext.Announcements.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == announcementId, cancellationToken);
            if (item is null) return;

            var data = new Dictionary<string, string> { ["category"] = "announcement" };
            var body = item.Detail.Length > 120 ? item.Detail[..120] + "…" : item.Detail;
            var roles = item.Audience switch
            {
                "Ogrenci" => new[] { "Student" },
                "Veli" => new[] { "Parent" },
                "Ogretmen" => new[] { "Teacher" },
                _ => new[] { "Student", "Parent", "Teacher" },
            };
            foreach (var role in roles)
            {
                await pushNotificationService.SendToRoleAsync(role, item.Title, body, data, cancellationToken);
            }
            logger.LogInformation("Duyuru fan-out bitti: {Audience} ({Announcement}).", item.Audience, announcementId);
        }
        finally
        {
            dbContext.SetTenantOverride(null);
        }
    }
}
