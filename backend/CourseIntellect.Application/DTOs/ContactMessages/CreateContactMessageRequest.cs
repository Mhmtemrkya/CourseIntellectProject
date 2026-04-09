namespace CourseIntellect.Application.DTOs.ContactMessages;

public sealed record CreateContactMessageRequest(
    string Name,
    string Email,
    string Subject,
    string Message
);
