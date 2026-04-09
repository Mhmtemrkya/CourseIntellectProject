namespace CourseIntellect.Application.DTOs.Notifications;

public sealed record CreateNotificationRequest(
    string Title,
    string Message,
    string TimeLabel,
    string Audience,
    string TargetRole,
    string Category
);
