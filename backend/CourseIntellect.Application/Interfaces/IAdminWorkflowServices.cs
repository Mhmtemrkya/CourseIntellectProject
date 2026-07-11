using CourseIntellect.Application.DTOs.Admin;

namespace CourseIntellect.Application.Interfaces;

public interface IApprovalService
{
    Task<ApprovalRequestDto> CreateAsync(
        CreateApprovalRequest request,
        Guid? requesterUserId,
        string requesterName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ApprovalRequestDto>> GetAsync(
        string? status,
        string? category,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ApprovalRequestDto>> GetByRequesterAsync(
        Guid requesterUserId,
        CancellationToken cancellationToken = default);

    Task<ApprovalRequestDto?> DecideAsync(
        Guid id,
        ApprovalDecisionRequest decision,
        Guid? deciderUserId,
        string deciderName,
        CancellationToken cancellationToken = default);
}

public interface IAuditLogService
{
    Task LogAsync(
        Guid? actorUserId,
        string actorName,
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        CancellationToken cancellationToken = default);

    /// <summary>Aktörü mevcut HTTP bağlamındaki kimlikten otomatik çözerek kayıt yazar.</summary>
    Task LogAsync(
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AuditLogDto>> GetAsync(
        string? category,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>Gelişmiş filtreli + sayfalanmış sorgu. Şube izolasyonu query filter ile otomatik uygulanır.</summary>
    Task<AuditLogPageDto> GetPagedAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default);

    /// <summary>Aktif kurum için şube bazında kayıt özetleri (kurum yöneticisi şube şube görebilsin).</summary>
    Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(
        CancellationToken cancellationToken = default);
}
