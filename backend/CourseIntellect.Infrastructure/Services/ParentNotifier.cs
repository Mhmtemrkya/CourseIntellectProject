using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class ParentNotifier(
    CourseIntellectDbContext dbContext,
    IPushNotificationService pushNotificationService) : IParentNotifier
{
    public Task NotifyStudentParentAsync(
        string studentName,
        string title,
        string message,
        string category,
        CancellationToken cancellationToken = default)
        => NotifyStudentParentAsync(null, studentName, title, message, category, null, cancellationToken);

    public async Task NotifyStudentParentAsync(
        Guid? studentUserId,
        string studentName,
        string title,
        string message,
        string category,
        string? dedupeKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var name = studentName.Trim();
            if (name.Length == 0 && studentUserId is null) return;

            var parentUserId = await ResolveParentUserIdAsync(studentUserId, name, cancellationToken);

            // Bildirim yalnız o öğrencinin velisine yazılır. Eskiden rol yayını
            // (TargetRole=Parent, kişi boş) olarak yazılıyordu ve kurumdaki BÜTÜN
            // veliler başka çocukların devamsızlık/borç bilgisini görüyordu. Veli
            // hesabı bağlı değilse kime gideceği bilinmez; hiç yazılmaz.
            if (parentUserId is not Guid parentId) return;

            if (!string.IsNullOrWhiteSpace(dedupeKey)
                && await dbContext.Notifications.AsNoTracking()
                    .AnyAsync(item => item.DedupeKey == dedupeKey && item.TargetUserId == parentId, cancellationToken))
            {
                return;
            }

            await dbContext.Notifications.AddAsync(new NotificationItem
            {
                Title = title,
                Message = message,
                TimeLabel = "Şimdi",
                Audience = name,
                TargetRole = "Parent",
                Category = category,
                TargetUserId = parentId,
                DedupeKey = string.IsNullOrWhiteSpace(dedupeKey) ? null : dedupeKey,
            }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);

            await pushNotificationService.SendToUserAsync(
                parentId,
                title,
                message,
                new Dictionary<string, string> { ["category"] = category, ["student"] = name },
                cancellationToken);
        }
        catch
        {
            // Bildirim, asıl işlemi (yoklama/sonuç kaydı) bloklamamalı.
        }
    }

    private async Task<Guid?> ResolveParentUserIdAsync(Guid? studentUserId, string name, CancellationToken cancellationToken)
    {
        var student = studentUserId is Guid userId
            ? await dbContext.Students.AsNoTracking()
                .Where(item => item.UserId == userId)
                .Select(item => new { item.ParentUserId, item.ParentEmail })
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        if (student is null && name.Length > 0)
        {
            // Yalnız adla: ad tek bir öğrenciye aitse onun velisi; aynı adlı birden
            // çok öğrenci varsa tahminle yanlış veliye bildirim gönderilmez.
            var byName = await dbContext.Students.AsNoTracking()
                .Where(item => item.FullName == name)
                .Select(item => new { item.ParentUserId, item.ParentEmail })
                .Take(2)
                .ToListAsync(cancellationToken);
            student = byName.Count == 1 ? byName[0] : null;
        }

        if (student is null) return null;
        if (student.ParentUserId is Guid parentUserId) return parentUserId;

        // Veli hesabı öğrenci kartına bağlanmamış ama veli e-postası girilmişse,
        // o e-postayla açılmış veli kullanıcısı bulunur.
        var email = student.ParentEmail?.Trim().ToLowerInvariant() ?? string.Empty;
        if (email.Length == 0) return null;
        var parents = await dbContext.Users.AsNoTracking()
            .Where(item => item.PrimaryRole == UserRole.Parent && item.Username.ToLower() == email)
            .Select(item => item.Id)
            .Take(2)
            .ToListAsync(cancellationToken);
        return parents.Count == 1 ? parents[0] : null;
    }
}
