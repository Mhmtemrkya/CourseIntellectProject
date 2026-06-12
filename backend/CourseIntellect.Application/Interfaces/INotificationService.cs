using CourseIntellect.Application.DTOs.Notifications;

namespace CourseIntellect.Application.Interfaces;

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetNotificationsAsync(string? targetRole, string? audience, CancellationToken cancellationToken = default);
    Task<NotificationDto> CreateNotificationAsync(CreateNotificationRequest request, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default);
}

public interface IPushNotificationService
{
    Task SendToUserAsync(
        Guid userId,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken cancellationToken = default);
}
