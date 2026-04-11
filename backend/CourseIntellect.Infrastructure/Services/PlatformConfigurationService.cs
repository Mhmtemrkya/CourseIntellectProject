using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class PlatformConfigurationService(CourseIntellectDbContext dbContext) : IPlatformConfigurationService
{
    public async Task<IReadOnlyList<PlatformConfigurationDto>> GetAsync(string? configurationType, CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<PlatformConfiguration>().AsQueryable();

        if (!string.IsNullOrWhiteSpace(configurationType))
        {
            query = query.Where(x => x.ConfigurationType == configurationType.Trim());
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
        var explicitTenantId = ResolveExplicitTenantId(type, scopeKey);

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

    private static Guid? ResolveExplicitTenantId(string configurationType, string scopeKey)
    {
        return string.Equals(configurationType, "tenant-customization", StringComparison.OrdinalIgnoreCase)
               && Guid.TryParse(scopeKey, out var tenantId)
            ? tenantId
            : null;
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
