using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    /// <summary>
    /// Branding kaydet — Admin rolü gerektirir.
    /// PUT /api/platformconfigurations/branding
    /// </summary>
    [HttpPut("branding")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SaveBranding([FromBody] UpsertPlatformConfigurationRequest request, CancellationToken cancellationToken)
    {
        // ConfigurationType'ı zorla ayarla
        request = request with { ConfigurationType = "tenant-customization" };
        var item = await platformConfigurationService.UpsertAsync(request, cancellationToken);
        return Ok(item);
    }

    /// <summary>
    /// Herkes (login olmadan bile) tenant branding'ini alabilir.
    /// Giriş ekranında da doğru renklerin gösterilmesi için AllowAnonymous.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding(CancellationToken cancellationToken)
    {
        var items = await platformConfigurationService.GetAsync("tenant-customization", cancellationToken);
        // En son güncellenen kaydı döndür
        var branding = items
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefault();

        if (branding is null)
        {
            // Varsayılan branding
            return Ok(new
            {
                Id = Guid.Empty,
                ConfigurationType = "tenant-customization",
                ScopeKey = "global",
                DisplayName = "Varsayılan Branding",
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

        logger.LogInformation("Branding returned — ScopeKey={ScopeKey}, PayloadLength={Len}",
            branding.ScopeKey, branding.PayloadJson?.Length ?? 0);
        return Ok(branding);
    }
}
