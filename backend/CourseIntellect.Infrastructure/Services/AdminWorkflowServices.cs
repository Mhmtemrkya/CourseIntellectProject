using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AuditLogService(CourseIntellectDbContext dbContext) : IAuditLogService
{
    public async Task LogAsync(
        Guid? actorUserId,
        string actorName,
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await dbContext.AuditLogEntries.AddAsync(new AuditLogEntry
            {
                ActorUserId = actorUserId,
                ActorName = string.IsNullOrWhiteSpace(actorName) ? "Sistem" : actorName.Trim(),
                Action = action.Trim(),
                Category = string.IsNullOrWhiteSpace(category) ? "Admin" : category.Trim(),
                EntityType = entityType?.Trim() ?? string.Empty,
                EntityId = entityId?.Trim() ?? string.Empty,
                Detail = detail?.Trim() ?? string.Empty,
                CreatedAtUtc = DateTime.UtcNow,
            }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Denetim kaydı asıl işlemi bloklamamalı.
        }
    }

    public async Task<IReadOnlyList<AuditLogDto>> GetAsync(
        string? category,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.AuditLogEntries.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = category.Trim();
            query = query.Where(item => item.Category == normalized);
        }

        return await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Take(take <= 0 ? 200 : take)
            .Select(item => new AuditLogDto(
                item.Id,
                item.ActorName,
                item.Action,
                item.Category,
                item.EntityType,
                item.EntityId,
                item.Detail,
                item.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }
}

public sealed class ApprovalService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : IApprovalService
{
    public async Task<ApprovalRequestDto> CreateAsync(
        CreateApprovalRequest request,
        Guid? requesterUserId,
        string requesterName,
        CancellationToken cancellationToken = default)
    {
        var entity = new ApprovalRequest
        {
            Category = string.IsNullOrWhiteSpace(request.Category) ? "General" : request.Category.Trim(),
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            RequesterUserId = requesterUserId,
            RequesterName = string.IsNullOrWhiteSpace(requesterName) ? "Bilinmiyor" : requesterName.Trim(),
            Unit = request.Unit?.Trim() ?? string.Empty,
            Amount = request.Amount,
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Normal" : request.Priority.Trim(),
            Status = "Pending",
            ReferenceType = request.ReferenceType?.Trim() ?? string.Empty,
            ReferenceKey = request.ReferenceKey?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.ApprovalRequests.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(requesterUserId, entity.RequesterName, "Onay talebi oluşturuldu",
            "Approval", nameof(ApprovalRequest), entity.Id.ToString(),
            $"{entity.Category}: {entity.Title}", cancellationToken);

        return Map(entity);
    }

    public async Task<IReadOnlyList<ApprovalRequestDto>> GetAsync(
        string? status,
        string? category,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.ApprovalRequests.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim();
            query = query.Where(item => item.Status == normalized);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = category.Trim();
            query = query.Where(item => item.Category == normalized);
        }

        return await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ApprovalRequestDto>> GetByRequesterAsync(
        Guid requesterUserId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.ApprovalRequests.AsNoTracking()
            .Where(item => item.RequesterUserId == requesterUserId)
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<ApprovalRequestDto?> DecideAsync(
        Guid id,
        ApprovalDecisionRequest decision,
        Guid? deciderUserId,
        string deciderName,
        CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ApprovalRequests.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entity is null) return null;

        var status = decision.Status.Trim();
        entity.Status = status switch
        {
            "Approved" or "Onaylandı" => "Approved",
            "Rejected" or "Reddedildi" => "Rejected",
            "Cancelled" or "İptal" => "Cancelled",
            _ => entity.Status,
        };
        entity.DecisionNote = decision.Note?.Trim() ?? string.Empty;
        entity.DecidedByUserId = deciderUserId;
        entity.DecidedByName = string.IsNullOrWhiteSpace(deciderName) ? "Yönetici" : deciderName.Trim();
        entity.DecidedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(deciderUserId, entity.DecidedByName, $"Onay {entity.Status}",
            "Approval", nameof(ApprovalRequest), entity.Id.ToString(),
            $"{entity.Title} → {entity.Status}", cancellationToken);

        return Map(entity);
    }

    private static ApprovalRequestDto Map(ApprovalRequest item) => new(
        item.Id,
        item.Category,
        item.Title,
        item.Description,
        item.RequesterName,
        item.Unit,
        item.Amount,
        item.Priority,
        item.Status,
        item.DecisionNote,
        item.DecidedByName,
        item.ReferenceType,
        item.ReferenceKey,
        item.CreatedAtUtc,
        item.DecidedAtUtc);
}
