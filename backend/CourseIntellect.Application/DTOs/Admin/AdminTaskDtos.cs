namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateTaskRequest(
    string Title,
    string? Description,
    string? Category,
    Guid? AssignedToUserId,
    string? AssignedToName,
    string? Priority,
    DateTime? DueDate);

public sealed record TaskStatusRequest(string Status);

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
    DateTime CreatedAtUtc,
    DateTime? CompletedAtUtc);
