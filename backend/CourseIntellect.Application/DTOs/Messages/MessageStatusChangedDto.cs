namespace CourseIntellect.Application.DTOs.Messages;

public sealed record MessageStatusChangedDto(
    Guid ThreadId,
    Guid MessageId,
    string Status,
    DateTime? ReadAtUtc
);
