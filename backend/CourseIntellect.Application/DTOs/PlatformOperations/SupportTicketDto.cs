namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record SupportTicketDto(
    Guid Id,
    string TicketNumber,
    string Subject,
    string Tenant,
    string User,
    string UserRole,
    string Category,
    string Priority,
    string Status,
    string Summary,
    string LastMessage,
    int Messages,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
