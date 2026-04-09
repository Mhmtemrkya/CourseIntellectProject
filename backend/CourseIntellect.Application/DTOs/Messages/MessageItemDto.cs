namespace CourseIntellect.Application.DTOs.Messages;

public sealed record MessageItemDto(
    Guid Id,
    Guid ThreadId,
    string SenderName,
    string SenderRole,
    string Text,
    bool IsRead,
    DateTime SentAtUtc,
    bool IsFromCurrentActor,
    string Status,
    DateTime? ReadAtUtc
);
