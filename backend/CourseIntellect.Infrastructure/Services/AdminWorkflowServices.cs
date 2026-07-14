using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AuditLogService(
    CourseIntellectDbContext dbContext,
    IHttpContextAccessor httpContextAccessor) : IAuditLogService
{
    private const int MaxSnapshotLength = 4000;

    public Task LogAsync(
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        CancellationToken cancellationToken = default)
        => LogChangeAsync(action, category, entityType, entityId, detail, null, null, cancellationToken);

    public Task LogChangeAsync(
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        object? before,
        object? after,
        CancellationToken cancellationToken = default)
    {
        var user = httpContextAccessor.HttpContext?.User;
        Guid? actorId = null;
        var actorName = "Sistem";
        if (user?.Identity?.IsAuthenticated == true)
        {
            // Token sub/nameid/name kullanır (inbound claim map kapalı).
            var rawId = user.FindFirstValue("nameid") ?? user.FindFirstValue("sub")
                ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(rawId, out var parsed)) actorId = parsed;
            actorName = user.FindFirstValue("name")
                ?? user.FindFirstValue("unique_name")
                ?? user.Identity?.Name
                ?? "Bilinmiyor";
        }

        return WriteAsync(actorId, actorName, action, category, entityType, entityId, detail,
            Serialize(before), Serialize(after), cancellationToken);
    }

    public Task LogAsync(
        Guid? actorUserId,
        string actorName,
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        CancellationToken cancellationToken = default)
        => WriteAsync(actorUserId, actorName, action, category, entityType, entityId, detail, null, null, cancellationToken);

    private async Task WriteAsync(
        Guid? actorUserId,
        string actorName,
        string action,
        string category,
        string entityType,
        string entityId,
        string detail,
        string? beforeValue,
        string? afterValue,
        CancellationToken cancellationToken)
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
                BeforeValue = beforeValue,
                AfterValue = afterValue,
                IpAddress = ResolveIpAddress(),
                UserAgent = Truncate(httpContextAccessor.HttpContext?.Request.Headers.UserAgent.ToString(), 300),
                CreatedAtUtc = DateTime.UtcNow,
            }, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Denetim kaydı asıl işlemi bloklamamalı.
        }
    }

    /// <summary>Proxy arkasında gerçek istemci X-Forwarded-For'un ilk adresidir.</summary>
    private string? ResolveIpAddress()
    {
        var context = httpContextAccessor.HttpContext;
        if (context is null) return null;

        var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var first = forwarded.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(first)) return Truncate(first, 64);
        }

        return Truncate(context.Connection.RemoteIpAddress?.ToString(), 64);
    }

    private static string? Serialize(object? value)
        => value is null ? null : Truncate(JsonSerializer.Serialize(value), MaxSnapshotLength);

    private static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Length <= max ? value : value[..max];
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
                item.CreatedAtUtc,
                item.BranchId,
                string.Empty))
            .ToListAsync(cancellationToken);
    }

    public async Task<AuditLogPageDto> GetPagedAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default)
    {
        // Query filter tenant + şube izolasyonunu zaten uygular:
        // şube müdürü yalnız kendi şubesini, kurum sahibi tüm şubeleri görür.
        var logs = dbContext.AuditLogEntries.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim();
            logs = logs.Where(item => item.Category == category);
        }

        if (query.BranchId.HasValue)
        {
            logs = logs.Where(item => item.BranchId == query.BranchId.Value);
        }

        if (query.FromUtc.HasValue)
        {
            logs = logs.Where(item => item.CreatedAtUtc >= query.FromUtc.Value);
        }

        if (query.ToUtc.HasValue)
        {
            logs = logs.Where(item => item.CreatedAtUtc <= query.ToUtc.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            logs = logs.Where(item =>
                EF.Functions.ILike(item.ActorName, pattern)
                || EF.Functions.ILike(item.Action, pattern)
                || EF.Functions.ILike(item.Detail, pattern)
                || EF.Functions.ILike(item.EntityType, pattern));
        }

        var totalCount = await logs.CountAsync(cancellationToken);
        var skip = Math.Max(0, query.Skip);
        var take = query.Take is <= 0 or > 500 ? 100 : query.Take;

        var items = await logs
            .OrderByDescending(item => item.CreatedAtUtc)
            .Skip(skip)
            .Take(take)
            .Select(item => new AuditLogDto(
                item.Id,
                item.ActorName,
                item.Action,
                item.Category,
                item.EntityType,
                item.EntityId,
                item.Detail,
                item.CreatedAtUtc,
                item.BranchId,
                string.Empty))
            .ToListAsync(cancellationToken);

        var resolved = await AttachBranchNamesAsync(items, cancellationToken);
        return new AuditLogPageDto(resolved, totalCount, skip, take);
    }

    public async Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(
        CancellationToken cancellationToken = default)
    {
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
        var grouped = await dbContext.AuditLogEntries.AsNoTracking()
            .GroupBy(item => item.BranchId)
            .Select(group => new
            {
                BranchId = group.Key,
                TotalCount = group.Count(),
                Last7DaysCount = group.Count(item => item.CreatedAtUtc >= sevenDaysAgo),
                LastActivityUtc = (DateTime?)group.Max(item => item.CreatedAtUtc),
            })
            .ToListAsync(cancellationToken);

        var branchIds = grouped
            .Where(item => item.BranchId.HasValue)
            .Select(item => item.BranchId!.Value)
            .ToList();
        var branchNames = branchIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.OrgUnits.AsNoTracking()
                .Where(unit => branchIds.Contains(unit.Id))
                .ToDictionaryAsync(unit => unit.Id, unit => unit.Name, cancellationToken);

        return grouped
            .Select(item => new AuditBranchSummaryDto(
                item.BranchId,
                item.BranchId.HasValue && branchNames.TryGetValue(item.BranchId.Value, out var name)
                    ? name
                    : "Kurum Geneli",
                item.TotalCount,
                item.Last7DaysCount,
                item.LastActivityUtc))
            .OrderByDescending(item => item.TotalCount)
            .ToList();
    }

    private async Task<IReadOnlyList<AuditLogDto>> AttachBranchNamesAsync(
        List<AuditLogDto> items,
        CancellationToken cancellationToken)
    {
        var branchIds = items
            .Where(item => item.BranchId.HasValue)
            .Select(item => item.BranchId!.Value)
            .Distinct()
            .ToList();
        if (branchIds.Count == 0) return items;

        var names = await dbContext.OrgUnits.AsNoTracking()
            .Where(unit => branchIds.Contains(unit.Id))
            .ToDictionaryAsync(unit => unit.Id, unit => unit.Name, cancellationToken);

        return items
            .Select(item => item.BranchId.HasValue && names.TryGetValue(item.BranchId.Value, out var name)
                ? item with { BranchName = name }
                : item)
            .ToList();
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
