using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
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

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/driving-school/mebbis/reconciliations")]
public sealed class DrivingMebbisReconciliationsController(
    CourseIntellectDbContext db,
    IAuditLogService audit) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var groups = await db.DrivingStudentGroups.AsNoTracking().OrderByDescending(x => x.TermYear).ThenByDescending(x => x.TermNumber)
            .Select(x => new { x.Id, x.Name, x.TermYear, x.TermNumber, x.MebbisTermCode, x.IsActive }).ToListAsync(ct);
        var sources = await db.DrivingMebbisImportSessions.AsNoTracking()
            .Where(x => x.ImportType == DrivingMebbisImportType.CandidateList && x.StudentGroupId != null
                && (x.Status == DrivingMebbisImportStatus.PreviewReady || x.Status == DrivingMebbisImportStatus.Applied))
            .OrderByDescending(x => x.CreatedAtUtc).Take(200)
            .Select(x => new { x.Id, x.StudentGroupId, x.FileName, x.Sha256, status = x.Status.ToString(), x.TotalRows, x.CreatedAtUtc, x.CreatedByName }).ToListAsync(ct);
        var items = await db.DrivingMebbisReconciliations.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).Take(100)
            .Select(x => new { x.Id, x.StudentGroupId, status = x.Status.ToString(), x.TotalRows, x.MatchedRows, x.CourseOnlyRows, x.MebbisOnlyRows, x.DifferentRows, x.LicenseClassDifferenceRows, x.TermDifferenceRows, x.CertificateDifferenceRows, x.ExamResultDifferenceRows, x.StudentStatusDifferenceRows, x.CreatedByName, x.CreatedAtUtc }).ToListAsync(ct);
        return Ok(new { groups, sources, items });
    }

    [HttpGet("{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Detail(Guid id, [FromQuery] string? classification = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 200, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var run = await db.DrivingMebbisReconciliations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (run is null) return NotFound(new { message = "Mutabakat kaydı bulunamadı." });
        var query = db.DrivingMebbisReconciliationRows.AsNoTracking().Where(x => x.ReconciliationId == id);
        if (!string.IsNullOrWhiteSpace(classification))
        {
            if (!Enum.TryParse<DrivingMebbisReconciliationRowClass>(classification, true, out var parsed) || !Enum.IsDefined(parsed)) return BadRequest(new { message = "Mutabakat filtresi geçersiz." });
            query = query.Where(x => x.Classification == parsed);
        }
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 500);
        var filteredTotal = await query.CountAsync(ct);
        var rows = await query.OrderBy(x => x.Classification).ThenBy(x => x.DisplayName).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, classification = x.Classification.ToString(), x.MaskedIdentity, x.DisplayName, x.StudentDrivingProfileId, x.SourceRowNumber, x.DifferenceCodesJson, x.CourseSnapshotJson, x.MebbisSnapshotJson }).ToListAsync(ct);
        return Ok(new { reconciliation = new { run.Id, run.StudentGroupId, status = run.Status.ToString(), run.SourceSessionsJson, run.TotalRows, run.MatchedRows, run.CourseOnlyRows, run.MebbisOnlyRows, run.DifferentRows, run.LicenseClassDifferenceRows, run.TermDifferenceRows, run.CertificateDifferenceRows, run.ExamResultDifferenceRows, run.StudentStatusDifferenceRows, run.CreatedByName, run.CreatedAtUtc }, rows, filteredTotal, page, pageSize });
    }

    [HttpPost]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Create([FromBody] CreateMebbisReconciliationRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var userId = CurrentUserId(); if (userId is null) return Forbid();
        var group = await db.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.StudentGroupId, ct);
        if (group is null) return BadRequest(new { message = "Dönem bulunamadı." });

        var candidateSource = await db.DrivingMebbisImportSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.CandidateImportSessionId
            && x.StudentGroupId == request.StudentGroupId && x.ImportType == DrivingMebbisImportType.CandidateList
            && (x.Status == DrivingMebbisImportStatus.PreviewReady || x.Status == DrivingMebbisImportStatus.Applied), ct);
        if (candidateSource is null) return BadRequest(new { message = "Seçilen döneme ait geçerli MEBBİS aday listesi bulunamadı." });

        var supplemental = await db.DrivingMebbisImportSessions.AsNoTracking()
            .Where(x => x.StudentGroupId == request.StudentGroupId && x.Id != candidateSource.Id
                && (x.Status == DrivingMebbisImportStatus.PreviewReady || x.Status == DrivingMebbisImportStatus.Applied)
                && (x.ImportType == DrivingMebbisImportType.ExamResults || x.ImportType == DrivingMebbisImportType.CertificateNumbers || x.ImportType == DrivingMebbisImportType.StudentStatuses))
            .OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct);
        var sources = new[] { candidateSource }.Concat(supplemental.GroupBy(x => x.ImportType).Select(x => x.First())).ToList();
        var sourceIds = sources.Select(x => x.Id).ToList();
        var importRows = await db.DrivingMebbisImportRows.AsNoTracking().Where(x => sourceIds.Contains(x.ImportSessionId)).OrderBy(x => x.RowNumber).ToListAsync(ct);
        var sourceById = sources.ToDictionary(x => x.Id);

        var mebbis = new Dictionary<string, MebbisRecord>(StringComparer.Ordinal);
        foreach (var row in importRows.Where(x => x.ImportSessionId == candidateSource.Id))
        {
            var values = Values(row.SourceJson); var identity = Digits(Get(values, "identity"));
            var key = string.IsNullOrEmpty(identity) ? $"missing:{row.Id:N}" : identity;
            var record = new MebbisRecord(identity, row, values)
            {
                ExamProvided = !string.IsNullOrWhiteSpace(Get(values, "result")),
                CertificateProvided = !string.IsNullOrWhiteSpace(Get(values, "certificateNo")),
                StatusProvided = !string.IsNullOrWhiteSpace(Get(values, "status")),
            };
            if (!mebbis.TryAdd(key, record)) mebbis[key].Duplicate = true;
        }
        foreach (var row in importRows.Where(x => x.ImportSessionId != candidateSource.Id))
        {
            var values = Values(row.SourceJson); var identity = Digits(Get(values, "identity"));
            if (string.IsNullOrEmpty(identity) || !mebbis.TryGetValue(identity, out var target)) continue;
            var type = sourceById[row.ImportSessionId].ImportType;
            if (type == DrivingMebbisImportType.ExamResults) { target.ExamProvided = true; target.Values["result"] = Get(values, "result"); }
            else if (type == DrivingMebbisImportType.CertificateNumbers) { target.CertificateProvided = true; target.Values["certificateNo"] = Get(values, "certificateNo"); }
            else if (type == DrivingMebbisImportType.StudentStatuses) { target.StatusProvided = true; target.Values["status"] = Get(values, "status"); }
        }

        var profiles = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentGroupId == request.StudentGroupId)
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new CourseRecord(p, s.TcNo, s.FullName)).ToListAsync(ct);
        var profileIds = profiles.Select(x => x.Profile.Id).ToList();
        var exams = (await db.DrivingExamCandidates.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId)).OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)).GroupBy(x => x.StudentDrivingProfileId).ToDictionary(x => x.Key, x => x.First());
        var certificates = (await db.DrivingCertificates.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.Status == DrivingCertificateStatus.Active).OrderByDescending(x => x.IssuedAtUtc).ToListAsync(ct)).GroupBy(x => x.StudentDrivingProfileId).ToDictionary(x => x.Key, x => x.First());
        var courseByIdentity = profiles.GroupBy(x => Digits(string.IsNullOrWhiteSpace(x.TcNo) ? x.Profile.IdentityNumber : x.TcNo)).ToDictionary(x => x.Key, x => x.ToList());

        var resultRows = new List<DrivingMebbisReconciliationRow>();
        foreach (var pair in courseByIdentity)
        {
            if (string.IsNullOrEmpty(pair.Key) || !mebbis.TryGetValue(pair.Key, out var external))
            {
                foreach (var course in pair.Value) resultRows.Add(BuildCourseOnly(course, pair.Key));
                continue;
            }
            external.Consumed = true;
            if (pair.Value.Count != 1 || external.Duplicate)
            {
                resultRows.Add(BuildDifferent(pair.Value[0], external, group, exams, certificates, ["DuplicateIdentity"]));
                continue;
            }
            resultRows.Add(BuildCompared(pair.Value[0], external, group, exams, certificates));
        }
        foreach (var external in mebbis.Values.Where(x => !x.Consumed)) resultRows.Add(BuildMebbisOnly(external));

        var run = new DrivingMebbisReconciliation
        {
            StudentGroupId = group.Id, TotalRows = resultRows.Count,
            MatchedRows = resultRows.Count(x => x.Classification == DrivingMebbisReconciliationRowClass.Matched),
            CourseOnlyRows = resultRows.Count(x => x.Classification == DrivingMebbisReconciliationRowClass.CourseOnly),
            MebbisOnlyRows = resultRows.Count(x => x.Classification == DrivingMebbisReconciliationRowClass.MebbisOnly),
            DifferentRows = resultRows.Count(x => x.Classification == DrivingMebbisReconciliationRowClass.Different),
            LicenseClassDifferenceRows = CountCode(resultRows, "LicenseClass"), TermDifferenceRows = CountCode(resultRows, "Term"),
            CertificateDifferenceRows = CountCode(resultRows, "CertificateNo"), ExamResultDifferenceRows = CountCode(resultRows, "ExamResult"), StudentStatusDifferenceRows = CountCode(resultRows, "StudentStatus"),
            SourceSessionsJson = JsonSerializer.Serialize(sources.Select(x => new { x.Id, type = x.ImportType.ToString(), x.FileName, x.Sha256, x.CreatedAtUtc }), JsonOptions),
            CreatedByUserId = userId.Value, CreatedByName = CurrentUserName(),
        };
        foreach (var row in resultRows) row.ReconciliationId = run.Id;
        db.DrivingMebbisReconciliations.Add(run); db.DrivingMebbisReconciliationRows.AddRange(resultRows); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS mutabakatı oluşturuldu", "DrivingSchool", nameof(DrivingMebbisReconciliation), run.Id.ToString(), $"{group.Name}: {run.TotalRows} kayıt, {run.DifferentRows} farklı, {run.CourseOnlyRows} yalnız CourseIntellect, {run.MebbisOnlyRows} yalnız MEBBİS.", null, new { run.StudentGroupId, run.TotalRows, run.MatchedRows, run.CourseOnlyRows, run.MebbisOnlyRows, run.DifferentRows, sourceIds }, ct);
        return Ok(new { run.Id, run.TotalRows, run.MatchedRows, run.CourseOnlyRows, run.MebbisOnlyRows, run.DifferentRows });
    }

    private static DrivingMebbisReconciliationRow BuildCompared(CourseRecord c, MebbisRecord m, DrivingStudentGroup group, IReadOnlyDictionary<Guid, DrivingExamCandidate> exams, IReadOnlyDictionary<Guid, DrivingCertificate> certificates)
    {
        var codes = new List<string>(); var p = c.Profile; exams.TryGetValue(p.Id, out var exam); certificates.TryGetValue(p.Id, out var certificate);
        Compare(codes, "GeneralInfo", c.FullName, Get(m.Values, "fullName")); Compare(codes, "GeneralInfo", p.Phone, Get(m.Values, "phone"), digits: true);
        Compare(codes, "GeneralInfo", p.MotherName, Get(m.Values, "motherName")); Compare(codes, "GeneralInfo", p.FatherName, Get(m.Values, "fatherName")); Compare(codes, "GeneralInfo", p.BirthPlace, Get(m.Values, "birthPlace")); Compare(codes, "GeneralInfo", p.EducationLevel, Get(m.Values, "education")); Compare(codes, "GeneralInfo", p.IdentitySerialNo, Get(m.Values, "serialNo"));
        Compare(codes, "LicenseClass", p.LicenseClass, Get(m.Values, "licenseClass"));
        var termProvided = !string.IsNullOrWhiteSpace(Get(m.Values, "termYear")) || !string.IsNullOrWhiteSpace(Get(m.Values, "termNumber")) || !string.IsNullOrWhiteSpace(Get(m.Values, "termCode"));
        if (termProvided && (!Same(Convert.ToString(group.TermYear, CultureInfo.InvariantCulture), Get(m.Values, "termYear")) || !Same(Convert.ToString(group.TermNumber, CultureInfo.InvariantCulture), Get(m.Values, "termNumber")) || (!string.IsNullOrWhiteSpace(Get(m.Values, "termCode")) && !Same(group.MebbisTermCode, Get(m.Values, "termCode"))))) Add(codes, "Term");
        if (m.CertificateProvided && !Same(certificate?.MebbisCertificateNo, Get(m.Values, "certificateNo"))) Add(codes, "CertificateNo");
        if (m.ExamProvided && !SameExam(exam?.Status, Get(m.Values, "result"))) Add(codes, "ExamResult");
        if (m.StatusProvided && !SameStatus(p.Status, Get(m.Values, "status"))) Add(codes, "StudentStatus");
        return BuildRow(c, m, codes, group, exam, certificate);
    }

    private static DrivingMebbisReconciliationRow BuildDifferent(CourseRecord c, MebbisRecord m, DrivingStudentGroup group, IReadOnlyDictionary<Guid, DrivingExamCandidate> exams, IReadOnlyDictionary<Guid, DrivingCertificate> certificates, IEnumerable<string> initial)
    { var row = BuildCompared(c, m, group, exams, certificates); var codes = initial.Concat(JsonSerializer.Deserialize<List<string>>(row.DifferenceCodesJson, JsonOptions) ?? []).Distinct().ToList(); row.Classification = DrivingMebbisReconciliationRowClass.Different; row.DifferenceCodesJson = JsonSerializer.Serialize(codes, JsonOptions); return row; }

    private static DrivingMebbisReconciliationRow BuildRow(CourseRecord c, MebbisRecord m, List<string> codes, DrivingStudentGroup group, DrivingExamCandidate? exam, DrivingCertificate? certificate) => new()
    {
        Classification = codes.Count == 0 ? DrivingMebbisReconciliationRowClass.Matched : DrivingMebbisReconciliationRowClass.Different,
        MaskedIdentity = Mask(m.Identity), DisplayName = string.IsNullOrWhiteSpace(c.FullName) ? Get(m.Values, "fullName") : c.FullName,
        StudentDrivingProfileId = c.Profile.Id, SourceImportRowId = m.Row.Id, SourceRowNumber = m.Row.RowNumber,
        DifferenceCodesJson = JsonSerializer.Serialize(codes, JsonOptions),
        CourseSnapshotJson = JsonSerializer.Serialize(new { fullName = c.FullName, phone = c.Profile.Phone, c.Profile.MotherName, c.Profile.FatherName, c.Profile.BirthPlace, education = c.Profile.EducationLevel, serialNo = c.Profile.IdentitySerialNo, c.Profile.LicenseClass, termYear = group.TermYear, termNumber = group.TermNumber, termCode = group.MebbisTermCode, certificateNo = certificate?.MebbisCertificateNo ?? "", examResult = exam?.Status.ToString() ?? "", studentStatus = c.Profile.Status.ToString() }, JsonOptions),
        MebbisSnapshotJson = JsonSerializer.Serialize(PublicMebbis(m.Values), JsonOptions),
    };

    private static DrivingMebbisReconciliationRow BuildCourseOnly(CourseRecord c, string identity) => new() { Classification = DrivingMebbisReconciliationRowClass.CourseOnly, MaskedIdentity = Mask(identity), DisplayName = c.FullName, StudentDrivingProfileId = c.Profile.Id, DifferenceCodesJson = "[\"MissingInMebbis\"]", CourseSnapshotJson = JsonSerializer.Serialize(new { fullName = c.FullName, phone = c.Profile.Phone, c.Profile.LicenseClass, studentStatus = c.Profile.Status.ToString() }, JsonOptions) };
    private static DrivingMebbisReconciliationRow BuildMebbisOnly(MebbisRecord m) => new() { Classification = DrivingMebbisReconciliationRowClass.MebbisOnly, MaskedIdentity = Mask(m.Identity), DisplayName = Get(m.Values, "fullName"), SourceImportRowId = m.Row.Id, SourceRowNumber = m.Row.RowNumber, DifferenceCodesJson = JsonSerializer.Serialize(new[] { string.IsNullOrEmpty(m.Identity) ? "MissingIdentity" : "MissingInCourseIntellect" }, JsonOptions), MebbisSnapshotJson = JsonSerializer.Serialize(PublicMebbis(m.Values), JsonOptions) };

    private static object PublicMebbis(Dictionary<string, string> v) => new { fullName = Get(v, "fullName"), phone = Get(v, "phone"), motherName = Get(v, "motherName"), fatherName = Get(v, "fatherName"), birthPlace = Get(v, "birthPlace"), education = Get(v, "education"), serialNo = Get(v, "serialNo"), licenseClass = Get(v, "licenseClass"), termYear = Get(v, "termYear"), termNumber = Get(v, "termNumber"), termCode = Get(v, "termCode"), certificateNo = Get(v, "certificateNo"), examResult = Get(v, "result"), studentStatus = Get(v, "status") };
    private static Dictionary<string, string> Values(string json) => JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOptions) ?? new(StringComparer.OrdinalIgnoreCase);
    private static string Get(IReadOnlyDictionary<string, string> v, string key) => v.GetValueOrDefault(key)?.Trim() ?? "";
    private static string Digits(string value) => DrivingMebbisReconciliationRules.Digits(value);
    private static string Mask(string value) => string.IsNullOrEmpty(value) ? "Kimlik yok" : value.Length <= 4 ? "****" : $"{value[..2]}*****{value[^2..]}";
    private static void Compare(List<string> codes, string code, string? local, string external, bool digits = false) { if (string.IsNullOrWhiteSpace(external)) return; if (!(digits ? DrivingMebbisReconciliationRules.SamePhone(local, external) : Same(local, external))) Add(codes, code); }
    private static bool Same(string? a, string? b) => DrivingMebbisReconciliationRules.SameText(a, b);
    private static void Add(List<string> codes, string code) { if (!codes.Contains(code)) codes.Add(code); }
    private static bool SameExam(DrivingExamCandidateStatus? local, string external) => DrivingMebbisReconciliationRules.SameExamResult(local, external);
    private static bool SameStatus(DrivingStudentStatus local, string external) => DrivingMebbisReconciliationRules.SameStudentStatus(local, external);
    private static int CountCode(IEnumerable<DrivingMebbisReconciliationRow> rows, string code) => rows.Count(x => (JsonSerializer.Deserialize<List<string>>(x.DifferenceCodesJson, JsonOptions) ?? []).Contains(code));
    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private string CurrentUserName() { var value = (User.FindFirstValue("name") ?? User.Identity?.Name ?? "Sistem").Trim(); return string.IsNullOrEmpty(value) ? "Sistem" : value[..Math.Min(150, value.Length)]; }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }

    private sealed record CourseRecord(StudentDrivingProfile Profile, string TcNo, string FullName);
    private sealed class MebbisRecord(string identity, DrivingMebbisImportRow row, Dictionary<string, string> values) { public string Identity { get; } = identity; public DrivingMebbisImportRow Row { get; } = row; public Dictionary<string, string> Values { get; } = values; public bool Duplicate { get; set; } public bool Consumed { get; set; } public bool ExamProvided { get; set; } public bool CertificateProvided { get; set; } public bool StatusProvided { get; set; } }
}

public sealed record CreateMebbisReconciliationRequest(Guid StudentGroupId, Guid CandidateImportSessionId);
