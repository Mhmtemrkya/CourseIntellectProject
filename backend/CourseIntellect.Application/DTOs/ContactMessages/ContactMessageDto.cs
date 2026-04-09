namespace CourseIntellect.Application.DTOs.ContactMessages;

public sealed record ContactMessageDto(
    Guid Id,
    string Name,
    string Email,
    string Subject,
    string Status,
    bool IsStarred,
    DateTime CreatedAtUtc,
    DateTime? ReadAtUtc,
    DateTime? RepliedAtUtc
);
