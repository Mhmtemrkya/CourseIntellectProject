using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Paket yetki (entitlement) kontrolünün backend uygulaması.
/// Kayıtlar PlatformConfigurations "platform-package" tipinde (TenantId=null),
/// kurum eşleşmesi TenantWorkspace.Plan == paket adı üzerinden yapılır.
/// Çözülmüş paket kurum başına kısa süreli (60 sn) önbelleğe alınır.
/// </summary>
public sealed class EntitlementService(CourseIntellectDbContext dbContext, IMemoryCache cache)
    : IEntitlementService
{
    private const string ConfigurationType = "platform-package";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    // Kurumun paketi yoksa/tanımsızsa kullanılan sentinel: her şeye izin ver.
    private static readonly ResolvedPackage Unrestricted = new(true, new());

    public async Task<bool> IsAllowedAsync(
        ClaimsPrincipal user,
        string module,
        string? action,
        CancellationToken cancellationToken = default)
    {
        // Tenant bağlamı yoksa (platform yöneticisi) hiçbir kısıt uygulanmaz.
        var tenantRaw = user.FindFirstValue("tenant_id");
        if (!Guid.TryParse(tenantRaw, out var tenantId))
        {
            return true;
        }

        var package = await ResolveAsync(tenantId, cancellationToken);
        if (package.Unrestricted)
        {
            return true;
        }

        var roles = EffectiveRoles(user);
        if (roles.Count == 0)
        {
            return true;
        }

        // "İlgili rol" = kurumun paketinde tanımlı ve bu modülü (sayfayı) katalog
        // gereği içeren rol. Kullanıcının en az bir ilgili rolü izin veriyorsa
        // geç; ilgili roller var ama hiçbiri izin vermiyorsa reddet; hiç ilgili
        // rol yoksa (endpoint bu kullanıcının rollerini kapsamıyor) engelleme.
        var anyRelevantRoleDenied = false;
        foreach (var roleKey in roles)
        {
            if (!package.Roles.TryGetValue(roleKey, out var roleEntry))
            {
                continue;
            }

            if (!roleEntry.Modules.TryGetValue(module, out var moduleEntry))
            {
                continue; // bu rol bu modülü sahiplenmiyor
            }

            var actionAllowed = action is null || !IsActionExplicitlyDisabled(moduleEntry, action);
            if (moduleEntry.Enabled && actionAllowed)
            {
                return true;
            }

            anyRelevantRoleDenied = true;
        }

        return !anyRelevantRoleDenied;
    }

    private static bool IsActionExplicitlyDisabled(ResolvedModule moduleEntry, string action)
        => moduleEntry.Actions.TryGetValue(action, out var value) && value == false;

    // ─── Rol eşlemesi ─────────────────────────────────────────────────────────
    // Backend UserRole adlarını packageCatalog rol anahtarlarına indirger.
    // Öğretmen aynı zamanda counselor (rehber) olabildiğinden JWT'de ayrışmayan
    // bu durum için teacher, counselor rolüyle de genişletilir.
    private static HashSet<string> EffectiveRoles(ClaimsPrincipal user)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in user.FindAll("role"))
        {
            var mapped = MapRole(claim.Value);
            if (mapped is not null)
            {
                result.Add(mapped);
            }
        }

        if (result.Contains("teacher"))
        {
            result.Add("counselor");
        }

        return result;
    }

    private static string? MapRole(string backendRole) => backendRole?.Trim().ToLowerInvariant() switch
    {
        "admin" => "admin",
        "teacher" => "teacher",
        "accounting" => "finance",
        "administrative" => "administrative",
        "parent" => "parent",
        "student" => "student",
        "cafeteria" => "cafeteria",
        "developer" => "admin", // tenant bağlamlı developer'ı admin gibi değerlendir
        _ => null,
    };

    // ─── Paket çözümleme + önbellek ──────────────────────────────────────────
    private async Task<ResolvedPackage> ResolveAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var cacheKey = $"entitlements:{tenantId}";
        if (cache.TryGetValue<ResolvedPackage>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        var resolved = await LoadAsync(tenantId, cancellationToken);
        cache.Set(cacheKey, resolved, CacheTtl);
        return resolved;
    }

    private async Task<ResolvedPackage> LoadAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var planName = await dbContext.TenantWorkspaces
            .AsNoTracking()
            .Where(x => x.Id == tenantId)
            .Select(x => x.Plan)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(planName))
        {
            return Unrestricted;
        }

        var normalizedPlan = planName.Trim().ToLowerInvariant();
        var payload = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == null && x.ConfigurationType == ConfigurationType)
            .Where(x => x.DisplayName.ToLower() == normalizedPlan || x.ScopeKey.ToLower() == normalizedPlan)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(cancellationToken);

        return string.IsNullOrWhiteSpace(payload) ? Unrestricted : Parse(payload);
    }

    private static ResolvedPackage Parse(string payload)
    {
        try
        {
            using var document = JsonDocument.Parse(payload);
            if (!document.RootElement.TryGetProperty("roles", out var roles)
                || roles.ValueKind != JsonValueKind.Object)
            {
                return Unrestricted;
            }

            var parsedRoles = new Dictionary<string, ResolvedRole>(StringComparer.OrdinalIgnoreCase);
            foreach (var roleProperty in roles.EnumerateObject())
            {
                if (!roleProperty.Value.TryGetProperty("modules", out var modules)
                    || modules.ValueKind != JsonValueKind.Object)
                {
                    parsedRoles[roleProperty.Name] = new ResolvedRole(new());
                    continue;
                }

                var parsedModules = new Dictionary<string, ResolvedModule>(StringComparer.OrdinalIgnoreCase);
                foreach (var moduleProperty in modules.EnumerateObject())
                {
                    var enabled = moduleProperty.Value.TryGetProperty("enabled", out var enabledElement)
                        && enabledElement.ValueKind == JsonValueKind.True;

                    var parsedActions = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
                    if (moduleProperty.Value.TryGetProperty("actions", out var actions)
                        && actions.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var actionProperty in actions.EnumerateObject())
                        {
                            if (actionProperty.Value.ValueKind is JsonValueKind.True or JsonValueKind.False)
                            {
                                parsedActions[actionProperty.Name] = actionProperty.Value.GetBoolean();
                            }
                        }
                    }

                    parsedModules[moduleProperty.Name] = new ResolvedModule(enabled, parsedActions);
                }

                parsedRoles[roleProperty.Name] = new ResolvedRole(parsedModules);
            }

            // Tanım boşsa kısıtsız kabul et (kurum kilitlenmesin).
            return parsedRoles.Count == 0 ? Unrestricted : new ResolvedPackage(false, parsedRoles);
        }
        catch (JsonException)
        {
            // Bozuk paket kaydı kurumları kilitlemesin.
            return Unrestricted;
        }
    }

    private sealed record ResolvedModule(bool Enabled, Dictionary<string, bool> Actions);

    private sealed record ResolvedRole(Dictionary<string, ResolvedModule> Modules);

    private sealed record ResolvedPackage(bool Unrestricted, Dictionary<string, ResolvedRole> Roles);
}
