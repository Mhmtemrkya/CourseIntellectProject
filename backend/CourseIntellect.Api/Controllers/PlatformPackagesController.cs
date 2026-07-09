using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Paket bazlı özellik yetkileri (entitlements).
///
/// Platform yöneticisi her paket için rol → sayfa (modül) → sayfa içi işlem
/// (aksiyon) düzeyinde yetki tanımlar. Kurumun TenantWorkspace.Plan alanı hangi
/// pakete işaret ediyorsa, kurum istemcileri "my-entitlements" ucundan o paketin
/// tanımını okuyup menüleri ve sayfa içi butonları buna göre gizler.
///
/// Kayıtlar PlatformConfigurations içinde "platform-package" tipiyle, tenant'sız
/// (platform geneli) tutulur; ScopeKey paket kimliğidir, DisplayName paket adıdır
/// ve TenantWorkspace.Plan ile ad üzerinden eşleşir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/platform-packages")]
public sealed class PlatformPackagesController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string ConfigurationType = "platform-package";

    private bool HasTenantContext() => !string.IsNullOrWhiteSpace(User.FindFirstValue("tenant_id"));

    /// <summary>Platform yöneticisi: tüm paket yetki tanımlarını listeler.</summary>
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();

        var items = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == null && x.ConfigurationType == ConfigurationType)
            .OrderBy(x => x.DisplayName)
            .Select(x => new { x.Id, packageId = x.ScopeKey, name = x.DisplayName, payloadJson = x.PayloadJson, x.UpdatedAtUtc })
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    /// <summary>Platform yöneticisi: paket yetki tanımını oluşturur/günceller.</summary>
    [HttpPut("{packageId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upsert(
        string packageId,
        [FromBody] UpsertPlatformPackageRequest request,
        CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        if (string.IsNullOrWhiteSpace(packageId)) return BadRequest(new { message = "Paket kimliği zorunludur." });
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Paket adı zorunludur." });

        // Payload geçerli JSON olmalı; bozuk kayıt tüm kurum menülerini etkiler.
        JsonElement roles;
        try
        {
            roles = request.Roles.ValueKind == JsonValueKind.Undefined
                ? JsonDocument.Parse("{}").RootElement
                : request.Roles;
            if (roles.ValueKind != JsonValueKind.Object)
            {
                return BadRequest(new { message = "roles alanı nesne olmalıdır." });
            }
        }
        catch (JsonException)
        {
            return BadRequest(new { message = "roles alanı geçerli JSON değil." });
        }

        var entity = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                x => x.TenantId == null && x.ConfigurationType == ConfigurationType && x.ScopeKey == packageId,
                cancellationToken);

        if (entity is null)
        {
            entity = new PlatformConfiguration
            {
                TenantId = null,
                ConfigurationType = ConfigurationType,
                ScopeKey = packageId,
            };
            await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
        }

        entity.DisplayName = request.Name.Trim();
        entity.PayloadJson = JsonSerializer.Serialize(new { roles });
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { entity.Id, packageId = entity.ScopeKey, name = entity.DisplayName, payloadJson = entity.PayloadJson, entity.UpdatedAtUtc });
    }

    /// <summary>Platform yöneticisi: paket yetki tanımını siler.</summary>
    [HttpDelete("{packageId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(string packageId, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();

        var entity = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                x => x.TenantId == null && x.ConfigurationType == ConfigurationType && x.ScopeKey == packageId,
                cancellationToken);

        if (entity is null) return NotFound();

        dbContext.PlatformConfigurations.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Kurum istemcileri: oturum açan kullanıcının kurumuna atanmış paketin
    /// rol → modül → aksiyon yetkileri. Kurumun paketi yoksa veya pakete tanım
    /// girilmemişse kısıtsız (unrestricted) döner — kurum kilitlenmez.
    /// </summary>
    [HttpGet("my-entitlements")]
    public async Task<IActionResult> GetMyEntitlements(CancellationToken cancellationToken)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId)
        {
            return Ok(new { unrestricted = true });
        }

        var planName = await dbContext.TenantWorkspaces
            .AsNoTracking()
            .Where(x => x.Id == tenantId)
            .Select(x => x.Plan)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(planName))
        {
            return Ok(new { unrestricted = true });
        }

        var normalizedPlan = planName.Trim().ToLowerInvariant();
        var package = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == null && x.ConfigurationType == ConfigurationType)
            .Where(x => x.DisplayName.ToLower() == normalizedPlan || x.ScopeKey.ToLower() == normalizedPlan)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(package))
        {
            return Ok(new { unrestricted = true });
        }

        try
        {
            using var document = JsonDocument.Parse(package);
            if (document.RootElement.TryGetProperty("roles", out var roles) &&
                roles.ValueKind == JsonValueKind.Object &&
                roles.EnumerateObject().Any())
            {
                return Ok(new { unrestricted = false, roles = roles.Clone() });
            }
        }
        catch (JsonException)
        {
            // Bozuk paket kaydı kurumları kilitlemesin.
        }

        return Ok(new { unrestricted = true });
    }
}

public sealed record UpsertPlatformPackageRequest(string Name, JsonElement Roles);
