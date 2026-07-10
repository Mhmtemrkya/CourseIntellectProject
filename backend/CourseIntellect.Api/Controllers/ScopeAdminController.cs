using CourseIntellect.Application.DTOs.Scope;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Grup hiyerarşisi + kapsam (grant) atama konsolu. Platform yöneticisine kilitli:
/// çok-kurumlu sahip (marka grubu) ve MEB İl/İlçe/Okul hiyerarşisi buradan kurulur.
/// Kurum içi (şube müdürü vb.) atamalar zaten personel kaydından yapılır; burası kurumlar
/// ÜSTÜ yapısal kurulum içindir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/scope-admin")]
public sealed class ScopeAdminController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private bool IsPlatformAdmin() =>
        string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase)
        || User.IsInRole("Developer");

    // ─────────────────────── Gruplar (ağaç) ───────────────────────
    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups(CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();

        var groups = await dbContext.TenantGroups.AsNoTracking()
            .Select(g => new { g.Id, g.Name, g.ParentGroupId })
            .ToListAsync(cancellationToken);
        var counts = (await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
                .Where(t => t.GroupId != null)
                .Select(t => t.GroupId!.Value)
                .ToListAsync(cancellationToken))
            .GroupBy(x => x)
            .ToDictionary(x => x.Key, x => x.Count());

        var result = groups
            .OrderBy(g => g.Name)
            .Select(g => new ScopeGroupDto(g.Id, g.Name, g.ParentGroupId, counts.GetValueOrDefault(g.Id)))
            .ToList();
        return Ok(result);
    }

    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateScopeGroupRequest request, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Grup adı zorunludur." });
        if (request.ParentGroupId is Guid parentId
            && !await dbContext.TenantGroups.AnyAsync(g => g.Id == parentId, cancellationToken))
        {
            return BadRequest(new { message = "Üst grup bulunamadı." });
        }

        var rawSlug = $"{Slugify(request.Name)}-{Guid.NewGuid():N}";
        var group = new TenantGroup
        {
            Name = request.Name.Trim(),
            Slug = (rawSlug.Length > 60 ? rawSlug[..60] : rawSlug).Trim('-'),
            ParentGroupId = request.ParentGroupId
        };
        dbContext.TenantGroups.Add(group);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ScopeGroupDto(group.Id, group.Name, group.ParentGroupId, 0));
    }

    [HttpDelete("groups/{id:guid}")]
    public async Task<IActionResult> DeleteGroup(Guid id, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        if (await dbContext.TenantGroups.AnyAsync(g => g.ParentGroupId == id, cancellationToken))
        {
            return BadRequest(new { message = "Alt grubu olan bir grup silinemez." });
        }
        if (await dbContext.TenantWorkspaces.IgnoreQueryFilters().AnyAsync(t => t.GroupId == id, cancellationToken))
        {
            return BadRequest(new { message = "Bağlı kurumu olan bir grup silinemez." });
        }
        var group = await dbContext.TenantGroups.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (group is null) return NotFound();
        dbContext.TenantGroups.Remove(group);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ─────────────────────── Kurum → grup bağlama ───────────────────────
    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants(CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var tenants = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new ScopeTenantLiteDto(t.Id, t.Name, t.GroupId))
            .ToListAsync(cancellationToken);
        return Ok(tenants);
    }

    [HttpPut("tenants/{tenantId:guid}/group")]
    public async Task<IActionResult> AssignTenantGroup(Guid tenantId, [FromBody] AssignTenantGroupRequest request, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var tenant = await dbContext.TenantWorkspaces.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null) return NotFound();
        if (request.GroupId is Guid groupId
            && !await dbContext.TenantGroups.AnyAsync(g => g.Id == groupId, cancellationToken))
        {
            return BadRequest(new { message = "Grup bulunamadı." });
        }
        tenant.GroupId = request.GroupId;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ─────────────────────── Kullanıcı kapsamları (grant) ───────────────────────
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? search, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var query = dbContext.Users.IgnoreQueryFilters().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.FullName.ToLower().Contains(s) || u.Username.ToLower().Contains(s));
        }
        var users = await query
            .OrderBy(u => u.FullName)
            .Take(50)
            .Select(u => new ScopeUserDto(u.Id, u.FullName, u.Username, u.PrimaryRole.ToString()))
            .ToListAsync(cancellationToken);
        return Ok(users);
    }

    [HttpGet("users/{userId:guid}/grants")]
    public async Task<IActionResult> GetUserGrants(Guid userId, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var grants = await dbContext.UserScopeGrants.AsNoTracking()
            .Where(g => g.UserId == userId)
            .ToListAsync(cancellationToken);
        return Ok(await ToDtosAsync(grants, cancellationToken));
    }

    [HttpPost("users/{userId:guid}/grants")]
    public async Task<IActionResult> AddGrant(Guid userId, [FromBody] AddGrantRequest request, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        if (!Enum.TryParse<ScopeLevel>(request.Level, true, out var level))
            return BadRequest(new { message = "Geçersiz kapsam seviyesi." });
        if (!Enum.TryParse<ScopeAccessMode>(request.AccessMode, true, out var accessMode))
            return BadRequest(new { message = "Geçersiz erişim türü." });
        if (!await dbContext.Users.IgnoreQueryFilters().AnyAsync(u => u.Id == userId, cancellationToken))
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        // Hedef doğrulama
        if (level == ScopeLevel.Platform)
        {
            if (request.TargetId is not null) return BadRequest(new { message = "Platform kapsamı hedef almaz." });
        }
        else if (request.TargetId is not Guid targetId)
        {
            return BadRequest(new { message = "Bu seviye için hedef seçimi zorunludur." });
        }
        else if (!await TargetExistsAsync(level, targetId, cancellationToken))
        {
            return BadRequest(new { message = "Seçilen hedef bulunamadı." });
        }

        var exists = await dbContext.UserScopeGrants.AnyAsync(
            g => g.UserId == userId && g.Level == level && g.TargetId == request.TargetId, cancellationToken);
        if (exists) return Conflict(new { message = "Bu kapsam zaten atanmış." });

        var grant = new UserScopeGrant
        {
            UserId = userId,
            Level = level,
            TargetId = request.TargetId,
            AccessMode = accessMode,
            IsHome = false
        };
        dbContext.UserScopeGrants.Add(grant);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dtos = await ToDtosAsync([grant], cancellationToken);
        return Ok(dtos[0]);
    }

    [HttpDelete("grants/{id:guid}")]
    public async Task<IActionResult> RemoveGrant(Guid id, CancellationToken cancellationToken)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var grant = await dbContext.UserScopeGrants.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (grant is null) return NotFound();
        if (grant.IsHome) return BadRequest(new { message = "Kullanıcının ev kapsamı silinemez." });
        dbContext.UserScopeGrants.Remove(grant);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ─────────────────────── yardımcılar ───────────────────────
    private async Task<bool> TargetExistsAsync(ScopeLevel level, Guid targetId, CancellationToken ct) => level switch
    {
        ScopeLevel.Group => await dbContext.TenantGroups.AnyAsync(g => g.Id == targetId, ct),
        ScopeLevel.Tenant => await dbContext.TenantWorkspaces.IgnoreQueryFilters().AnyAsync(t => t.Id == targetId, ct),
        ScopeLevel.Branch => await dbContext.OrgUnits.IgnoreQueryFilters().AnyAsync(o => o.Id == targetId, ct),
        _ => false
    };

    private async Task<List<UserGrantDto>> ToDtosAsync(IReadOnlyList<UserScopeGrant> grants, CancellationToken ct)
    {
        var groupIds = grants.Where(g => g.Level == ScopeLevel.Group && g.TargetId is not null).Select(g => g.TargetId!.Value).ToHashSet();
        var tenantIds = grants.Where(g => g.Level == ScopeLevel.Tenant && g.TargetId is not null).Select(g => g.TargetId!.Value).ToHashSet();
        var branchIds = grants.Where(g => g.Level == ScopeLevel.Branch && g.TargetId is not null).Select(g => g.TargetId!.Value).ToHashSet();

        var groupNames = await dbContext.TenantGroups.AsNoTracking()
            .Where(g => groupIds.Contains(g.Id)).ToDictionaryAsync(g => g.Id, g => g.Name, ct);
        var tenantNames = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        var branchNames = await dbContext.OrgUnits.IgnoreQueryFilters().AsNoTracking()
            .Where(o => branchIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, o => o.Name, ct);

        string NameFor(UserScopeGrant g) => g.Level switch
        {
            ScopeLevel.Platform => "Tüm Platform",
            ScopeLevel.Group => g.TargetId is Guid id && groupNames.TryGetValue(id, out var n) ? n : "(grup)",
            ScopeLevel.Tenant => g.TargetId is Guid id && tenantNames.TryGetValue(id, out var n) ? n : "(kurum)",
            ScopeLevel.Branch => g.TargetId is Guid id && branchNames.TryGetValue(id, out var n) ? n : "(şube)",
            _ => "-"
        };

        return grants
            .Select(g => new UserGrantDto(g.Id, g.Level.ToString(), g.TargetId, NameFor(g), g.AccessMode.ToString(), g.IsHome))
            .ToList();
    }

    private static string Slugify(string value)
    {
        var lowered = value.Trim().ToLowerInvariant()
            .Replace('ı', 'i').Replace('ğ', 'g').Replace('ü', 'u')
            .Replace('ş', 's').Replace('ö', 'o').Replace('ç', 'c');
        var chars = lowered.Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
        return new string(chars).Trim('-');
    }
}
