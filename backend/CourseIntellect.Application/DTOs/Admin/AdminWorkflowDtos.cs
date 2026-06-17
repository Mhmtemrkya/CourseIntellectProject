namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateApprovalRequest(
    string Category,
    string Title,
    string? Description,
    decimal? Amount,
    string? Priority,
    string? Unit,
    string? ReferenceType,
    string? ReferenceKey);

public sealed record ApprovalDecisionRequest(string Status, string? Note);

public sealed record ApprovalRequestDto(
    Guid Id,
    string Category,
    string Title,
    string Description,
    string RequesterName,
    string Unit,
    decimal? Amount,
    string Priority,
    string Status,
    string DecisionNote,
    string DecidedByName,
    string ReferenceType,
    string ReferenceKey,
    DateTime CreatedAtUtc,
    DateTime? DecidedAtUtc);

public sealed record AuditLogDto(
    Guid Id,
    string ActorName,
    string Action,
    string Category,
    string EntityType,
    string EntityId,
    string Detail,
    DateTime CreatedAtUtc);
