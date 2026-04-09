namespace CourseIntellect.Application.DTOs.Messages;

public sealed record CreateThreadRequest(
    string ContactName,
    string ContactRole,
    string? InitialMessage
);
