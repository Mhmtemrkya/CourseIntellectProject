namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateTaskRequest(
    string Title,
    string? Description,
    string? Category,
    Guid? AssignedToUserId,
    string? AssignedToName,
    string? Priority,
    DateTime? DueDate,
    DateTime? StartDate,
    DateTime? EndDate);

public sealed record TaskStatusRequest(string Status, string? Reason = null);

public sealed record AdminTaskDto(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string AssignedToName,
    string Priority,
    string Status,
    string CreatedByName,
    DateTime? DueDateUtc,
    DateTime? StartDateUtc,
    DateTime? EndDateUtc,
    string ResponseStatus,
    string RejectionReason,
    DateTime? RespondedAtUtc,
    DateTime CreatedAtUtc,
    DateTime? CompletedAtUtc);
