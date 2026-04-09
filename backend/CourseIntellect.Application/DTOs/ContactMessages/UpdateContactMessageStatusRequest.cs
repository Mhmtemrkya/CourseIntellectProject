namespace CourseIntellect.Application.DTOs.ContactMessages;

public sealed record UpdateContactMessageStatusRequest(
    string Status,
    bool IsStarred
);
