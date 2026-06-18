using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class ParentNotifier(
    CourseIntellectDbContext dbContext,
    INotificationService notificationService,
    IPushNotificationService pushNotificationService) : IParentNotifier
{
    public async Task NotifyStudentParentAsync(
        string studentName,
        string title,
        string message,
        string category,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var name = studentName.Trim();
            if (name.Length == 0) return;

            var student = await dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(item => item.FullName == name, cancellationToken);

            // Uygulama içi bildirim (veli targetRole=Parent ile çeker; audience öğrenci adı).
            await notificationService.CreateNotificationAsync(
                new CreateNotificationRequest(title, message, "Şimdi", name, "Parent", category),
                cancellationToken);

            // Veli kullanıcısına gerçek push.
            if (student?.ParentUserId is Guid parentUserId)
            {
                await pushNotificationService.SendToUserAsync(
                    parentUserId,
                    title,
                    message,
                    new Dictionary<string, string> { ["category"] = category, ["student"] = name },
                    cancellationToken);
            }
        }
        catch
        {
            // Bildirim, asıl işlemi (yoklama/sonuç kaydı) bloklamamalı.
        }
    }
}
