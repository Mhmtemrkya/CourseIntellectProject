using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace CourseIntellect.Api.Controllers;

[ApiController, Authorize]
[Route("api/driving-school/mebbis/errors")]
public sealed class DrivingMebbisErrorLibraryController(
    CourseIntellectDbContext db, IAuditLogService audit) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpPost("sync-defaults")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> SyncDefaults(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct) || CurrentUserId() is not Guid userId) return Forbid();
        var created = await EnsureDefaultsAsync(userId, ct);
        await audit.LogChangeAsync("MEBBİS hata kütüphanesi eşitlendi", "DrivingSchool",
            nameof(DrivingMebbisErrorDefinition), "defaults", $"{created} varsayılan hata kartı eklendi.", null, new { created }, ct);
        return Ok(new { created });
    }

    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] string? severity,
        [FromQuery] bool includeArchived = false, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        NoStore();
        if ((search?.Length ?? 0) > 100) return BadRequest(new { message = "Arama en fazla 100 karakter olabilir." });
        DrivingMebbisErrorSeverity? parsedSeverity = null;
        if (!string.IsNullOrWhiteSpace(severity))
        {
            if (!Enum.TryParse<DrivingMebbisErrorSeverity>(severity, true, out var value) || !Enum.IsDefined(value))
                return BadRequest(new { message = "Önem derecesi geçersiz." });
            parsedSeverity = value;
        }

        var query = db.DrivingMebbisErrorDefinitions.AsNoTracking();
        if (!includeArchived) query = query.Where(x => x.IsActive);
        if (parsedSeverity.HasValue) query = query.Where(x => x.Severity == parsedSeverity);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Title.ToLower().Contains(term) || x.Code.ToLower().Contains(term)
                || x.Description.ToLower().Contains(term) || x.PossibleCause.ToLower().Contains(term));
        }
        var definitions = await query.OrderByDescending(x => x.Severity).ThenBy(x => x.Title).ToListAsync(ct);
        var ids = definitions.Select(x => x.Id).ToList();
        var stats = await db.DrivingMebbisErrorOccurrences.AsNoTracking().Where(x => ids.Contains(x.ErrorDefinitionId))
            .GroupBy(x => x.ErrorDefinitionId).Select(x => new
            {
                Id = x.Key, Count = x.Count(), Unresolved = x.Count(y => y.ResolvedAtUtc == null), Last = x.Max(y => (DateTime?)y.OccurredAtUtc)
            }).ToDictionaryAsync(x => x.Id, ct);
        var items = definitions.Select(x =>
        {
            stats.TryGetValue(x.Id, out var stat);
            return ToDefinition(x, stat?.Count ?? 0, stat?.Unresolved ?? 0, stat?.Last);
        });
        return Ok(new
        {
            summary = new { total = definitions.Count, occurrences = stats.Values.Sum(x => x.Count), unresolved = stats.Values.Sum(x => x.Unresolved) },
            items
        });
    }

    [HttpGet("{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Detail(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        NoStore();
        if (page < 1 || pageSize is < 1 or > 100) return BadRequest(new { message = "Sayfalama değerleri geçersiz." });
        var definition = await db.DrivingMebbisErrorDefinitions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (definition is null) return NotFound(new { message = "Hata kartı bulunamadı." });
        var query = db.DrivingMebbisErrorOccurrences.AsNoTracking().Where(x => x.ErrorDefinitionId == id);
        var total = await query.CountAsync(ct);
        var unresolved = await query.CountAsync(x => x.ResolvedAtUtc == null, ct);
        var lastOccurredAtUtc = await query.MaxAsync(x => (DateTime?)x.OccurredAtUtc, ct);
        var occurrences = await query.OrderByDescending(x => x.OccurredAtUtc).Skip((page - 1) * pageSize).Take(pageSize)
            .GroupJoin(db.StudentDrivingProfiles.AsNoTracking(), x => x.StudentDrivingProfileId, p => p.Id, (x, ps) => new { x, ps })
            .SelectMany(z => z.ps.DefaultIfEmpty(), (z, p) => new { z.x, p })
            .GroupJoin(db.Students.AsNoTracking(), z => z.p == null ? (Guid?)null : z.p.StudentId, s => s.Id, (z, ss) => new { z, ss })
            .SelectMany(z => z.ss.DefaultIfEmpty(), (z, s) => new
            {
                z.z.x.Id, z.z.x.StudentDrivingProfileId, studentName = s == null ? null : s.FullName,
                studentNumber = z.z.p == null ? (int?)null : z.z.p.StudentNumber,
                z.z.x.SourceType, z.z.x.SourceId, z.z.x.Note, z.z.x.OccurredAtUtc,
                z.z.x.ReportedByName, z.z.x.ResolvedAtUtc, z.z.x.ResolutionNote, z.z.x.Version
            }).ToListAsync(ct);
        return Ok(new { definition = ToDefinition(definition, total, unresolved, lastOccurredAtUtc), occurrences, page, pageSize, total });
    }

    [HttpPost]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Create([FromBody] SaveErrorDefinitionRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct) || CurrentUserId() is not Guid userId) return Forbid();
        var validation = ValidateDefinition(request); if (validation is not null) return BadRequest(new { message = validation });
        var code = NormalizeCode(request.Code);
        var entity = new DrivingMebbisErrorDefinition
        {
            Code = code, Title = Clean(request.Title, 200), Description = Clean(request.Description, 1000),
            PossibleCause = Clean(request.PossibleCause, 1500), ResolutionStepsJson = SerializeSteps(request.ResolutionSteps),
            Severity = ParseSeverity(request.Severity)!.Value, CreatedByUserId = userId
        };
        db.Add(entity);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict(new { message = "Bu hata kodu kurum kütüphanesinde zaten bulunuyor." }); }
        await AuditAsync("MEBBİS hata kartı oluşturuldu", entity, null, ct);
        return CreatedAtAction(nameof(Detail), new { id = entity.Id }, ToDefinition(entity, 0, 0, null));
    }

    [HttpPut("{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveErrorDefinitionRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct) || CurrentUserId() is not Guid userId) return Forbid();
        var validation = ValidateDefinition(request); if (validation is not null) return BadRequest(new { message = validation });
        var entity = await db.DrivingMebbisErrorDefinitions.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound(new { message = "Hata kartı bulunamadı." });
        if (entity.Version != request.ExpectedVersion) return Conflict(new { message = "Kart başka bir kullanıcı tarafından değiştirildi. Listeyi yenileyin.", currentVersion = entity.Version });
        var before = new { entity.Title, entity.Description, entity.PossibleCause, entity.ResolutionStepsJson, entity.Severity, entity.IsActive, entity.Version };
        entity.Title = Clean(request.Title, 200); entity.Description = Clean(request.Description, 1000);
        entity.PossibleCause = Clean(request.PossibleCause, 1500); entity.ResolutionStepsJson = SerializeSteps(request.ResolutionSteps);
        entity.Severity = ParseSeverity(request.Severity)!.Value; entity.IsActive = request.IsActive;
        entity.UpdatedByUserId = userId; entity.UpdatedAtUtc = DateTime.UtcNow; entity.Version++;
        await db.SaveChangesAsync(ct); await AuditAsync("MEBBİS hata kartı güncellendi", entity, before, ct);
        return Ok(ToDefinition(entity, 0, 0, null));
    }

    [HttpPost("{id:guid}/occurrences")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Report(Guid id, [FromBody] ReportErrorOccurrenceRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct) || CurrentUserId() is not Guid userId) return Forbid();
        if ((request.Note?.Trim().Length ?? 0) is < 5 or > 1000) return BadRequest(new { message = "Olay notu 5-1000 karakter olmalıdır." });
        if (!await db.DrivingMebbisErrorDefinitions.AnyAsync(x => x.Id == id && x.IsActive, ct)) return NotFound(new { message = "Etkin hata kartı bulunamadı." });
        if (request.StudentDrivingProfileId.HasValue && !await db.StudentDrivingProfiles.AnyAsync(x => x.Id == request.StudentDrivingProfileId, ct))
            return BadRequest(new { message = "Kursiyer bulunamadı." });
        var occurrence = new DrivingMebbisErrorOccurrence
        {
            ErrorDefinitionId = id, StudentDrivingProfileId = request.StudentDrivingProfileId,
            SourceType = Clean(string.IsNullOrWhiteSpace(request.SourceType) ? "Manual" : request.SourceType, 80),
            SourceId = request.SourceId, Note = Clean(request.Note, 1000), ReportedByUserId = userId, ReportedByName = CurrentUserName()
        };
        db.Add(occurrence); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS hatası kaydedildi", "DrivingSchool", nameof(DrivingMebbisErrorOccurrence), occurrence.Id.ToString(),
            "Hata kütüphanesine yeni görülme kaydı eklendi.", null, new { occurrence.ErrorDefinitionId, occurrence.StudentDrivingProfileId, occurrence.SourceType }, ct);
        return Ok(new { occurrence.Id, occurrence.Version, occurrence.OccurredAtUtc });
    }

    [HttpPut("occurrences/{id:guid}/resolve")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveErrorOccurrenceRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct) || CurrentUserId() is not Guid userId) return Forbid();
        var note = Clean(request.ResolutionNote, 1000);
        if (note.Length < 5) return BadRequest(new { message = "Çözüm notu en az 5 karakter olmalıdır." });
        var entity = await db.DrivingMebbisErrorOccurrences.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound(new { message = "Hata olayı bulunamadı." });
        if (entity.Version != request.ExpectedVersion) return Conflict(new { message = "Olay başka bir kullanıcı tarafından değiştirildi.", currentVersion = entity.Version });
        if (entity.ResolvedAtUtc.HasValue) return Conflict(new { message = "Bu hata olayı daha önce çözüldü." });
        entity.ResolvedAtUtc = DateTime.UtcNow; entity.ResolvedByUserId = userId; entity.ResolutionNote = note; entity.Version++;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS hatası çözüldü", "DrivingSchool", nameof(DrivingMebbisErrorOccurrence), entity.Id.ToString(), note, null, new { entity.ResolvedAtUtc, entity.Version }, ct);
        return Ok(new { entity.Id, entity.ResolvedAtUtc, entity.Version });
    }

    private async Task<int> EnsureDefaultsAsync(Guid userId, CancellationToken ct)
    {
        var existing = await db.DrivingMebbisErrorDefinitions.Select(x => x.Code).ToListAsync(ct);
        var missing = DrivingMebbisErrorCatalog.Defaults.Where(x => !existing.Contains(x.Code)).ToList();
        foreach (var item in missing) db.Add(new DrivingMebbisErrorDefinition
        {
            Code = item.Code, Title = item.Title, Description = item.Description, PossibleCause = item.PossibleCause,
            ResolutionStepsJson = JsonSerializer.Serialize(item.ResolutionSteps, JsonOptions), Severity = item.Severity,
            IsSystem = true, CreatedByUserId = userId
        });
        if (missing.Count > 0) await db.SaveChangesAsync(ct);
        return missing.Count;
    }

    private static object ToDefinition(DrivingMebbisErrorDefinition x, int count, int unresolved, DateTime? last) => new
    {
        x.Id, x.Code, x.Title, x.Description, x.PossibleCause,
        resolutionSteps = JsonSerializer.Deserialize<string[]>(x.ResolutionStepsJson, JsonOptions) ?? [],
        severity = x.Severity.ToString(), x.IsSystem, x.IsActive, x.Version, occurrenceCount = count, unresolvedCount = unresolved,
        lastOccurredAtUtc = last, x.CreatedAtUtc, x.UpdatedAtUtc
    };

    private static string? ValidateDefinition(SaveErrorDefinitionRequest r)
    {
        if (NormalizeCode(r.Code).Length is < 3 or > 80) return "Hata kodu 3-80 karakter olmalıdır.";
        if ((r.Title?.Trim().Length ?? 0) is < 3 or > 200) return "Başlık 3-200 karakter olmalıdır.";
        if ((r.Description?.Trim().Length ?? 0) is < 10 or > 1000) return "Açıklama 10-1000 karakter olmalıdır.";
        if ((r.PossibleCause?.Trim().Length ?? 0) is < 5 or > 1500) return "Olası neden 5-1500 karakter olmalıdır.";
        if (r.ResolutionSteps is null || r.ResolutionSteps.Count is < 1 or > 12 || r.ResolutionSteps.Any(x => x.Trim().Length is < 3 or > 300)) return "1-12 adet, 3-300 karakterlik çözüm adımı girin.";
        if (ParseSeverity(r.Severity) is null) return "Önem derecesi geçersiz.";
        return null;
    }
    private static DrivingMebbisErrorSeverity? ParseSeverity(string? value) => Enum.TryParse<DrivingMebbisErrorSeverity>(value, true, out var parsed) && Enum.IsDefined(parsed) ? parsed : null;
    private static string NormalizeCode(string? value) => Regex.Replace((value ?? "").Trim().ToUpperInvariant(), "[^A-Z0-9_]+", "_").Trim('_');
    private static string SerializeSteps(IReadOnlyList<string> steps) => JsonSerializer.Serialize(steps.Select(x => Clean(x, 300)).ToArray(), JsonOptions);
    private static string Clean(string? value, int max) { var result = Regex.Replace(new string((value ?? "").Where(x => !char.IsControl(x) || x is '\n' or '\t').ToArray()).Trim(), @"(?<!\d)\d{10,11}(?!\d)", "[kişisel veri gizlendi]"); return result.Length <= max ? result : result[..max]; }
    private async Task AuditAsync(string action, DrivingMebbisErrorDefinition entity, object? before, CancellationToken ct) => await audit.LogChangeAsync(action, "DrivingSchool", nameof(DrivingMebbisErrorDefinition), entity.Id.ToString(), entity.Title, before, new { entity.Code, entity.Title, entity.Severity, entity.IsActive, entity.Version }, ct);
    private void NoStore() => Response.Headers.CacheControl = "no-store, no-cache";
    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private string CurrentUserName() => Clean(User.FindFirstValue("name") ?? User.Identity?.Name ?? "Personel", 150);
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }
}

public sealed record SaveErrorDefinitionRequest(string Code, string Title, string Description, string PossibleCause,
    IReadOnlyList<string> ResolutionSteps, string Severity, bool IsActive = true, int ExpectedVersion = 0);
public sealed record ReportErrorOccurrenceRequest(Guid? StudentDrivingProfileId, string Note, string? SourceType = null, Guid? SourceId = null);
public sealed record ResolveErrorOccurrenceRequest(string ResolutionNote, int ExpectedVersion);
