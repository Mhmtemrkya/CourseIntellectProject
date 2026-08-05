using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

public sealed record CustomRoleDto(
    Guid Id,
    string Name,
    string BaseRole,
    IReadOnlyList<string> Modules,
    IReadOnlyList<string> Permissions,
    int UserCount,
    bool ModulesRestricted = false);

public sealed record UpsertCustomRoleRequest(
    string Name,
    string? BaseRole,
    IReadOnlyList<string>? Modules,
    IReadOnlyList<string>? Permissions,
    /// <summary>
    /// true → <see cref="Modules"/> BAĞLAYICIDIR; boş liste "hiçbir sayfa yok"
    /// demektir. Yetki matrisinden gelen istekler daima true gönderir.
    /// </summary>
    bool ModulesRestricted = false);

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
            r.Id, r.Name, r.BaseRole.ToString(), r.Modules, r.Permissions,
            counts.GetValueOrDefault(r.Id), r.ModulesRestricted)).ToList());
    }

    /// <summary>
    /// Yetki matrisinin kaynağı: role verilebilecek sayfaların kataloğu.
    /// İstemci bu listeyi çizer; kaydederken sunucu yine aynı listeye göre
    /// doğrular (istemciye güvenilmez).
    /// </summary>
    [HttpGet("module-catalog")]
    public IActionResult GetModuleCatalog() => Ok(new
    {
        groups = SchoolModuleCatalog.Items
            .GroupBy(item => item.Group)
            .Select(group => new
            {
                title = group.Key,
                items = group.Select(item => new { item.Key, item.Label, item.Enforced }).ToList(),
            })
            .ToList(),
    });

    /// <summary>
    /// Modül anahtarlarını katalogla doğrular. Tanımsız anahtar sessizce
    /// düşürülmez: kurum yöneticisi neyi veremediğini görmeli. Platform yönetimi
    /// anahtarları katalogda olmadığı için buradan da geçemez.
    /// </summary>
    private static (List<string> Modules, string? Error) NormalizeModules(IReadOnlyList<string>? requested)
    {
        var codes = (requested ?? [])
            .Select(item => item?.Trim() ?? string.Empty)
            .Where(item => item.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var unknown = SchoolModuleCatalog.UnknownKeys(codes);
        if (unknown.Count > 0)
        {
            return ([], $"Tanımsız sayfa anahtarı: {string.Join(", ", unknown)}.");
        }

        return (codes, null);
    }

    /// <summary>
    /// İzin listesini taban rolün tavanıyla sınırlar. Tavan dışı bir kod istenirse
    /// sessizce düşürmek yerine hata döneriz — kurum admini neyi veremediğini görmeli.
    /// </summary>
    private static (List<string> Permissions, string? Error) NormalizePermissions(
        IReadOnlyList<string>? requested,
        UserRole baseRole)
    {
        var codes = (requested ?? [])
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (codes.Count == 0) return ([], null);

        var unknown = codes.Where(x => !DrivingPermissions.All.Contains(x)).ToList();
        if (unknown.Count > 0) return ([], $"Tanımsız izin kodu: {string.Join(", ", unknown)}.");

        var ceiling = DrivingPermissionCatalog.CeilingFor(baseRole.ToString());
        var aboveCeiling = codes.Where(x => !ceiling.Contains(x)).ToList();
        if (aboveCeiling.Count > 0)
            return ([], $"\"{baseRole}\" taban rolü bu izinleri veremez: {string.Join(", ", aboveCeiling)}.");

        return (codes, null);
    }

    /// <summary>
    /// Audit metni. "Boş liste = tümü" YANILTICI olurdu: kısıtlı rolde boş liste
    /// "hiçbir sayfa" demektir ve denetim kaydı bunu doğru yazmalı.
    /// </summary>
    private static string ModuleSummary(CustomRole role) => role.Modules.Count > 0
        ? string.Join(", ", role.Modules)
        : role.ModulesRestricted ? "hiçbiri (sayfa yetkisi verilmedi)" : "tümü";

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
        // modulesRestricted true ise BOŞ liste de anlamlıdır ("hiçbir sayfa"),
        // bu yüzden null'a çevrilmez — istemci menüyü buna göre kapatır.
        var restricted = role?.ModulesRestricted ?? false;
        return Ok(new
        {
            name = role?.Name,
            modulesRestricted = restricted,
            modules = role is null || (!restricted && role.Modules.Count == 0) ? null : role.Modules,
            permissions = role is null || role.Permissions.Count == 0 ? null : role.Permissions,
        });
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

        var (permissions, permissionError) = NormalizePermissions(request.Permissions, baseRole);
        if (permissionError is not null) return BadRequest(new { message = permissionError });

        var (modules, moduleError) = NormalizeModules(request.Modules);
        if (moduleError is not null) return BadRequest(new { message = moduleError });

        var role = new CustomRole
        {
            Name = name,
            BaseRole = baseRole,
            Modules = modules,
            ModulesRestricted = request.ModulesRestricted,
            Permissions = permissions,
        };
        dbContext.CustomRoles.Add(role);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogChangeAsync(
            "Özel rol oluşturuldu",
            "Permission",
            "CustomRole",
            role.Id.ToString(),
            $"\"{role.Name}\" (taban: {role.BaseRole}) — modüller: {ModuleSummary(role)}; "
                + $"izinler: {(role.Permissions.Count == 0 ? "taban rol varsayılanı" : string.Join(", ", role.Permissions))}.",
            null,
            new { role.Name, baseRole = role.BaseRole.ToString(), role.Modules, role.Permissions },
            cancellationToken);
        return Ok(new CustomRoleDto(role.Id, role.Name, role.BaseRole.ToString(), role.Modules, role.Permissions, 0, role.ModulesRestricted));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertCustomRoleRequest request, CancellationToken cancellationToken)
    {
        var role = await dbContext.CustomRoles.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (role is null) return NotFound();

        var before = new { role.Name, baseRole = role.BaseRole.ToString(), role.Modules, role.Permissions };

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length >= 3) role.Name = name;
        if (request.Modules is not null)
        {
            var (modules, moduleError) = NormalizeModules(request.Modules);
            if (moduleError is not null) return BadRequest(new { message = moduleError });
            role.Modules = modules;
            // Liste gönderildiyse bağlayıcılık da isteğe göre güncellenir; aksi
            // hâlde matristen kaydedilen rol bir sonraki düzenlemede "tam yetki"ye
            // dönebilirdi.
            role.ModulesRestricted = request.ModulesRestricted;
        }
        if (request.Permissions is not null)
        {
            var (permissions, permissionError) = NormalizePermissions(request.Permissions, role.BaseRole);
            if (permissionError is not null) return BadRequest(new { message = permissionError });
            role.Permissions = permissions;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogChangeAsync(
            "Özel rol güncellendi",
            "Permission",
            "CustomRole",
            role.Id.ToString(),
            $"\"{role.Name}\" — modüller: {ModuleSummary(role)}; "
                + $"izinler: {(role.Permissions.Count == 0 ? "taban rol varsayılanı" : string.Join(", ", role.Permissions))}.",
            before,
            new { role.Name, baseRole = role.BaseRole.ToString(), role.Modules, role.Permissions },
            cancellationToken);
        return Ok(new CustomRoleDto(role.Id, role.Name, role.BaseRole.ToString(), role.Modules, role.Permissions,
            await dbContext.Users.CountAsync(u => u.CustomRoleId == id, cancellationToken), role.ModulesRestricted));
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
