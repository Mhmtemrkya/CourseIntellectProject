using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Etkin izinleri şu sırayla çözer:
///   1. Platform yöneticisi / Developer → kısıt yok.
///   2. Taban rol → varsayılan izin seti (<see cref="DrivingPermissionCatalog.Defaults"/>).
///   3. Kullanıcının özel rolü varsa ve rolde izin listesi tanımlıysa → o liste,
///      taban rolün TAVANI ile kesiştirilerek uygulanır (yetki yükseltmesi imkânsız).
///
/// Öğretmenin direksiyon mu teorik mi olduğu <c>DrivingInstructorProfile</c> varlığından
/// anlaşılır; sonuç kullanıcı başına 60 sn önbelleklenir.
/// </summary>
public sealed class DrivingPermissionService(CourseIntellectDbContext dbContext, IMemoryCache cache)
    : IDrivingPermissionService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);
    private static readonly IReadOnlySet<string> Empty = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    public async Task<bool> HasAsync(ClaimsPrincipal user, string permission, CancellationToken cancellationToken = default)
        => (await GetPermissionsAsync(user, cancellationToken)).Contains(permission);

    public async Task<DrivingPermissionSnapshot> GetSnapshotAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
    {
        var roleKey = await ResolveRoleKeyAsync(user, cancellationToken);
        var permissions = await GetPermissionsAsync(user, cancellationToken);
        return new DrivingPermissionSnapshot(
            roleKey ?? "none",
            permissions.OrderBy(x => x, StringComparer.Ordinal).ToList(),
            IsUnrestricted(user) || roleKey == DrivingPermissionCatalog.Owner,
            roleKey == DrivingPermissionCatalog.BranchManager);
    }

    public async Task<IReadOnlySet<string>> GetPermissionsAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
    {
        if (IsUnrestricted(user))
        {
            return DrivingPermissions.All;
        }

        var roleKey = await ResolveRoleKeyAsync(user, cancellationToken);
        if (roleKey is null)
        {
            return Empty;
        }

        var defaults = DrivingPermissionCatalog.DefaultsFor(roleKey);

        var customRole = await ResolveCustomRoleAsync(user, cancellationToken);
        if (customRole is null || customRole.Permissions.Count == 0)
        {
            return defaults;
        }

        // Özel rol daraltır ve şekillendirir, ama taban rolün tavanını aşamaz.
        var ceiling = DrivingPermissionCatalog.CeilingFor(customRole.BaseRole);
        return new HashSet<string>(
            customRole.Permissions.Where(ceiling.Contains),
            StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Platform yöneticisi ve tenant'sız Developer hiçbir kısıta tabi değildir.</summary>
    private static bool IsUnrestricted(ClaimsPrincipal user)
        => string.Equals(user.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase)
           || (user.IsInRole("Developer") && !Guid.TryParse(user.FindFirstValue("tenant_id"), out _));

    private async Task<string?> ResolveRoleKeyAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        // BranchManager JWT'de Admin alias'ı da taşır; önce dar olanı sorgula.
        if (user.IsInRole("BranchManager")) return DrivingPermissionCatalog.BranchManager;
        if (user.IsInRole("Admin") || user.IsInRole("Developer")) return DrivingPermissionCatalog.Owner;
        if (user.IsInRole("Accounting")) return DrivingPermissionCatalog.Accounting;
        if (user.IsInRole("Administrative")) return DrivingPermissionCatalog.Secretary;
        if (user.IsInRole("Student")) return DrivingPermissionCatalog.Student;
        if (user.IsInRole("Teacher"))
        {
            return await HasInstructorProfileAsync(user, cancellationToken)
                ? DrivingPermissionCatalog.DrivingInstructor
                : DrivingPermissionCatalog.TheoryInstructor;
        }

        return null;
    }

    private async Task<bool> HasInstructorProfileAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId(user);
        if (userId is null) return false;

        var cacheKey = $"driving-instructor-profile:{userId:N}";
        if (cache.TryGetValue(cacheKey, out bool cached)) return cached;

        var exists = await dbContext.DrivingInstructorProfiles
            .AsNoTracking()
            .Join(dbContext.Staff.AsNoTracking().Where(x => x.UserId == userId), x => x.StaffId, x => x.Id, (profile, _) => profile.Id)
            .AnyAsync(cancellationToken);

        cache.Set(cacheKey, exists, CacheTtl);
        return exists;
    }

    private async Task<CustomRolePermissions?> ResolveCustomRoleAsync(ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(user.FindFirstValue("custom_role_id"), out var customRoleId))
        {
            return null;
        }

        var cacheKey = $"driving-custom-role:{customRoleId:N}";
        if (cache.TryGetValue(cacheKey, out CustomRolePermissions? cached) && cached is not null)
        {
            return cached;
        }

        var role = await dbContext.CustomRoles
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.Id == customRoleId)
            .Select(x => new { x.BaseRole, x.PermissionsSerialized })
            .FirstOrDefaultAsync(cancellationToken);

        if (role is null) return null;

        var permissions = string.IsNullOrWhiteSpace(role.PermissionsSerialized)
            ? []
            : JsonSerializer.Deserialize<List<string>>(role.PermissionsSerialized) ?? [];

        var resolved = new CustomRolePermissions(role.BaseRole.ToString(), permissions);
        cache.Set(cacheKey, resolved, CacheTtl);
        return resolved;
    }

    private static Guid? CurrentUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue("nameid") ?? user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private sealed record CustomRolePermissions(string BaseRole, List<string> Permissions);
}
