using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using SixLabors.ImageSharp;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class PlatformConfigurationsController(
    IPlatformConfigurationService platformConfigurationService,
    IFileStorageService fileStorageService,
    ITenantContext tenantContext,
    ILogger<PlatformConfigurationsController> logger) : ControllerBase
{
    private const long MaxLogoBytes = 2L * 1024 * 1024;
    private const long MaxLogoRequestBytes = MaxLogoBytes + 64 * 1024;
    private const int MaxLogoEdgePixels = 4096;
    private const long MaxLogoPixels = 16_000_000;

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
        if (IsTenantCustomization(request.ConfigurationType)
            && Guid.TryParse(request.ScopeKey, out var requestedTenantId)
            && !CanManageOtherTenants()
            && tenantContext.CurrentTenantId != requestedTenantId)
        {
            return Forbid();
        }

        var item = await platformConfigurationService.UpsertAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("branding")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SaveBranding([FromBody] TenantBrandingUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!CanManageOwnTenantBranding() || tenantContext.CurrentTenantId is not Guid tenantId)
        {
            return Forbid();
        }

        var logoUrl = request.LogoUrl?.Trim() ?? string.Empty;
        if (logoUrl.Length > 700 || (logoUrl.Length > 0 && !IsOwnedLogoUrl(tenantId, logoUrl)))
        {
            return BadRequest(new { message = "Logo önce güvenli kurum logosu yükleme alanından yüklenmelidir." });
        }

        var item = await SaveLogoUrlAsync(tenantId, logoUrl, cancellationToken);
        return Ok(item);
    }

    [HttpPost("branding/logo")]
    [Authorize(Roles = "Admin")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxLogoRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxLogoRequestBytes)]
    public async Task<IActionResult> UploadLogo([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (!CanManageOwnTenantBranding() || tenantContext.CurrentTenantId is not Guid tenantId)
        {
            return Forbid();
        }

        if (file is null || file.Length <= 0)
        {
            return BadRequest(new { message = "Logo dosyası zorunludur." });
        }

        if (file.Length > MaxLogoBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new { message = "Logo en fazla 2 MB olabilir." });
        }

        byte[] bytes;
        await using (var source = file.OpenReadStream())
        await using (var buffer = new MemoryStream((int)file.Length))
        {
            await source.CopyToAsync(buffer, cancellationToken);
            bytes = buffer.ToArray();
        }

        if (!TryDetectSafeImage(bytes, out var extension, out var contentType))
        {
            return BadRequest(new { message = "Yalnızca gerçek PNG, JPEG veya WebP görselleri kabul edilir." });
        }

        ImageInfo? imageInfo;
        try
        {
            imageInfo = Image.Identify(bytes);
        }
        catch
        {
            imageInfo = null;
        }

        if (imageInfo is null
            || imageInfo.Width < 16
            || imageInfo.Height < 16
            || imageInfo.Width > MaxLogoEdgePixels
            || imageInfo.Height > MaxLogoEdgePixels
            || (long)imageInfo.Width * imageInfo.Height > MaxLogoPixels)
        {
            return BadRequest(new { message = "Logo boyutları geçersiz. En fazla 4096×4096 piksel kullanabilirsiniz." });
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        await using var logoStream = new MemoryStream(bytes, writable: false);
        var asset = await fileStorageService.SaveAsync(
            logoStream,
            $"kurum-logo{extension}",
            contentType,
            $"tenant-branding/{tenantId:N}",
            baseUrl,
            cancellationToken);

        await SaveLogoUrlAsync(tenantId, asset.FileUrl, cancellationToken);
        return Ok(new
        {
            logoUrl = asset.FileUrl,
            width = imageInfo.Width,
            height = imageInfo.Height,
            size = asset.Size,
        });
    }

    [HttpDelete("branding/logo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveLogo(CancellationToken cancellationToken)
    {
        if (!CanManageOwnTenantBranding() || tenantContext.CurrentTenantId is not Guid tenantId)
        {
            return Forbid();
        }

        await SaveLogoUrlAsync(tenantId, string.Empty, cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding([FromQuery] Guid? tenantId, CancellationToken cancellationToken)
    {
        if (!tenantId.HasValue)
        {
            tenantId = tenantContext.CurrentTenantId;
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
                    primaryColor = "#030F24",
                    accentColor = "#0B2841",
                    logoUrl = (string?)null,
                    appName = "SchoolAsist"
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

    private async Task<object> SaveLogoUrlAsync(Guid tenantId, string logoUrl, CancellationToken cancellationToken)
    {
        var items = await platformConfigurationService.GetAsync("tenant-customization", cancellationToken);
        var current = items
            .Where(item => string.Equals(item.ScopeKey, tenantId.ToString(), StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(item => item.UpdatedAtUtc)
            .FirstOrDefault();

        JsonObject payload;
        try
        {
            payload = JsonNode.Parse(current?.PayloadJson ?? "{}") as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            payload = new JsonObject();
        }

        payload["logoUrl"] = logoUrl;
        return await platformConfigurationService.UpsertAsync(
            new UpsertPlatformConfigurationRequest(
                "tenant-customization",
                tenantId.ToString(),
                $"SA_TENANT_CUSTOMIZATION::{tenantId}",
                payload.ToJsonString()),
            cancellationToken);
    }

    private bool CanManageOwnTenantBranding() =>
        !User.IsInRole("BranchManager")
        && (User.IsInRole("Admin") || CanManageOtherTenants());

    private bool CanManageOtherTenants() =>
        User.IsInRole("Developer")
        || string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase);

    private static bool IsTenantCustomization(string? configurationType) =>
        string.Equals(configurationType, "tenant-customization", StringComparison.OrdinalIgnoreCase);

    private static bool IsOwnedLogoUrl(Guid tenantId, string logoUrl) =>
        logoUrl.StartsWith($"/uploads/tenant-branding/{tenantId:N}/", StringComparison.OrdinalIgnoreCase);

    private static bool TryDetectSafeImage(byte[] bytes, out string extension, out string contentType)
    {
        extension = string.Empty;
        contentType = string.Empty;

        if (bytes.Length >= 8
            && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
            && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A)
        {
            extension = ".png";
            contentType = "image/png";
            return true;
        }

        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
        {
            extension = ".jpg";
            contentType = "image/jpeg";
            return true;
        }

        if (bytes.Length >= 12
            && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
        {
            extension = ".webp";
            contentType = "image/webp";
            return true;
        }

        return false;
    }
}

public sealed record TenantBrandingUpdateRequest(string? LogoUrl);
