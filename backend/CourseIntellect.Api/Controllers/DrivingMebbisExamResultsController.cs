using System.Globalization;
using System.Text.Json;
using CourseIntellect.Api.Authorization;
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
[Route("api/driving-school/mebbis/exam-results")]
public sealed class DrivingMebbisExamResultsController(CourseIntellectDbContext db) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.ExamView, DrivingPermissions.MebbisView)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var groups = await db.DrivingStudentGroups.AsNoTracking().OrderByDescending(x => x.TermYear).ThenByDescending(x => x.TermNumber).Select(x => new { x.Id, x.Name, x.IsActive }).ToListAsync(ct);
        var imports = await db.DrivingMebbisImportSessions.AsNoTracking().Where(x => x.ImportType == DrivingMebbisImportType.ExamResults)
            .OrderByDescending(x => x.CreatedAtUtc).Take(100).Select(x => new { x.Id, x.StudentGroupId, x.FileName, status = x.Status.ToString(), x.TotalRows, x.ChangeRows, x.ConflictRows, x.InvalidRows, x.PreviewVersion, x.ApplySummaryJson, x.CreatedByName, x.CreatedAtUtc, x.AppliedAtUtc }).ToListAsync(ct);
        return Ok(new { groups, imports });
    }

    [HttpGet("{sessionId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.ExamView, DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Detail(Guid sessionId, [FromQuery] int page = 1, [FromQuery] int pageSize = 200, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var session = await db.DrivingMebbisImportSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == sessionId && x.ImportType == DrivingMebbisImportType.ExamResults, ct);
        if (session is null) return NotFound(new { message = "Sınav sonucu aktarımı bulunamadı." });
        var importRows = await db.DrivingMebbisImportRows.AsNoTracking().Where(x => x.ImportSessionId == sessionId).OrderBy(x => x.RowNumber).ToListAsync(ct);
        var candidateIds = importRows.Where(x => x.MatchedEntityId.HasValue).Select(x => x.MatchedEntityId!.Value).Distinct().ToList();
        var candidates = await db.DrivingExamCandidates.AsNoTracking().Where(x => candidateIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var profileIds = candidates.Values.Select(x => x.StudentDrivingProfileId).Distinct().ToList();
        var profiles = await db.StudentDrivingProfiles.AsNoTracking().Where(x => profileIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var studentIds = profiles.Values.Select(x => x.StudentId).Distinct().ToList();
        var names = await db.Students.AsNoTracking().Where(x => studentIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var examIds = candidates.Values.Select(x => x.ExamSessionId).Distinct().ToList();
        var exams = await db.DrivingExamSessions.AsNoTracking().Where(x => examIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var allCandidateRows = await db.DrivingExamCandidates.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.Status != DrivingExamCandidateStatus.Cancelled).ToListAsync(ct);
        var allExamIds = allCandidateRows.Select(x => x.ExamSessionId).Distinct().ToList();
        var allExamTypes = await db.DrivingExamSessions.AsNoTracking().Where(x => allExamIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.ExamType, ct);
        var schoolSettings = await db.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();

        var analyses = importRows.Select(row => Analyze(row, candidates, profiles, names, exams, allCandidateRows, allExamTypes, schoolSettings)).ToList();
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 500);
        var pageRows = analyses.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var actionableIds = importRows.Where(x => x.Classification == DrivingMebbisImportRowClass.Change).Select(x => x.Id).ToHashSet();
        return Ok(new
        {
            session = new { session.Id, status = session.Status.ToString(), session.StudentGroupId, session.FileName, session.PreviewVersion, session.TotalRows, session.ChangeRows, session.ConflictRows, session.InvalidRows, session.ApplySummaryJson, session.CreatedByName, session.CreatedAtUtc, session.AppliedAtUtc },
            summary = new
            {
                total = analyses.Count, matched = analyses.Count(x => x.Matched), passed = analyses.Count(x => x.IncomingPassed == true), failed = analyses.Count(x => x.IncomingPassed == false),
                resultMismatch = analyses.Count(x => x.ResultMismatch), scoreMismatch = analyses.Count(x => x.ScoreMismatch), retryRequired = analyses.Count(x => x.RetryRequired),
                outOfAttempts = analyses.Count(x => x.OutOfAttempts), feeCandidates = analyses.Count(x => x.TotalFinancialImpact > 0 && !x.ContractMissing), feeTotal = analyses.Where(x => !x.ContractMissing).Sum(x => x.TotalFinancialImpact), contractMissing = analyses.Count(x => x.ContractMissing), mandatoryExtraLesson = analyses.Count(x => x.ExtraLessonMinutes > 0), actionable = actionableIds.Count,
            },
            rows = pageRows, page, pageSize, total = analyses.Count,
        });
    }

    private static ExamAnalysis Analyze(
        DrivingMebbisImportRow row,
        IReadOnlyDictionary<Guid, DrivingExamCandidate> candidates,
        IReadOnlyDictionary<Guid, StudentDrivingProfile> profiles,
        IReadOnlyDictionary<Guid, string> names,
        IReadOnlyDictionary<Guid, DrivingExamSession> exams,
        IReadOnlyList<DrivingExamCandidate> allCandidates,
        IReadOnlyDictionary<Guid, DrivingExamType> allExamTypes,
        DrivingSchoolSettings settings)
    {
        var source = JsonSerializer.Deserialize<Dictionary<string, string>>(row.SourceJson, JsonOptions) ?? [];
        decimal? importedScore = decimal.TryParse(Get(source, "score").Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedScore) ? parsedScore : null;
        if (!row.MatchedEntityId.HasValue || !candidates.TryGetValue(row.MatchedEntityId.Value, out var candidate) || !profiles.TryGetValue(candidate.StudentDrivingProfileId, out var profile) || !exams.TryGetValue(candidate.ExamSessionId, out var exam))
            return new ExamAnalysis(row.Id, row.RowNumber, row.Classification.ToString(), Mask(row.MatchKey), Get(source, "fullName"), false, null, null, null, importedScore, false, false, false, false, 0, 0, false, 0, false, false, "Sınav hakkı eşleşmedi.", null, null, null, 0, 0, 0);
        var incomingPassed = DrivingExamRules.ParseImportedResult(Get(source, "result"), importedScore, exam.ExamType);
        var usedAttempts = allCandidates.Count(x => x.StudentDrivingProfileId == profile.Id && allExamTypes.TryGetValue(x.ExamSessionId, out var type) && type == exam.ExamType);
        var remaining = DrivingExamRules.RemainingAttempts(usedAttempts);
        var incomingStatus = incomingPassed == true ? DrivingExamCandidateStatus.Passed : incomingPassed == false ? DrivingExamCandidateStatus.Failed : (DrivingExamCandidateStatus?)null;
        var resultMismatch = candidate.Status != DrivingExamCandidateStatus.Planned && incomingStatus.HasValue && candidate.Status != incomingStatus;
        var scoreMismatch = candidate.Score.HasValue && importedScore.HasValue && candidate.Score.Value != importedScore.Value;
        var retryRequired = incomingPassed == false && remaining > 0;
        var outOfAttempts = incomingPassed == false && remaining == 0;
        var fee = exam.ExamType == DrivingExamType.TheoryEExam ? profile.TheoryExamFee : profile.DrivingExamFee;
        var extraLessonMinutes = incomingPassed == false && exam.ExamType == DrivingExamType.DrivingPractice ? settings.FailedPracticeExtraLessonMinutes : 0;
        var extraLessonFee = extraLessonMinutes > 0 ? settings.FailedPracticeExtraLessonFee : 0;
        var totalFinancialImpact = (retryRequired ? fee : 0) + extraLessonFee;
        var contractMissing = totalFinancialImpact > 0 && !profile.EnrollmentContractId.HasValue;
        var feeWillBeCreated = retryRequired && fee > 0 && profile.EnrollmentContractId.HasValue;
        var displayName = names.GetValueOrDefault(profile.StudentId) ?? Get(source, "fullName");
        var message = row.Classification switch { DrivingMebbisImportRowClass.Conflict => "Önceki sonuçla çelişiyor; toplu işlemde korunur.", DrivingMebbisImportRowClass.Invalid => "Dosya satırı geçersiz.", DrivingMebbisImportRowClass.NotFound => "Kursiyer veya sınav hakkı bulunamadı.", _ when contractMissing => "Tekrar ücreti için sözleşme eksik.", _ when outOfAttempts => DrivingExamRules.OutOfAttemptsMessage(exam.ExamType), _ when retryRequired => "Tekrar sınavı planlanmalıdır.", _ => "Hazır." };
        return new ExamAnalysis(row.Id, row.RowNumber, row.Classification.ToString(), Mask(row.MatchKey), displayName, true, exam.Title, exam.ExamType.ToString(), candidate.Status.ToString(), importedScore, incomingPassed, resultMismatch, scoreMismatch, retryRequired, candidate.AttemptNo, remaining, outOfAttempts, fee, feeWillBeCreated, contractMissing, message, candidate.Score, candidate.Id, profile.Id, extraLessonMinutes, extraLessonFee, totalFinancialImpact);
    }

    private static string Get(IReadOnlyDictionary<string, string> values, string key) => values.GetValueOrDefault(key)?.Trim() ?? "";
    private static string Mask(string value) { var digits = new string((value ?? "").Where(char.IsDigit).ToArray()); return digits.Length <= 4 ? "****" : $"{digits[..2]}*****{digits[^2..]}"; }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }

    private sealed record ExamAnalysis(Guid RowId, int RowNumber, string Classification, string MaskedIdentity, string Name, bool Matched, string? ExamTitle, string? ExamType, string? PreviousResult, decimal? ImportedScore, bool? IncomingPassed, bool ResultMismatch, bool ScoreMismatch, bool RetryRequired, int AttemptNo, int RemainingAttempts, bool OutOfAttempts, decimal FeeAmount, bool FeeWillBeCreated, bool ContractMissing, string Message, decimal? PreviousScore, Guid? CandidateId, Guid? StudentProfileId, int ExtraLessonMinutes, decimal ExtraLessonFee, decimal TotalFinancialImpact);
}
