using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Infrastructure.Services;

public sealed class PlatformConfigurationService(
    CourseIntellectDbContext dbContext,
    IHttpContextAccessor httpContextAccessor) : IPlatformConfigurationService
{
    private const string ClassManagementConfigurationType = "class-management";
    private const string ClassRegistryConfigurationType = "class-registry";

    public async Task<IReadOnlyList<PlatformConfigurationDto>> GetAsync(string? configurationType, CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<PlatformConfiguration>().AsQueryable();
        var type = configurationType?.Trim();

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(x => x.ConfigurationType == type);
        }

        if (IsTenantBoundConfiguration(type))
        {
            var tenantId = await ResolveTenantIdAsync(cancellationToken);
            query = tenantId.HasValue
                ? query.IgnoreQueryFilters().Where(x => x.TenantId == tenantId.Value)
                : query.Where(_ => false);
        }

        return await query
            .OrderBy(x => x.ConfigurationType)
            .ThenBy(x => x.ScopeKey)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<PlatformConfigurationDto> UpsertAsync(UpsertPlatformConfigurationRequest request, CancellationToken cancellationToken = default)
    {
        var type = request.ConfigurationType.Trim();
        var scopeKey = request.ScopeKey.Trim();
        var explicitTenantId = await ResolveExplicitTenantIdAsync(type, scopeKey, cancellationToken);

        if (string.IsNullOrWhiteSpace(type))
        {
            throw new InvalidOperationException("ConfigurationType zorunludur.");
        }

        if (string.IsNullOrWhiteSpace(scopeKey))
        {
            throw new InvalidOperationException("ScopeKey zorunludur.");
        }

        var entity = await dbContext.Set<PlatformConfiguration>()
            .FirstOrDefaultAsync(x => x.ConfigurationType == type && x.ScopeKey == scopeKey, cancellationToken);

        if (entity is null)
        {
            entity = new PlatformConfiguration
            {
                ConfigurationType = type,
                ScopeKey = scopeKey,
                TenantId = explicitTenantId,
            };
            await dbContext.Set<PlatformConfiguration>().AddAsync(entity, cancellationToken);
        }
        else if (explicitTenantId.HasValue)
        {
            entity.TenantId = explicitTenantId;
        }

        entity.DisplayName = request.DisplayName.Trim();
        entity.PayloadJson = request.PayloadJson;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    private async Task<Guid?> ResolveExplicitTenantIdAsync(string configurationType, string scopeKey, CancellationToken cancellationToken)
    {
        if (string.Equals(configurationType, "tenant-customization", StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(scopeKey, out var explicitTenantId))
        {
            return explicitTenantId;
        }

        return IsTenantBoundConfiguration(configurationType)
            ? await ResolveTenantIdAsync(cancellationToken)
            : null;
    }

    private async Task<Guid?> ResolveTenantIdAsync(CancellationToken cancellationToken)
    {
        var user = httpContextAccessor.HttpContext?.User;
        var tenantRaw = user?.FindFirstValue("tenant_id");
        if (Guid.TryParse(tenantRaw, out var tenantId))
        {
            return tenantId;
        }

        var userRaw = user?.FindFirstValue("user_id") ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userRaw, out var userId))
        {
            return null;
        }

        return await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.Id == userId)
            .Select(item => item.TenantId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static bool IsTenantBoundConfiguration(string? configurationType)
    {
        return string.Equals(configurationType, ClassManagementConfigurationType, StringComparison.OrdinalIgnoreCase)
               || string.Equals(configurationType, ClassRegistryConfigurationType, StringComparison.OrdinalIgnoreCase)
               || string.Equals(configurationType, "role-management", StringComparison.OrdinalIgnoreCase);
    }

    private static PlatformConfigurationDto ToDto(PlatformConfiguration entity) => new(
        entity.Id,
        entity.ConfigurationType,
        entity.ScopeKey,
        entity.DisplayName,
        entity.PayloadJson,
        entity.UpdatedAtUtc
    );
}
