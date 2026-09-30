namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record UpdateSupportTicketRequest(
    [global::System.ComponentModel.DataAnnotations.RegularExpression("^(open|in-progress|resolved|closed)$")] string? Status,
    string? Priority,
    [global::System.ComponentModel.DataAnnotations.StringLength(2000)] string? LastMessage,
    int? Messages
);
