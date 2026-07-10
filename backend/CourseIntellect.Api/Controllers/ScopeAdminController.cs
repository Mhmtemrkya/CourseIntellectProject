using CourseIntellect.Application.DTOs.Scope;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Grup hiyerarşisi + kapsam (grant) atama konsolu. DELEGE yönetim: platform admin her şeyi
/// yönetir; onun dışındaki bir yönetici YALNIZCA kendi Manage yetkisinin kapsadığı alt ağacı
/// görür ve düzenler. Temel kural: kimse kendi eriştiğinden fazlasını veremez (yetki yükseltme
/// engeli). Kurum sahibi kendi markasını, İl/İlçe müdürü kendi bölgesini bu ekrandan yönetir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/scope-admin")]
public sealed class ScopeAdminController(
    CourseIntellectDbContext dbContext,
    IUserScopeService scopeService) : ControllerBase
{
    private bool IsPlatformAdmin() =>
        string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase)
        || User.IsInRole("Developer");

    private Guid? CallerId() =>
        Guid.TryParse(User.FindFirstValue("user_id")
            ?? User.FindFirstValue("nameid")
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    // Konsol kapısı: ev grant'ları HER kullanıcıya Manage verdiğinden (görünürlük semantiği),
    // salt Manage-grant kontrolü öğrenci/veliyi bile içeri alırdı. Konsola yalnız:
    // platform admin, Admin-katmanı rol (kurum admin/şube müdürü) veya AÇIKÇA verilmiş
    // Group/Platform Manage grant'ı olan (İl/İlçe müdürü) girer.
    private async Task<bool> HasConsoleAccessAsync(Guid callerId, CancellationToken ct)
    {
        if (IsPlatformAdmin() || User.IsInRole("Admin")) return true;
        var grants = await scopeService.GetGrantsAsync(callerId, ct);
        return grants.Any(g =>
            (g.Level == ScopeLevel.Group || g.Level == ScopeLevel.Platform)
            && g.AccessMode == ScopeAccessMode.Manage);
    }

    // ── Delege yetki yardımcıları (platform admin = tam yetki kısayolu) ──
    private async Task<bool> CanManageGroup(Guid callerId, Guid groupId, CancellationToken ct) =>
        IsPlatformAdmin() || await scopeService.CanManageGroupAsync(callerId, groupId, ct);

    private async Task<bool> CanManageTenant(Guid callerId, Guid tenantId, CancellationToken ct) =>
        IsPlatformAdmin() || await scopeService.CanManageTenantAsync(callerId, tenantId, ct);

    private async Task<bool> CanManageBranch(Guid callerId, Guid branchId, CancellationToken ct)
    {
        var tenantId = await dbContext.OrgUnits.IgnoreQueryFilters().AsNoTracking()
            .Where(o => o.Id == branchId).Select(o => o.TenantId).FirstOrDefaultAsync(ct);
        return tenantId is Guid t && await CanManageTenant(callerId, t, ct);
    }

    // Bir grant hedefini (level+target) verecek/yönetecek yetki var mı? (yetki yükseltme engeli)
    private async Task<bool> CanGovernTarget(Guid callerId, ScopeLevel level, Guid? targetId, CancellationToken ct) => level switch
    {
        ScopeLevel.Platform => IsPlatformAdmin(),
        ScopeLevel.Group => targetId is Guid g && await CanManageGroup(callerId, g, ct),
        ScopeLevel.Tenant => targetId is Guid t && await CanManageTenant(callerId, t, ct),
        ScopeLevel.Branch => targetId is Guid b && await CanManageBranch(callerId, b, ct),
        _ => false
    };

    private async Task<bool> CanSeeUser(Guid callerId, Guid userId, CancellationToken ct)
    {
        if (IsPlatformAdmin()) return true;
        var tenantId = await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.Id == userId).Select(u => u.TenantId).FirstOrDefaultAsync(ct);
        return tenantId is Guid t && await scopeService.CanManageTenantAsync(callerId, t, ct);
    }

    // ─────────────────────── Gruplar (ağaç) ───────────────────────
    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups(CancellationToken cancellationToken)
    {
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        HashSet<Guid>? allowed = IsPlatformAdmin()
            ? null
            : (await scopeService.GetManageableGroupIdsAsync(callerId, cancellationToken)).ToHashSet();

        var groups = await dbContext.TenantGroups.AsNoTracking()
            .Select(g => new { g.Id, g.Name, g.ParentGroupId })
            .ToListAsync(cancellationToken);
        var counts = (await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
                .Where(t => t.GroupId != null)
                .Select(t => t.GroupId!.Value)
                .ToListAsync(cancellationToken))
            .GroupBy(x => x).ToDictionary(x => x.Key, x => x.Count());

        var result = groups
            .Where(g => allowed is null || allowed.Contains(g.Id))
            .OrderBy(g => g.Name)
            .Select(g => new ScopeGroupDto(g.Id, g.Name, g.ParentGroupId, counts.GetValueOrDefault(g.Id)))
            .ToList();
        return Ok(result);
    }

    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateScopeGroupRequest request, CancellationToken cancellationToken)
    {
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Grup adı zorunludur." });

        if (request.ParentGroupId is Guid parentId)
        {
            if (!await dbContext.TenantGroups.AnyAsync(g => g.Id == parentId, cancellationToken))
                return BadRequest(new { message = "Üst grup bulunamadı." });
            // Alt grup açmak için üst grubu yönetebilmeli.
            if (!await CanManageGroup(callerId, parentId, cancellationToken)) return Forbid();
        }
        else if (!IsPlatformAdmin())
        {
            // Kök (üst grupsuz) grup yalnız platform tarafından açılır.
            return Forbid();
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
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        if (!await CanManageGroup(callerId, id, cancellationToken)) return Forbid();
        if (await dbContext.TenantGroups.AnyAsync(g => g.ParentGroupId == id, cancellationToken))
            return BadRequest(new { message = "Alt grubu olan bir grup silinemez." });
        if (await dbContext.TenantWorkspaces.IgnoreQueryFilters().AnyAsync(t => t.GroupId == id, cancellationToken))
            return BadRequest(new { message = "Bağlı kurumu olan bir grup silinemez." });
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
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        HashSet<Guid>? allowed = IsPlatformAdmin()
            ? null
            : (await scopeService.GetManageableTenantIdsAsync(callerId, cancellationToken)).ToHashSet();

        var query = dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking();
        var tenants = await query.OrderBy(t => t.Name)
            .Select(t => new ScopeTenantLiteDto(t.Id, t.Name, t.GroupId))
            .ToListAsync(cancellationToken);
        return Ok(allowed is null ? tenants : tenants.Where(t => allowed.Contains(t.Id)).ToList());
    }

    [HttpPut("tenants/{tenantId:guid}/group")]
    public async Task<IActionResult> AssignTenantGroup(Guid tenantId, [FromBody] AssignTenantGroupRequest request, CancellationToken cancellationToken)
    {
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        if (!await CanManageTenant(callerId, tenantId, cancellationToken)) return Forbid();
        if (request.GroupId is Guid groupId)
        {
            if (!await dbContext.TenantGroups.AnyAsync(g => g.Id == groupId, cancellationToken))
                return BadRequest(new { message = "Grup bulunamadı." });
            if (!await CanManageGroup(callerId, groupId, cancellationToken)) return Forbid();
        }
        var tenant = await dbContext.TenantWorkspaces.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null) return NotFound();

        // Kurum zaten bir gruba bağlıysa, gruptan koparma/taşıma o grubu da yönetmeyi
        // gerektirir — kurum admin'i kendini MEB/marka hiyerarşisinden çıkaramaz.
        if (tenant.GroupId is Guid currentGroupId && currentGroupId != request.GroupId
            && !await CanManageGroup(callerId, currentGroupId, cancellationToken))
        {
            return Forbid();
        }
        tenant.GroupId = request.GroupId;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ─────────────────────── Kullanıcı kapsamları (grant) ───────────────────────
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? search, CancellationToken cancellationToken)
    {
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        var query = dbContext.Users.IgnoreQueryFilters().AsNoTracking();
        if (!IsPlatformAdmin())
        {
            var manageable = (await scopeService.GetManageableTenantIdsAsync(callerId, cancellationToken)).ToHashSet();
            query = query.Where(u => u.TenantId != null && manageable.Contains(u.TenantId.Value));
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.FullName.ToLower().Contains(s) || u.Username.ToLower().Contains(s));
        }
        var users = await query.OrderBy(u => u.FullName).Take(50)
            .Select(u => new ScopeUserDto(u.Id, u.FullName, u.Username, u.PrimaryRole.ToString()))
            .ToListAsync(cancellationToken);
        return Ok(users);
    }

    [HttpGet("users/{userId:guid}/grants")]
    public async Task<IActionResult> GetUserGrants(Guid userId, CancellationToken cancellationToken)
    {
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        if (!await CanSeeUser(callerId, userId, cancellationToken)) return Forbid();
        var grants = await dbContext.UserScopeGrants.AsNoTracking()
            .Where(g => g.UserId == userId).ToListAsync(cancellationToken);
        return Ok(await ToDtosAsync(grants, cancellationToken));
    }

    [HttpPost("users/{userId:guid}/grants")]
    public async Task<IActionResult> AddGrant(Guid userId, [FromBody] AddGrantRequest request, CancellationToken cancellationToken)
    {
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        if (!Enum.TryParse<ScopeLevel>(request.Level, true, out var level))
            return BadRequest(new { message = "Geçersiz kapsam seviyesi." });
        if (!Enum.TryParse<ScopeAccessMode>(request.AccessMode, true, out var accessMode))
            return BadRequest(new { message = "Geçersiz erişim türü." });
        if (!await dbContext.Users.IgnoreQueryFilters().AnyAsync(u => u.Id == userId, cancellationToken))
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        if (!await CanSeeUser(callerId, userId, cancellationToken)) return Forbid();

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

        // Yetki yükseltme engeli: yalnız kendi yönettiğin kapsamı verebilirsin.
        if (!await CanGovernTarget(callerId, level, request.TargetId, cancellationToken)) return Forbid();

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
        if (CallerId() is not Guid callerId) return Unauthorized();
        if (!await HasConsoleAccessAsync(callerId, cancellationToken)) return Forbid();
        var grant = await dbContext.UserScopeGrants.FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (grant is null) return NotFound();
        if (grant.IsHome) return BadRequest(new { message = "Kullanıcının ev kapsamı silinemez." });
        // Silmek için o kapsamı yönetebilmeli.
        if (!await CanGovernTarget(callerId, grant.Level, grant.TargetId, cancellationToken)) return Forbid();
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
