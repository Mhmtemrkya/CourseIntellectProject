using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kurum (tenant) bazlı özellik anahtarları.
/// Platform yöneticisi her kurum için modülleri aktif/pasif yönetir;
/// kurum istemcileri kendi bayraklarını "my" ucundan okuyup menü/ekranları gizler.
/// Kayıt PlatformConfigurations içinde "tenant-features" tipiyle tutulur.
/// </summary>
[ApiController]
[Authorize]
[Route("api/tenant-features")]
public sealed class TenantFeaturesController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string ConfigurationType = "tenant-features";
    private const string ScopeKey = "default";

    /// <summary>Yönetilebilir özellik kataloğu — istemci anahtarlarıyla birebir.</summary>
    public static readonly IReadOnlyList<TenantFeatureDefinition> Catalog =
    [
        new("attendance", "Devamsızlık / Yoklama", "Manuel ve QR yoklama, devamsızlık görünümleri"),
        new("exams", "Sınavlar", "Sınav oluşturma, sonuç girişi ve sınav görünümleri"),
        new("questionBank", "Soru Bankası", "Soru oluşturma, stüdyo ve öğrenci soru çözümü"),
        new("questionBox", "Soru Kutusu", "Öğrencinin öğretmene soru sorması"),
        new("studyPlan", "Çalışma Planı", "Görevler, hedefler, XP ve rozetler"),
        new("homework", "Ödevler", "Ödev verme ve teslim akışı"),
        new("liveLessons", "Canlı Dersler", "Canlı ders planlama ve katılım"),
        new("content", "İçerik Yönetimi", "Konu anlatımı ve içerik kütüphanesi"),
        new("messaging", "Mesajlaşma", "Roller arası mesajlaşma"),
        new("announcements", "Duyurular", "Kurumsal duyurular"),
        new("service", "Servis Takibi", "Araç, rota, şoför ve canlı konum"),
        new("cafeteria", "Yemekhane", "Haftalık menü yönetimi"),
        new("finance", "Finans / Muhasebe", "Tahsilat, fatura ve muhasebe modülleri"),
        new("reports", "Raporlar", "Analiz ve PDF raporları"),
        new("ai", "AI Asistan", "Yapay zeka destekli özellikler"),
        new("drivingSchool", "Sürücü Kursu", "Öğrenci, araç, öğretmen, randevu ve sürüş operasyonları"),
    ];

    private bool HasTenantContext() => !string.IsNullOrWhiteSpace(User.FindFirstValue("tenant_id"));

    /// <summary>Platform yöneticisi: bir kurumun bayraklarını okur.</summary>
    [HttpGet("tenants/{tenantId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetForTenant(Guid tenantId, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var flags = await LoadFlagsAsync(tenantId, cancellationToken);
        return Ok(BuildResponse(flags));
    }

    /// <summary>Platform yöneticisi: bir kurumun bayraklarını günceller.</summary>
    [HttpPut("tenants/{tenantId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateForTenant(
        Guid tenantId,
        [FromBody] UpdateTenantFeaturesRequest request,
        CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();

        var knownKeys = Catalog.Select(item => item.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var flags = (request.Features ?? new Dictionary<string, bool>())
            .Where(pair => knownKeys.Contains(pair.Key))
            .ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);

        var tenant = await dbContext.TenantWorkspaces
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
        if (tenant is null) return NotFound(new { message = "Kurum bulunamadı." });

        var drivingEnabled = flags.TryGetValue("drivingSchool", out var requestedDriving) && requestedDriving;
        if (drivingEnabled && tenant.InstitutionType != CourseIntellect.Domain.Enums.InstitutionType.DrivingSchool)
        {
            return BadRequest(new { message = "Sürücü kursu modülü yalnızca Sürücü Kursu türündeki kurumlarda açılabilir." });
        }
        tenant.DrivingSchoolModuleEnabled = drivingEnabled;

        var entity = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId && x.ConfigurationType == ConfigurationType && x.ScopeKey == ScopeKey,
                cancellationToken);

        if (entity is null)
        {
            entity = new PlatformConfiguration
            {
                TenantId = tenantId,
                ConfigurationType = ConfigurationType,
                ScopeKey = ScopeKey,
                DisplayName = "TENANT_FEATURES",
            };
            await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
        }

        entity.PayloadJson = JsonSerializer.Serialize(new { features = flags });
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(BuildResponse(flags));
    }

    /// <summary>
    /// Kurum istemcileri: oturum açan kullanıcının kurumuna ait bayraklar.
    /// Tenant bağlamı yoksa (platform yöneticisi) tüm özellikler açık döner.
    /// </summary>
    [HttpGet("my")]
    public async Task<IActionResult> GetMyFeatures(CancellationToken cancellationToken)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId)
        {
            return Ok(BuildResponse(new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)));
        }

        var flags = await LoadFlagsAsync(tenantId, cancellationToken);
        return Ok(BuildResponse(flags));
    }

    private async Task<Dictionary<string, bool>> LoadFlagsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var payload = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.ConfigurationType == ConfigurationType && x.ScopeKey == ScopeKey)
            .Select(x => x.PayloadJson)
            .FirstOrDefaultAsync(cancellationToken);

        var flags = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        var drivingEnabled = await dbContext.TenantWorkspaces
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.Id == tenantId)
            .Select(x => x.DrivingSchoolModuleEnabled)
            .SingleOrDefaultAsync(cancellationToken);
        flags["drivingSchool"] = drivingEnabled;
        if (string.IsNullOrWhiteSpace(payload))
        {
            return flags;
        }

        try
        {
            using var document = JsonDocument.Parse(payload);
            if (document.RootElement.TryGetProperty("features", out var features) &&
                features.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in features.EnumerateObject())
                {
                    if (property.Value.ValueKind is JsonValueKind.True or JsonValueKind.False)
                    {
                        flags[property.Name] = property.Value.GetBoolean();
                    }
                }
            }
        }
        catch (JsonException)
        {
            // Bozuk kayıt varsayılanlara düşer (tümü açık).
        }

        return flags;
    }

    /// <summary>Katalogla birleştirir: kayıt yoksa özellik AÇIK kabul edilir.</summary>
    private static object BuildResponse(IReadOnlyDictionary<string, bool> flags)
    {
        return new
        {
            features = Catalog.Select(item => new
            {
                key = item.Key,
                label = item.Label,
                description = item.Description,
                enabled = flags.TryGetValue(item.Key, out var enabled)
                    ? enabled
                    : !string.Equals(item.Key, "drivingSchool", StringComparison.OrdinalIgnoreCase),
            }).ToList(),
        };
    }
}

public sealed record TenantFeatureDefinition(string Key, string Label, string Description);

public sealed record UpdateTenantFeaturesRequest(Dictionary<string, bool>? Features);
