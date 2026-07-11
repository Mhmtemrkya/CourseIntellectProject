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
    DateTime CreatedAtUtc,
    Guid? BranchId = null,
    string BranchName = "");

/// <summary>Sayfalanmış denetim kaydı sonucu (toplam sayıyla birlikte).</summary>
public sealed record AuditLogPageDto(
    IReadOnlyList<AuditLogDto> Items,
    int TotalCount,
    int Skip,
    int Take);

/// <summary>Denetim kayıtlarında gelişmiş filtre seçenekleri.</summary>
public sealed record AuditLogQuery(
    string? Category = null,
    Guid? BranchId = null,
    string? Search = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Skip = 0,
    int Take = 100);

/// <summary>Şube bazında denetim kaydı özeti (kurum yöneticisi görünümü).</summary>
public sealed record AuditBranchSummaryDto(
    Guid? BranchId,
    string BranchName,
    int TotalCount,
    int Last7DaysCount,
    DateTime? LastActivityUtc);
