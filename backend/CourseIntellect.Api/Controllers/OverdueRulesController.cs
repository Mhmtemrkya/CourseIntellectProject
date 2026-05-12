using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Finans modülünde "gecikme kuralları" (otomatik hatırlatma şablonları)
/// tenant bazlı saklanır. localStorage yerine kalıcı backend kaynağı.
///
/// PlatformConfigurations:
///   ConfigurationType = "overdue-rules"
///   ScopeKey          = "default" (tenant başına tek satır; TenantId zaten scope sağlar)
///   PayloadJson       = { rules: [...] }
/// </summary>
[ApiController]
[Authorize]
[Route("api/overdue-rules")]
public sealed class OverdueRulesController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string ConfigurationType = "overdue-rules";
    private const string ScopeKey = "default";

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (tenantId is null) return Unauthorized();

        var entity = await dbContext.PlatformConfigurations
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId.Value
                && item.ConfigurationType == ConfigurationType
                && item.ScopeKey == ScopeKey, cancellationToken);

        if (entity is null)
        {
            return Ok(new { rules = Array.Empty<object>() });
        }

        try
        {
            var doc = JsonDocument.Parse(entity.PayloadJson);
            return Ok(doc.RootElement);
        }
        catch
        {
            return Ok(new { rules = Array.Empty<object>() });
        }
    }

    [HttpPut]
    [Authorize(Roles = "Admin,Administrative,Finance")]
    public async Task<IActionResult> Put([FromBody] JsonElement payload, CancellationToken cancellationToken)
    {
        var tenantId = ResolveTenantId();
        if (tenantId is null) return Unauthorized();

        var json = payload.ValueKind == JsonValueKind.Undefined
            ? "{\"rules\":[]}"
            : payload.GetRawText();

        var entity = await dbContext.PlatformConfigurations
            .FirstOrDefaultAsync(item => item.TenantId == tenantId.Value
                && item.ConfigurationType == ConfigurationType
                && item.ScopeKey == ScopeKey, cancellationToken);

        if (entity is null)
        {
            entity = new PlatformConfiguration
            {
                TenantId = tenantId.Value,
                ConfigurationType = ConfigurationType,
                ScopeKey = ScopeKey,
                DisplayName = "OVERDUE_RULES",
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
            return Ok(doc.RootElement);
        }
        catch
        {
            return Ok(new { rules = Array.Empty<object>() });
        }
    }

    private Guid? ResolveTenantId()
    {
        var tenantIdClaim = User.FindFirstValue("tenant_id");
        return Guid.TryParse(tenantIdClaim, out var tenantId) ? tenantId : null;
    }
}
