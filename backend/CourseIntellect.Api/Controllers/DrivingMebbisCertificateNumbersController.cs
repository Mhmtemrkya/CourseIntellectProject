using System.Text.Json;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/driving-school/mebbis/certificate-numbers")]
public sealed class DrivingMebbisCertificateNumbersController(CourseIntellectDbContext db) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.MebbisView, DrivingPermissions.GraduationView)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var groups = await db.DrivingStudentGroups.AsNoTracking().OrderByDescending(x => x.TermYear).ThenByDescending(x => x.TermNumber)
            .Select(x => new { x.Id, x.Name, x.TermYear, x.TermNumber, x.IsActive }).ToListAsync(ct);
        var imports = await db.DrivingMebbisImportSessions.AsNoTracking().Where(x => x.ImportType == DrivingMebbisImportType.CertificateNumbers)
            .OrderByDescending(x => x.CreatedAtUtc).Take(100)
            .Select(x => new { x.Id, x.StudentGroupId, x.FileName, status = x.Status.ToString(), x.TotalRows, x.ChangeRows, x.NotFoundRows, x.ConflictRows, x.InvalidRows, x.PreviewVersion, x.ApplySummaryJson, x.CreatedByName, x.CreatedAtUtc, x.AppliedAtUtc })
            .ToListAsync(ct);
        return Ok(new { groups, imports, acceptedColumns = new[] { "TC Kimlik No", "Kursiyer No", "Sertifika No" }, maxFileBytes = 5 * 1024 * 1024 });
    }

    [HttpGet("{sessionId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView, DrivingPermissions.GraduationView)]
    public async Task<IActionResult> Detail(Guid sessionId, [FromQuery] int page = 1, [FromQuery] int pageSize = 500, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var session = await db.DrivingMebbisImportSessions.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == sessionId && x.ImportType == DrivingMebbisImportType.CertificateNumbers, ct);
        if (session is null) return NotFound(new { message = "Sertifika numarası aktarımı bulunamadı." });

        var importRows = await db.DrivingMebbisImportRows.AsNoTracking().Where(x => x.ImportSessionId == sessionId).OrderBy(x => x.RowNumber).ToListAsync(ct);
        var profileIds = importRows.Where(x => x.MatchedStudentProfileId.HasValue).Select(x => x.MatchedStudentProfileId!.Value).Distinct().ToList();
        var profiles = await db.StudentDrivingProfiles.AsNoTracking().Where(x => profileIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var studentIds = profiles.Values.Select(x => x.StudentId).Distinct().ToList();
        var names = await db.Students.AsNoTracking().Where(x => studentIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var certificateIds = importRows.Where(x => x.MatchedEntityId.HasValue).Select(x => x.MatchedEntityId!.Value).Distinct().ToList();
        var certificates = await db.DrivingCertificates.AsNoTracking().Where(x => certificateIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);

        var analyses = importRows.Select(row => Analyze(row, profiles, names, certificates)).ToList();
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 500);
        return Ok(new
        {
            session = new { session.Id, status = session.Status.ToString(), session.StudentGroupId, session.FileName, session.PreviewVersion, session.TotalRows, session.ChangeRows, session.NotFoundRows, session.ConflictRows, session.InvalidRows, session.ApplySummaryJson, session.CreatedByName, session.CreatedAtUtc, session.AppliedAtUtc },
            summary = new
            {
                total = analyses.Count,
                matched = analyses.Count(x => x.Matched),
                toUpdate = analyses.Count(x => x.Classification == nameof(DrivingMebbisImportRowClass.Change)),
                unchanged = analyses.Count(x => x.Classification == nameof(DrivingMebbisImportRowClass.Unchanged)),
                duplicates = analyses.Count(x => x.Duplicate),
                missingPeople = analyses.Count(x => !x.Matched),
                missingCertificates = analyses.Count(x => x.Matched && !x.CertificateFound),
                invalid = analyses.Count(x => x.Classification == nameof(DrivingMebbisImportRowClass.Invalid)),
            },
            rows = analyses.Skip((page - 1) * pageSize).Take(pageSize), page, pageSize, total = analyses.Count,
        });
    }

    private static CertificateAnalysis Analyze(DrivingMebbisImportRow row, IReadOnlyDictionary<Guid, StudentDrivingProfile> profiles,
        IReadOnlyDictionary<Guid, string> names, IReadOnlyDictionary<Guid, DrivingCertificate> certificates)
    {
        var source = JsonSerializer.Deserialize<Dictionary<string, string>>(row.SourceJson, JsonOptions) ?? [];
        var messages = JsonSerializer.Deserialize<List<string>>(row.MessagesJson, JsonOptions) ?? [];
        profiles.TryGetValue(row.MatchedStudentProfileId ?? Guid.Empty, out var profile);
        certificates.TryGetValue(row.MatchedEntityId ?? Guid.Empty, out var certificate);
        var duplicate = messages.Any(x => x.Contains("birden fazla", StringComparison.OrdinalIgnoreCase) || x.Contains("başka bir", StringComparison.OrdinalIgnoreCase));
        return new CertificateAnalysis(row.Id, row.RowNumber, row.Classification.ToString(), Mask(row.MatchKey),
            profile is null ? Get(source, "studentNumber") : profile.StudentNumber.ToString(),
            profile is null ? Get(source, "fullName") : names.GetValueOrDefault(profile.StudentId) ?? Get(source, "fullName"),
            profile is not null, certificate is not null, certificate?.DocumentNumber, certificate?.MebbisCertificateNo ?? string.Empty,
            Get(source, "certificateNo"), duplicate, messages, row.SelectedForApply && row.Classification == DrivingMebbisImportRowClass.Change);
    }

    private static string Get(IReadOnlyDictionary<string, string> values, string key) => values.GetValueOrDefault(key)?.Trim() ?? "";
    private static string Mask(string value)
    {
        if (value.StartsWith("SN:", StringComparison.Ordinal)) return value.Length <= 7 ? "SN:***" : $"SN:***{value[^3..]}";
        var digits = new string(value.Where(char.IsDigit).ToArray());
        return digits.Length <= 4 ? "****" : $"{digits[..2]}*****{digits[^2..]}";
    }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (db.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record CertificateAnalysis(Guid RowId, int RowNumber, string Classification, string MaskedMatchKey,
        string StudentNumber, string Name, bool Matched, bool CertificateFound, string? DocumentNumber,
        string CurrentMebbisNumber, string IncomingMebbisNumber, bool Duplicate, IReadOnlyList<string> Messages, bool CanApply);
}
