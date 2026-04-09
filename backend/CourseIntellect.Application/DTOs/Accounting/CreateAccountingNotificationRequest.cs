namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record CreateAccountingNotificationRequest(
    string Title,
    string Message
);
