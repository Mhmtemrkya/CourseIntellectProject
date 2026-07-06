using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class LibraryReminderService(
    CourseIntellectDbContext dbContext,
    IPushNotificationService pushNotificationService,
    IParentNotifier parentNotifier) : ILibraryReminderService
{
    public async Task<int> SendDueRemindersAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var soonThreshold = now.AddDays(2);
        var loans = await dbContext.LibraryLoans
            .Where(l => l.ReturnedAtUtc == null && l.DueAtUtc <= soonThreshold)
            .ToListAsync(cancellationToken);

        foreach (var loan in loans)
        {
            var overdue = loan.DueAtUtc < now;
            var title = overdue ? "Kitap iade süresi geçti" : "Kitap iade süresi yaklaşıyor";
            var message = $"{loan.BookTitle} — iade tarihi {loan.DueAtUtc:dd.MM.yyyy}";
            // Öğrenci: uygulama içi bildirim
            dbContext.Notifications.Add(new NotificationItem
            {
                Title = title, Message = message,
                TimeLabel = now.ToString("dd.MM.yyyy HH:mm"),
                Audience = loan.StudentName, TargetRole = "Student", Category = "library",
            });
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        // Öğrenciye telefon push + veliye (ParentNotifier: uygulama içi + push).
        foreach (var loan in loans)
        {
            var overdue = loan.DueAtUtc < now;
            var title = overdue ? "Kitap iade süresi geçti" : "Kitap iade süresi yaklaşıyor";
            var message = $"{loan.BookTitle} — iade tarihi {loan.DueAtUtc:dd.MM.yyyy}";
            await pushNotificationService.SendToUserByNameAsync(
                loan.StudentName, title, message,
                new Dictionary<string, string> { ["category"] = "library" }, cancellationToken);
            await parentNotifier.NotifyStudentParentAsync(
                loan.StudentName, title, $"{loan.StudentName}: {message}", "library", cancellationToken);
        }
        return loans.Count;
    }
}
