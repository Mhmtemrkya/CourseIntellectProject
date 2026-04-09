namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record CreateSupportTicketRequest(
    string Subject,
    string Tenant,
    string User,
    string UserRole,
    string Category,
    string Priority,
    string Summary,
    string LastMessage
);
