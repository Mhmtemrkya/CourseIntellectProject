namespace CourseIntellect.Application.DTOs.ContactMessages;

public sealed record ContactMessageDetailDto(
    Guid Id,
    string Name,
    string Email,
    string Subject,
    string Message,
    string Status,
    bool IsStarred,
    string IpAddress,
    DateTime CreatedAtUtc,
    DateTime? ReadAtUtc,
    DateTime? RepliedAtUtc
);
