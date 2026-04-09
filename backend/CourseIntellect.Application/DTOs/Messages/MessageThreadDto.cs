namespace CourseIntellect.Application.DTOs.Messages;

public sealed record MessageThreadDto(
    Guid Id,
    string ContactName,
    string ContactRole,
    string LastMessagePreview,
    DateTime LastMessageAtUtc,
    int UnreadCount,
    bool LastMessageFromMe,
    string LastMessageStatus
);
