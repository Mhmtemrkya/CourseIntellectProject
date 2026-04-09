namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record UpdateSupportTicketRequest(
    string? Status,
    string? Priority,
    string? LastMessage,
    int? Messages
);
