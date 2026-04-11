using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class PlatformConfigurationsController(
    IPlatformConfigurationService platformConfigurationService,
    ILogger<PlatformConfigurationsController> logger) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Get([FromQuery] string? configurationType, CancellationToken cancellationToken)
    {
        var items = await platformConfigurationService.GetAsync(configurationType, cancellationToken);
        return Ok(items);
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upsert([FromBody] UpsertPlatformConfigurationRequest request, CancellationToken cancellationToken)
    {
        var item = await platformConfigurationService.UpsertAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("branding")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SaveBranding([FromBody] UpsertPlatformConfigurationRequest request, CancellationToken cancellationToken)
    {
        if (string.Equals(request.ScopeKey, "global", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Tenant branding global scope ile kaydedilemez." });
        }

        request = request with { ConfigurationType = "tenant-customization" };
        var item = await platformConfigurationService.UpsertAsync(request, cancellationToken);
        return Ok(item);
    }

    [AllowAnonymous]
    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding([FromQuery] Guid? tenantId, CancellationToken cancellationToken)
    {
        var tenantClaim = User.FindFirstValue("tenant_id");
        if (!tenantId.HasValue && Guid.TryParse(tenantClaim, out var claimTenantId))
        {
            tenantId = claimTenantId;
        }

        var items = await platformConfigurationService.GetAsync("tenant-customization", cancellationToken);
        var branding = tenantId.HasValue
            ? items
                .Where(x => string.Equals(x.ScopeKey, tenantId.Value.ToString(), StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(x => x.UpdatedAtUtc)
                .FirstOrDefault()
            : null;

        if (branding is null)
        {
            return Ok(new
            {
                Id = Guid.Empty,
                ConfigurationType = "tenant-customization",
                ScopeKey = "default",
                DisplayName = "Varsayilan Branding",
                PayloadJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    primaryColor = "#00354F",
                    accentColor = "#D9790B",
                    logoUrl = (string?)null,
                    appName = "CourseIntellect"
                }),
                UpdatedAtUtc = DateTime.UtcNow
            });
        }

        logger.LogInformation(
            "Branding returned for tenant scope {ScopeKey} with payload length {Length}",
            branding.ScopeKey,
            branding.PayloadJson?.Length ?? 0);

        return Ok(branding);
    }
}
