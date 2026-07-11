using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Geliştirici/platform yöneticisi denetim merkezi: TÜM kurumların log kayıtları
/// kurum kurum, şube şube izlenir. Tenant query filter bilinçli olarak aşılır
/// (IgnoreQueryFilters) ve erişim yalnızca platform admin kimliğine açıktır.
/// </summary>
[ApiController]
[Authorize]
[Route("api/platformops/audit")]
public sealed class PlatformAuditController(CourseIntellectDbContext dbContext) : ControllerBase
{
    // Fail-closed: yalnızca platform admin bayrağı taşıyan veya Developer rolündeki kimlikler.
    private bool IsPlatformAdmin()
    {
        return string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase)
               || User.IsInRole("Developer");
    }

    /// <summary>Kurum bazında log özeti: her kurumun toplam/son 7 gün kayıt sayısı ve son aktivitesi.</summary>
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
        var grouped = await dbContext.AuditLogEntries
            .IgnoreQueryFilters()
            .AsNoTracking()
            .GroupBy(item => item.TenantId)
            .Select(group => new
            {
                TenantId = group.Key,
                TotalCount = group.Count(),
                Last7DaysCount = group.Count(item => item.CreatedAtUtc >= sevenDaysAgo),
                LastActivityUtc = (DateTime?)group.Max(item => item.CreatedAtUtc),
            })
            .ToListAsync(cancellationToken);

        var tenants = await dbContext.TenantWorkspaces
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Select(tenant => new { tenant.Id, tenant.Name })
            .ToListAsync(cancellationToken);
        var tenantNames = tenants.ToDictionary(tenant => tenant.Id, tenant => tenant.Name);

        var items = grouped
            .Select(item => new
            {
                tenantId = item.TenantId,
                tenantName = item.TenantId.HasValue && tenantNames.TryGetValue(item.TenantId.Value, out var name)
                    ? name
                    : "Platform / Kurumsuz",
                totalCount = item.TotalCount,
                last7DaysCount = item.Last7DaysCount,
                lastActivityUtc = item.LastActivityUtc,
            })
            .OrderByDescending(item => item.totalCount)
            .ToList();

        return Ok(items);
    }

    /// <summary>Bir kurumun şube bazında log dağılımı.</summary>
    [HttpGet("tenants/{tenantId:guid}/branches")]
    public async Task<IActionResult> GetTenantBranchBreakdown(Guid tenantId, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
        var grouped = await dbContext.AuditLogEntries
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .GroupBy(item => item.BranchId)
            .Select(group => new
            {
                BranchId = group.Key,
                TotalCount = group.Count(),
                Last7DaysCount = group.Count(item => item.CreatedAtUtc >= sevenDaysAgo),
                LastActivityUtc = (DateTime?)group.Max(item => item.CreatedAtUtc),
            })
            .ToListAsync(cancellationToken);

        var branchIds = grouped.Where(item => item.BranchId.HasValue).Select(item => item.BranchId!.Value).ToList();
        var branchNames = branchIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.OrgUnits
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(unit => branchIds.Contains(unit.Id))
                .ToDictionaryAsync(unit => unit.Id, unit => unit.Name, cancellationToken);

        var items = grouped
            .Select(item => new
            {
                branchId = item.BranchId,
                branchName = item.BranchId.HasValue && branchNames.TryGetValue(item.BranchId.Value, out var name)
                    ? name
                    : "Kurum Geneli",
                totalCount = item.TotalCount,
                last7DaysCount = item.Last7DaysCount,
                lastActivityUtc = item.LastActivityUtc,
            })
            .OrderByDescending(item => item.totalCount)
            .ToList();

        return Ok(items);
    }

    /// <summary>Detaylı log listesi: kurum + (opsiyonel) şube + kategori/arama/tarih filtreleri, sayfalı.</summary>
    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs(
        [FromQuery] Guid? tenantId,
        [FromQuery] Guid? branchId,
        [FromQuery] string? category,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var query = dbContext.AuditLogEntries
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AsQueryable();

        if (tenantId.HasValue) query = query.Where(item => item.TenantId == tenantId.Value);
        if (branchId.HasValue) query = query.Where(item => item.BranchId == branchId.Value);
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = category.Trim();
            query = query.Where(item => item.Category == normalized);
        }

        if (fromUtc.HasValue) query = query.Where(item => item.CreatedAtUtc >= fromUtc.Value);
        if (toUtc.HasValue) query = query.Where(item => item.CreatedAtUtc <= toUtc.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(item =>
                EF.Functions.ILike(item.ActorName, pattern)
                || EF.Functions.ILike(item.Action, pattern)
                || EF.Functions.ILike(item.Detail, pattern)
                || EF.Functions.ILike(item.EntityType, pattern));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var boundedTake = take is <= 0 or > 500 ? 100 : take;
        var boundedSkip = Math.Max(0, skip);

        var rows = await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Skip(boundedSkip)
            .Take(boundedTake)
            .ToListAsync(cancellationToken);

        var rowTenantIds = rows.Where(item => item.TenantId.HasValue).Select(item => item.TenantId!.Value).Distinct().ToList();
        var rowBranchIds = rows.Where(item => item.BranchId.HasValue).Select(item => item.BranchId!.Value).Distinct().ToList();

        var tenantNames = rowTenantIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.TenantWorkspaces
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(tenant => rowTenantIds.Contains(tenant.Id))
                .ToDictionaryAsync(tenant => tenant.Id, tenant => tenant.Name, cancellationToken);
        var branchNames = rowBranchIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await dbContext.OrgUnits
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(unit => rowBranchIds.Contains(unit.Id))
                .ToDictionaryAsync(unit => unit.Id, unit => unit.Name, cancellationToken);

        var items = rows.Select(item => new
        {
            id = item.Id,
            tenantId = item.TenantId,
            tenantName = item.TenantId.HasValue && tenantNames.TryGetValue(item.TenantId.Value, out var tenantName)
                ? tenantName
                : "Platform",
            branchId = item.BranchId,
            branchName = item.BranchId.HasValue && branchNames.TryGetValue(item.BranchId.Value, out var branchName)
                ? branchName
                : string.Empty,
            actorName = item.ActorName,
            action = item.Action,
            category = item.Category,
            entityType = item.EntityType,
            entityId = item.EntityId,
            detail = item.Detail,
            createdAtUtc = item.CreatedAtUtc,
        }).ToList();

        return Ok(new { items, totalCount, skip = boundedSkip, take = boundedTake });
    }
}
