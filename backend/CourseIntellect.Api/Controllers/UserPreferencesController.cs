using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kullanıcı bazlı tercih saklaması (bildirim ayarları, vb.). Tenant-scoped.
/// localStorage yerine backend kalıcı kaynak.
///
/// Veri PlatformConfigurations tablosunda tutulur:
///   ConfigurationType = "user-prefs"
///   ScopeKey = userId (Guid)
///   PayloadJson = arbitrary JSON
/// Yeni tablo eklemeye gerek yok; mevcut tenant-scoped JSON store yeterli.
/// </summary>
[ApiController]
[Authorize]
[Route("api/user-preferences")]
public sealed class UserPreferencesController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string ConfigurationType = "user-prefs";

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var (userId, tenantId) = ResolveContext();
        if (userId is null || tenantId is null) return Unauthorized();

        var entity = await dbContext.PlatformConfigurations
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId.Value
                && item.ConfigurationType == ConfigurationType
                && item.ScopeKey == userId.Value.ToString("N"))
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null)
        {
            return Ok(new { preferences = new { } });
        }

        try
        {
            var doc = JsonDocument.Parse(entity.PayloadJson);
            return Ok(new { preferences = doc.RootElement });
        }
        catch
        {
            return Ok(new { preferences = new { } });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Put([FromBody] JsonElement payload, CancellationToken cancellationToken)
    {
        var (userId, tenantId) = ResolveContext();
        if (userId is null || tenantId is null) return Unauthorized();

        var scopeKey = userId.Value.ToString("N");
        var json = payload.ValueKind == JsonValueKind.Undefined ? "{}" : payload.GetRawText();

        var entity = await dbContext.PlatformConfigurations
            .FirstOrDefaultAsync(item => item.TenantId == tenantId.Value
                && item.ConfigurationType == ConfigurationType
                && item.ScopeKey == scopeKey, cancellationToken);

        if (entity is null)
        {
            entity = new PlatformConfiguration
            {
                TenantId = tenantId.Value,
                ConfigurationType = ConfigurationType,
                ScopeKey = scopeKey,
                DisplayName = $"USER_PREFS::{scopeKey}",
                PayloadJson = json,
                UpdatedAtUtc = DateTime.UtcNow,
            };
            await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
        }
        else
        {
            entity.PayloadJson = json;
            entity.UpdatedAtUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            var doc = JsonDocument.Parse(entity.PayloadJson);
            return Ok(new { preferences = doc.RootElement });
        }
        catch
        {
            return Ok(new { preferences = new { } });
        }
    }

    private (Guid? UserId, Guid? TenantId) ResolveContext()
    {
        var userIdClaim = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub");
        var tenantIdClaim = User.FindFirstValue("tenant_id");
        if (!Guid.TryParse(userIdClaim, out var userId)) return (null, null);
        if (!Guid.TryParse(tenantIdClaim, out var tenantId)) return (userId, null);
        return (userId, tenantId);
    }
}
