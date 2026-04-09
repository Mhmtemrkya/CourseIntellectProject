namespace CourseIntellect.Application.DTOs.Notifications;

public sealed record NotificationDto(
    Guid Id,
    string Title,
    string Message,
    string TimeLabel,
    string Audience,
    string TargetRole,
    string Category,
    bool IsRead
);
