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

    /// <summary>Adı verilen kullanıcının kayıtlı cihazlarına push gönderir
    /// (PushDeviceRegistration.FullName eşleşmesi; UserId bilinmeyen akışlar için).</summary>
    Task SendToUserByNameAsync(
        string fullName,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken cancellationToken = default);

    /// <summary>Belirtilen roldeki (Student/Parent/Teacher/Admin...) tüm kayıtlı
    /// cihazlara push gönderir. Tenant filtresi otomatik uygulanır.</summary>
    Task SendToRoleAsync(
        string role,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken cancellationToken = default);
}
