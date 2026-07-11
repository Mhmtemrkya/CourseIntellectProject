using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

public sealed record CustomRoleDto(Guid Id, string Name, string BaseRole, IReadOnlyList<string> Modules, int UserCount);
public sealed record UpsertCustomRoleRequest(string Name, string? BaseRole, IReadOnlyList<string>? Modules);

/// <summary>
/// Kurum yöneticisinin tanımladığı özel roller (ör. "Kayıt Sorumlusu"). Tenant-scoped:
/// her kurum yalnız kendi rollerini görür/yönetir (query filter). Modül kısıtı API
/// seviyesinde EntitlementService tarafından zorlanır.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/custom-roles")]
public sealed class CustomRolesController(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : ControllerBase
{
    // Özel rolün panel/yetki tabanı olabilecek roller (personel kaydı akışıyla uyumlu).
    private static readonly HashSet<UserRole> AllowedBaseRoles =
        [UserRole.Administrative, UserRole.Teacher, UserRole.Cafeteria];

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var roles = await dbContext.CustomRoles.AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var counts = await dbContext.Users.AsNoTracking()
            .Where(u => u.CustomRoleId != null)
            .GroupBy(u => u.CustomRoleId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

        return Ok(roles.Select(r => new CustomRoleDto(
            r.Id, r.Name, r.BaseRole.ToString(), r.Modules, counts.GetValueOrDefault(r.Id))).ToList());
    }

    /// <summary>Oturum açan kullanıcının özel rol modülleri (UI menü filtrelemesi için).
    /// Özel rolü yoksa <c>null</c> modules döner = kısıt yok.</summary>
    [HttpGet("my")]
    [Authorize] // her rol çağırabilir
    public async Task<IActionResult> GetMy(CancellationToken cancellationToken)
    {
        var raw = User.FindFirstValue("custom_role_id");
        if (!Guid.TryParse(raw, out var customRoleId))
        {
            return Ok(new { modules = (IReadOnlyList<string>?)null });
        }

        var role = await dbContext.CustomRoles.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == customRoleId, cancellationToken);
        return Ok(new { name = role?.Name, modules = role is null || role.Modules.Count == 0 ? null : role.Modules });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertCustomRoleRequest request, CancellationToken cancellationToken)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length < 3) return BadRequest(new { message = "Rol adı en az 3 karakter olmalıdır." });

        var baseRole = UserRole.Administrative;
        if (!string.IsNullOrWhiteSpace(request.BaseRole))
        {
            if (!Enum.TryParse(request.BaseRole, true, out baseRole) || !AllowedBaseRoles.Contains(baseRole))
            {
                return BadRequest(new { message = "Geçersiz taban rol." });
            }
        }

        if (await dbContext.CustomRoles.AnyAsync(x => x.Name.ToLower() == name.ToLower(), cancellationToken))
        {
            return Conflict(new { message = "Bu adla bir rol zaten var." });
        }

        var role = new CustomRole
        {
            Name = name,
            BaseRole = baseRole,
            Modules = (request.Modules ?? []).Select(m => m.Trim()).Where(m => m.Length > 0).Distinct().ToList()
        };
        dbContext.CustomRoles.Add(role);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            "Özel rol oluşturuldu",
            "Permission",
            "CustomRole",
            role.Id.ToString(),
            $"\"{role.Name}\" (taban: {role.BaseRole}) — modüller: {(role.Modules.Count == 0 ? "tümü" : string.Join(", ", role.Modules))}.",
            cancellationToken);
        return Ok(new CustomRoleDto(role.Id, role.Name, role.BaseRole.ToString(), role.Modules, 0));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertCustomRoleRequest request, CancellationToken cancellationToken)
    {
        var role = await dbContext.CustomRoles.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (role is null) return NotFound();

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length >= 3) role.Name = name;
        if (request.Modules is not null)
        {
            role.Modules = request.Modules.Select(m => m.Trim()).Where(m => m.Length > 0).Distinct().ToList();
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            "Özel rol güncellendi",
            "Permission",
            "CustomRole",
            role.Id.ToString(),
            $"\"{role.Name}\" — modüller: {(role.Modules.Count == 0 ? "tümü" : string.Join(", ", role.Modules))}.",
            cancellationToken);
        return Ok(new CustomRoleDto(role.Id, role.Name, role.BaseRole.ToString(), role.Modules,
            await dbContext.Users.CountAsync(u => u.CustomRoleId == id, cancellationToken)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var role = await dbContext.CustomRoles.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (role is null) return NotFound();
        if (await dbContext.Users.AnyAsync(u => u.CustomRoleId == id, cancellationToken))
        {
            return BadRequest(new { message = "Bu role atanmış kullanıcılar var; önce onları başka role taşıyın." });
        }
        dbContext.CustomRoles.Remove(role);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            "Özel rol silindi",
            "Permission",
            "CustomRole",
            role.Id.ToString(),
            $"\"{role.Name}\" (taban: {role.BaseRole}) silindi.",
            cancellationToken);
        return NoContent();
    }
}
