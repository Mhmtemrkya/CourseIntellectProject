namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingNotificationDto(string Id, string Title, string Message, string Time, bool Unread);
