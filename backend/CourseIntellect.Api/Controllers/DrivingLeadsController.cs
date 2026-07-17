using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Aday adayları (lead): arayan/soran kişilerin takibi. Kayda dönüşen lead
/// kursiyer dosyasına bağlanır; dönem kontenjan planlaması buradan beslenir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school/leads")]
public sealed class DrivingLeadsController(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";
    private static readonly HashSet<string> Statuses = new(StringComparer.OrdinalIgnoreCase) { "New", "Contacted", "Registered", "Lost" };

    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.LeadView)]
    public async Task<IActionResult> Get([FromQuery] string? status, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var query = dbContext.DrivingLeads.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Statuses.Contains(status))
            query = query.Where(x => x.Status == status);
        var rows = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(500)
            .Select(x => new
            {
                x.Id, x.FullName, x.Phone, x.LicenseClass, x.Source, x.Note, x.Status,
                x.ContactedAtUtc, x.ConvertedStudentProfileId, x.CreatedAtUtc,
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    [RequireDrivingPermission(DrivingPermissions.LeadManage)]
    public async Task<IActionResult> Create([FromBody] SaveDrivingLeadRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (Validate(request) is { } error) return BadRequest(new { message = error });

        var phone = NormalizePhone(request.Phone);
        // Aynı telefonla açık (dönüşmemiş/kaybedilmemiş) lead varsa mükerrer açılmaz.
        if (phone.Length >= 10)
        {
            var existing = await dbContext.DrivingLeads.AsNoTracking()
                .Where(x => x.Phone == phone && (x.Status == "New" || x.Status == "Contacted"))
                .Select(x => x.FullName)
                .FirstOrDefaultAsync(ct);
            if (existing is not null)
                return Conflict(new { message = $"Bu telefonla açık bir aday adayı zaten var: {existing}." });
        }

        var entity = new DrivingLead
        {
            FullName = request.FullName.Trim(),
            Phone = phone,
            LicenseClass = request.LicenseClass?.Trim().ToUpperInvariant() ?? "B",
            Source = request.Source?.Trim() ?? string.Empty,
            Note = request.Note?.Trim() ?? string.Empty,
            CreatedByUserId = CurrentUserId(),
        };
        dbContext.DrivingLeads.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Aday adayı eklendi", AuditCategory, nameof(DrivingLead), entity.Id.ToString(),
            $"{entity.FullName} ({entity.LicenseClass}) — kaynak: {(entity.Source.Length == 0 ? "—" : entity.Source)}.",
            null, new { entity.FullName, entity.Phone, entity.LicenseClass, entity.Source }, ct);
        return Ok(new { entity.Id, entity.FullName, entity.Phone, entity.LicenseClass, entity.Source, entity.Note, entity.Status, entity.CreatedAtUtc });
    }

    [HttpPut("{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.LeadManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDrivingLeadRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var lead = await dbContext.DrivingLeads.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (lead is null) return NotFound(new { message = "Aday adayı bulunamadı." });
        if (request.Status is { } status)
        {
            if (!Statuses.Contains(status)) return BadRequest(new { message = "Durum geçersiz." });
            // Kayda dönüştürme ayrı uçtan (LeadConvert) yapılır — burada yalnız süreç durumları.
            if (string.Equals(status, "Registered", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Kayda dönüştürme için dönüştürme ucunu kullanın." });
            var before = lead.Status;
            lead.Status = status;
            if (string.Equals(status, "Contacted", StringComparison.OrdinalIgnoreCase)) lead.ContactedAtUtc ??= DateTime.UtcNow;
            await auditLogService.LogChangeAsync("Aday adayı durumu değişti", AuditCategory, nameof(DrivingLead), lead.Id.ToString(),
                $"{lead.FullName}: {before} → {lead.Status}.", new { status = before }, new { lead.Status }, ct);
        }
        if (request.Note is not null) lead.Note = request.Note.Trim();
        await dbContext.SaveChangesAsync(ct);
        return Ok(new { lead.Id, lead.Status, lead.Note, lead.ContactedAtUtc });
    }

    /// <summary>
    /// Kayda dönüştürme işareti: sihirbaz tamamlanınca çağrılır, lead kursiyer
    /// dosyasına bağlanır ve süreçten düşer.
    /// </summary>
    [HttpPost("{id:guid}/convert")]
    [RequireDrivingPermission(DrivingPermissions.LeadConvert)]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertDrivingLeadRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var lead = await dbContext.DrivingLeads.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (lead is null) return NotFound(new { message = "Aday adayı bulunamadı." });
        if (lead.Status == "Registered") return Conflict(new { message = "Aday adayı zaten kayda dönüştürülmüş." });
        if (request.StudentDrivingProfileId is Guid profileId
            && !await dbContext.StudentDrivingProfiles.AsNoTracking().AnyAsync(x => x.Id == profileId, ct))
            return BadRequest(new { message = "Kursiyer dosyası bulunamadı." });

        lead.Status = "Registered";
        lead.ConvertedStudentProfileId = request.StudentDrivingProfileId;
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Aday adayı kayda dönüştü", AuditCategory, nameof(DrivingLead), lead.Id.ToString(),
            $"{lead.FullName} kursiyer oldu.", null, new { lead.ConvertedStudentProfileId }, ct);
        return Ok(new { lead.Id, lead.Status, lead.ConvertedStudentProfileId });
    }

    private static string? Validate(SaveDrivingLeadRequest request)
    {
        if ((request.FullName?.Trim().Length ?? 0) is < 3 or > 150) return "Ad soyad 3-150 karakter olmalıdır.";
        if ((request.Source?.Length ?? 0) > 80) return "Kaynak en fazla 80 karakter olabilir.";
        if ((request.Note?.Length ?? 0) > 1000) return "Not en fazla 1000 karakter olabilir.";
        return null;
    }

    private static string NormalizePhone(string? value)
        => new((value ?? string.Empty).Where(char.IsDigit).ToArray());

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null
            && tenant.InstitutionType == InstitutionType.DrivingSchool
            && tenant.DrivingSchoolModuleEnabled
            && string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record SaveDrivingLeadRequest(string FullName, string? Phone, string? LicenseClass, string? Source, string? Note);
public sealed record UpdateDrivingLeadRequest(string? Status, string? Note);
public sealed record ConvertDrivingLeadRequest(Guid? StudentDrivingProfileId);
