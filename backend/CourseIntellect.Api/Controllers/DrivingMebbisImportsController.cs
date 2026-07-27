using System.Data;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml;
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
[Route("api/driving-school/mebbis/imports")]
public sealed class DrivingMebbisImportsController(
    CourseIntellectDbContext db,
    IDrivingPermissionService permissions,
    IDrivingImportFileParser parser,
    IFileStorageService storage,
    IDrivingNotifier notifier,
    IDrivingLedgerService ledger,
    IAuditLogService audit) : ControllerBase
{
    private const long MaxFileBytes = 5L * 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var items = await db.DrivingMebbisImportSessions.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).Take(100)
            .Select(x => new { x.Id, importType = x.ImportType.ToString(), status = x.Status.ToString(), x.StudentGroupId, x.FileName, x.FileSize, x.Sha256, x.PreviewVersion, x.TotalRows, x.MatchedRows, x.NotFoundRows, x.ConflictRows, x.ChangeRows, x.NewRows, x.InvalidRows, x.CreatedByName, x.CreatedAtUtc, x.AppliedAtUtc }).ToListAsync(ct);
        var groups = await db.DrivingStudentGroups.AsNoTracking().OrderByDescending(x => x.TermYear).ThenByDescending(x => x.TermNumber).Select(x => new { x.Id, x.Name, x.TermYear, x.TermNumber, x.IsActive }).ToListAsync(ct);
        return Ok(new { items, groups, types = Enum.GetNames<DrivingMebbisImportType>(), maxFileBytes = MaxFileBytes });
    }

    [HttpGet("{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Detail(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 100, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var session = await db.DrivingMebbisImportSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (session is null) return NotFound(new { message = "Geri aktarım oturumu bulunamadı." });
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
        var rows = await db.DrivingMebbisImportRows.AsNoTracking().Where(x => x.ImportSessionId == id).OrderBy(x => x.RowNumber).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, x.RowNumber, classification = x.Classification.ToString(), x.MatchKey, x.MatchedStudentProfileId, x.MatchedEntityId, x.SourceJson, x.ChangesJson, x.MessagesJson, x.SelectedForApply }).ToListAsync(ct);
        return Ok(new { session = new { session.Id, importType = session.ImportType.ToString(), status = session.Status.ToString(), session.StudentGroupId, session.FileName, session.FileSize, session.Sha256, session.PreviewVersion, session.TotalRows, session.MatchedRows, session.NotFoundRows, session.ConflictRows, session.ChangeRows, session.NewRows, session.InvalidRows, session.CreatedByName, session.CreatedAtUtc, session.AppliedAtUtc, session.ApplySummaryJson }, rows, page, pageSize });
    }

    [HttpPost("preview")]
    [RequestSizeLimit(MaxFileBytes + 1024 * 64)]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Preview([FromForm] IFormFile file, [FromForm] string importType, [FromForm] Guid? studentGroupId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (file is null || file.Length is <= 0 or > MaxFileBytes) return BadRequest(new { message = "Dosya boş veya 5 MB sınırını aşıyor." });
        var safeName = Path.GetFileName(file.FileName);
        if (!Enum.TryParse<DrivingMebbisImportType>(importType, true, out var type) || !Enum.IsDefined(type)) return BadRequest(new { message = "Geri aktarım türü geçersiz." });
        if (type != DrivingMebbisImportType.TermList && studentGroupId is null) return BadRequest(new { message = "Bu aktarım türü için dönem seçilmelidir." });
        if (studentGroupId.HasValue && !await db.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.Id == studentGroupId, ct)) return BadRequest(new { message = "Dönem bulunamadı." });

        byte[] bytes;
        await using (var input = file.OpenReadStream()) { using var memory = new MemoryStream(); await input.CopyToAsync(memory, ct); bytes = memory.ToArray(); }
        DrivingImportTable table;
        try { await using var parseStream = new MemoryStream(bytes, writable: false); table = await parser.ParseAsync(parseStream, safeName, ct); }
        catch (Exception ex) when (ex is InvalidDataException or DecoderFallbackException or XmlException) { return BadRequest(new { message = ex.Message }); }
        var previewRows = await BuildPreviewAsync(type, studentGroupId, table.Rows, ct);
        if (previewRows.Count == 0) return BadRequest(new { message = "Dosyada işlenebilir veri satırı bulunamadı." });

        var sha = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        await using var storeStream = new MemoryStream(bytes, writable: false);
        var saved = await storage.SaveAsync(storeStream, safeName, file.ContentType, $"driving-imports/{db.CurrentTenantId:N}", string.Empty, ct);
        var userId = CurrentUserId(); if (userId is null) return Forbid();
        var session = new DrivingMebbisImportSession
        {
            ImportType = type, StudentGroupId = studentGroupId, FileName = safeName, FileUrl = saved.FileUrl, ContentType = saved.ContentType,
            FileSize = saved.Size, Sha256 = sha, TotalRows = previewRows.Count, MatchedRows = previewRows.Count(x => x.Classification is DrivingMebbisImportRowClass.Matched or DrivingMebbisImportRowClass.Unchanged),
            NotFoundRows = previewRows.Count(x => x.Classification == DrivingMebbisImportRowClass.NotFound), ConflictRows = previewRows.Count(x => x.Classification == DrivingMebbisImportRowClass.Conflict),
            ChangeRows = previewRows.Count(x => x.Classification == DrivingMebbisImportRowClass.Change), NewRows = previewRows.Count(x => x.Classification == DrivingMebbisImportRowClass.New), InvalidRows = previewRows.Count(x => x.Classification == DrivingMebbisImportRowClass.Invalid),
            CreatedByUserId = userId.Value, CreatedByName = CurrentUserName(),
        };
        foreach (var row in previewRows) row.ImportSessionId = session.Id;
        db.DrivingMebbisImportSessions.Add(session); db.DrivingMebbisImportRows.AddRange(previewRows); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS geri aktarım önizlemesi oluşturuldu", "DrivingSchool", nameof(DrivingMebbisImportSession), session.Id.ToString(), $"{type}: {session.TotalRows} satır, {session.ChangeRows} değişiklik, {session.ConflictRows} çelişki.", null, new { session.ImportType, session.StudentGroupId, session.Sha256, session.TotalRows, session.ChangeRows, session.NewRows, session.ConflictRows }, ct);
        return Ok(new { session.Id, importType = type.ToString(), status = session.Status.ToString(), session.PreviewVersion, session.TotalRows, session.MatchedRows, session.NotFoundRows, session.ConflictRows, session.ChangeRows, session.NewRows, session.InvalidRows });
    }

    [HttpPost("{id:guid}/apply")]
    [RequireDrivingPermission(DrivingPermissions.MebbisVerify)]
    public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyMebbisImportRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var session = await db.DrivingMebbisImportSessions.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (session is null) return NotFound(new { message = "Geri aktarım oturumu bulunamadı." });
        if (session.Status != DrivingMebbisImportStatus.PreviewReady) return Conflict(new { message = "Bu önizleme daha önce sonuçlandırılmış." });
        if (session.PreviewVersion != request.ExpectedPreviewVersion) return Conflict(new { message = "Önizleme sürümü değişti. Dosyayı yeniden inceleyin." });
        if (!await HasApplyPermissionAsync(session.ImportType, ct)) return Forbid();
        var bytes = await storage.ReadBytesAsync(session.FileUrl, ct); if (bytes is null) return Conflict(new { message = "Karantina dosyası bulunamadı." });
        var actualHash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(actualHash), Encoding.ASCII.GetBytes(session.Sha256))) return Conflict(new { message = "Dosya bütünlüğü doğrulanamadı; işlem iptal edildi." });

        var excluded = (request.ExcludedRowIds ?? []).Distinct().ToHashSet();
        var rows = await db.DrivingMebbisImportRows.Where(x => x.ImportSessionId == id && !excluded.Contains(x.Id) && x.SelectedForApply
            && (x.Classification == DrivingMebbisImportRowClass.Change || x.Classification == DrivingMebbisImportRowClass.New)).OrderBy(x => x.RowNumber).ToListAsync(ct);
        await using (var verificationStream = new MemoryStream(bytes, writable: false))
        {
            var currentTable = await parser.ParseAsync(verificationStream, session.FileName, ct);
            var currentPreview = (await BuildPreviewAsync(session.ImportType, session.StudentGroupId, currentTable.Rows, ct)).ToDictionary(x => x.RowNumber);
            var stale = rows.Any(row => !currentPreview.TryGetValue(row.RowNumber, out var current)
                || current.Classification != row.Classification
                || current.MatchedStudentProfileId != row.MatchedStudentProfileId
                || current.MatchedEntityId != row.MatchedEntityId
                || current.ChangesJson != row.ChangesJson);
            if (stale) return Conflict(new { message = "Sistem kayıtları önizlemeden sonra değişmiş. Güvenliğiniz için dosyayı yeniden önizleyin." });
        }
        if (rows.Any(x => x.Classification == DrivingMebbisImportRowClass.New)
            && !await permissions.HasAsync(User, DrivingPermissions.LeadManage, ct)) return Forbid();
        var applyingUserId = CurrentUserId();
        if (applyingUserId is null) return Forbid();
        var profileIds = rows.Where(x => x.MatchedStudentProfileId.HasValue).Select(x => x.MatchedStudentProfileId!.Value).Distinct().ToList();
        var entityIds = rows.Where(x => x.MatchedEntityId.HasValue).Select(x => x.MatchedEntityId!.Value).Distinct().ToList();
        if (session.ImportType is DrivingMebbisImportType.CandidateList or DrivingMebbisImportType.StudentStatuses)
            await db.StudentDrivingProfiles.Where(x => profileIds.Contains(x.Id)).LoadAsync(ct);
        else if (session.ImportType == DrivingMebbisImportType.ExamResults)
            await db.DrivingExamCandidates.Where(x => entityIds.Contains(x.Id)).LoadAsync(ct);
        else if (session.ImportType == DrivingMebbisImportType.CertificateNumbers)
            await db.DrivingCertificates.Where(x => entityIds.Contains(x.Id)).LoadAsync(ct);
        else if (session.ImportType == DrivingMebbisImportType.TermList)
            await db.DrivingStudentGroups.Where(x => entityIds.Contains(x.Id)).LoadAsync(ct);
        var applied = 0; var skipped = session.TotalRows - rows.Count; var leads = 0; var groups = 0; var retries = 0; var retryFees = 0; var extraLessons = 0; var outOfAttempts = 0;
        foreach (var row in rows)
        {
            var source = JsonSerializer.Deserialize<Dictionary<string, string>>(row.SourceJson, JsonOptions) ?? [];
            if (session.ImportType == DrivingMebbisImportType.TermList) { await ApplyTermAsync(row, source, ct); groups += row.Classification == DrivingMebbisImportRowClass.New ? 1 : 0; }
            else if (row.Classification == DrivingMebbisImportRowClass.New) { ApplyLead(source); leads++; }
            else if (session.ImportType == DrivingMebbisImportType.CandidateList) await ApplyCandidateAsync(row, source, session.StudentGroupId, ct);
            else if (session.ImportType == DrivingMebbisImportType.ExamResults)
            {
                var outcome = await ApplyExamResultAsync(row, source, request.CreateRetryFees, ct);
                if (outcome.RetryRequired) retries++; if (outcome.RetryChargeId.HasValue) retryFees++; if (outcome.ExtraLessonCreated) extraLessons++; if (outcome.OutOfAttempts) outOfAttempts++;
            }
            else if (session.ImportType == DrivingMebbisImportType.CertificateNumbers) await ApplyCertificateAsync(row, source, ct);
            else if (session.ImportType == DrivingMebbisImportType.StudentStatuses) await ApplyStudentStatusAsync(row, source, ct);
            if (row.MatchedStudentProfileId is Guid historyProfileId)
                AddImportHistory(session.ImportType, historyProfileId, row, source, applyingUserId.Value);
            applied++;
        }
        session.Status = DrivingMebbisImportStatus.Applied; session.AppliedByUserId = applyingUserId; session.AppliedAtUtc = DateTime.UtcNow;
        session.ApplySummaryJson = JsonSerializer.Serialize(new { applied, skipped, leadsCreated = leads, termsCreated = groups, retryRequired = retries, retryFeesCreated = retryFees, mandatoryExtraLessons = extraLessons, outOfAttempts }, JsonOptions);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) when (session.ImportType == DrivingMebbisImportType.CertificateNumbers)
        {
            return Conflict(new { message = "Sertifika numaralarından biri başka bir işlemde kullanıldı. Dosyayı yeniden önizleyin." });
        }
        await transaction.CommitAsync(ct);
        await audit.LogChangeAsync("MEBBİS geri aktarımı uygulandı", "DrivingSchool", nameof(DrivingMebbisImportSession), session.Id.ToString(), $"{session.ImportType}: {applied} satır uygulandı, {skipped} satır atlandı.", new { status = DrivingMebbisImportStatus.PreviewReady }, new { session.Status, applied, skipped, leads, groups }, ct);
        return Ok(new { applied, skipped, leadsCreated = leads, termsCreated = groups, retryRequired = retries, retryFeesCreated = retryFees, mandatoryExtraLessons = extraLessons, outOfAttempts, status = session.Status.ToString(), session.AppliedAtUtc });
    }

    [HttpPost("{id:guid}/reject")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectMebbisImportRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if ((request.Reason?.Trim().Length ?? 0) is < 10 or > 1000) return BadRequest(new { message = "Ret gerekçesi 10-1000 karakter olmalıdır." });
        var rejectingUserId = CurrentUserId(); if (rejectingUserId is null) return Forbid();
        var session = await db.DrivingMebbisImportSessions.SingleOrDefaultAsync(x => x.Id == id, ct); if (session is null) return NotFound();
        if (session.Status != DrivingMebbisImportStatus.PreviewReady || session.PreviewVersion != request.ExpectedPreviewVersion) return Conflict(new { message = "Önizleme daha önce sonuçlandırılmış veya sürümü değişmiş." });
        session.Status = DrivingMebbisImportStatus.Rejected; session.AppliedByUserId = rejectingUserId; session.AppliedAtUtc = DateTime.UtcNow; session.ApplySummaryJson = JsonSerializer.Serialize(new { reason = request.Reason!.Trim() }, JsonOptions); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS geri aktarımı reddedildi", "DrivingSchool", nameof(DrivingMebbisImportSession), session.Id.ToString(), request.Reason.Trim(), new { status = DrivingMebbisImportStatus.PreviewReady }, new { session.Status, reason = request.Reason.Trim() }, ct);
        return Ok(new { status = session.Status.ToString() });
    }

    private async Task<List<DrivingMebbisImportRow>> BuildPreviewAsync(DrivingMebbisImportType type, Guid? groupId, IReadOnlyList<IReadOnlyDictionary<string, string>> input, CancellationToken ct)
    {
        var studentRows = await db.StudentDrivingProfiles.AsNoTracking().Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p, s.TcNo, s.FullName }).ToListAsync(ct);
        var byIdentity = studentRows.SelectMany(x => new[] { x.TcNo, x.p.IdentityNumber }.Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => new { Key = Digits(v), Value = x })).GroupBy(x => x.Key).ToDictionary(x => x.Key, x => x.Select(y => y.Value).DistinctBy(y => y.p.Id).ToList());
        var byStudentNumber = studentRows.Where(x => x.p.StudentNumber > 0)
            .Select(x => new { Key = $"SN:{x.p.StudentNumber}", Value = x }).GroupBy(x => x.Key)
            .ToDictionary(x => x.Key, x => x.Select(y => y.Value).DistinctBy(y => y.p.Id).ToList());
        var terms = type == DrivingMebbisImportType.TermList
            ? await db.DrivingStudentGroups.AsNoTracking().ToListAsync(ct)
            : [];
        var examCandidates = type == DrivingMebbisImportType.ExamResults
            ? await db.DrivingExamCandidates.AsNoTracking().OrderByDescending(x => x.CreatedAtUtc).ToListAsync(ct)
            : [];
        var examSessions = type == DrivingMebbisImportType.ExamResults
            ? await db.DrivingExamSessions.AsNoTracking().ToDictionaryAsync(x => x.Id, ct)
            : new Dictionary<Guid, DrivingExamSession>();
        var certificates = type == DrivingMebbisImportType.CertificateNumbers
            ? (await db.DrivingCertificates.AsNoTracking().Where(x => x.Status == DrivingCertificateStatus.Active).OrderByDescending(x => x.IssuedAtUtc).ToListAsync(ct))
                .GroupBy(x => x.StudentDrivingProfileId).ToDictionary(x => x.Key, x => x.First())
            : new Dictionary<Guid, DrivingCertificate>();
        var certificateOwners = type == DrivingMebbisImportType.CertificateNumbers
            ? await db.DrivingCertificates.AsNoTracking().Where(x => x.MebbisCertificateNo != "").Select(x => new { x.Id, x.MebbisCertificateNo }).ToListAsync(ct)
            : [];
        var duplicateIncomingCertificateNos = type == DrivingMebbisImportType.CertificateNumbers
            ? input.Select(Canonical).Select(x => Val(x, "certificateNo")).Where(x => !string.IsNullOrWhiteSpace(x))
                .GroupBy(N).Where(x => x.Count() > 1).Select(x => x.Key).ToHashSet(StringComparer.Ordinal)
            : [];
        var result = new List<DrivingMebbisImportRow>(); var rowNo = 1;
        foreach (var raw in input)
        {
            rowNo++; var source = Canonical(raw); var messages = new List<string>(); var changes = new List<object>(); Guid? profileId = null; Guid? entityId = null;
            var identityKey = Digits(Val(source, "identity"));
            var studentNumberKey = string.IsNullOrWhiteSpace(Val(source, "studentNumber")) ? "" : $"SN:{N(Val(source, "studentNumber"))}";
            var key = type == DrivingMebbisImportType.TermList ? $"{Val(source, "termYear")}/{Val(source, "termNumber")}" :
                type == DrivingMebbisImportType.CertificateNumbers && identityKey.Length < 5 ? studentNumberKey : identityKey;
            var conflictingIdentifiers = type == DrivingMebbisImportType.CertificateNumbers && identityKey.Length >= 5 && studentNumberKey.Length > 3
                && byIdentity.TryGetValue(identityKey, out var identityMatches) && identityMatches.Count == 1
                && byStudentNumber.TryGetValue(studentNumberKey, out var numberMatches) && numberMatches.Count == 1
                && identityMatches[0].p.Id != numberMatches[0].p.Id;
            var classification = DrivingMebbisImportRowClass.Invalid;
            if (type == DrivingMebbisImportType.TermList)
            {
                if (!int.TryParse(Val(source, "termYear"), out var year) || year is < 2000 or > 2100 || !int.TryParse(Val(source, "termNumber"), out var number) || number is < 1 or > 99) messages.Add("Dönem yılı/numarası geçersiz.");
                else
                {
                    var matches = terms.Where(x => x.TermYear == year && x.TermNumber == number).ToList();
                    if (matches.Count > 1) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add("Aynı yıl/numarada birden fazla dönem var."); }
                    else if (matches.Count == 0) classification = DrivingMebbisImportRowClass.New;
                    else { entityId = matches[0].Id; Compare(changes, "MebbisTermCode", matches[0].MebbisTermCode, Val(source, "termCode")); Compare(changes, "Quota", $"{matches[0].Quota}", Val(source, "quota")); CompareDate(changes, "RegistrationDeadline", matches[0].RegistrationDeadlineUtc, Val(source, "deadline")); classification = changes.Count > 0 ? DrivingMebbisImportRowClass.Change : DrivingMebbisImportRowClass.Unchanged; }
                }
            }
            else if ((key.StartsWith("SN:", StringComparison.Ordinal) && key.Length <= 3) || (!key.StartsWith("SN:", StringComparison.Ordinal) && key.Length < 5))
                messages.Add(type == DrivingMebbisImportType.CertificateNumbers ? "TC kimlik veya kursiyer numarası bulunamadı." : "Kimlik numarası bulunamadı veya geçersiz.");
            else if (conflictingIdentifiers) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add("TC kimlik ile kursiyer numarası farklı kişilere ait."); }
            else if (!(key.StartsWith("SN:", StringComparison.Ordinal) ? byStudentNumber.TryGetValue(key, out var matches) : byIdentity.TryGetValue(key, out matches)))
            {
                classification = type == DrivingMebbisImportType.CandidateList && !string.IsNullOrWhiteSpace(Val(source, "fullName")) ? DrivingMebbisImportRowClass.New : DrivingMebbisImportRowClass.NotFound;
                messages.Add(classification == DrivingMebbisImportRowClass.New ? "Yeni aday adayı oluşturulabilir." : "Sistemde eşleşen kursiyer bulunamadı.");
            }
            else if (matches.Count != 1) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add("Kimlik numarası birden fazla aktif kayıtla eşleşiyor."); }
            else
            {
                var match = matches[0]; profileId = match.p.Id;
                if (groupId.HasValue && match.p.StudentGroupId is Guid currentGroup && currentGroup != groupId) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add("Kursiyer başka bir döneme bağlı."); }
                else if (type == DrivingMebbisImportType.CandidateList)
                {
                    Compare(changes, "Phone", match.p.Phone, Val(source, "phone")); Compare(changes, "MotherName", match.p.MotherName, Val(source, "motherName")); Compare(changes, "FatherName", match.p.FatherName, Val(source, "fatherName")); Compare(changes, "BirthPlace", match.p.BirthPlace, Val(source, "birthPlace")); Compare(changes, "EducationLevel", match.p.EducationLevel, Val(source, "education")); Compare(changes, "IdentitySerialNo", match.p.IdentitySerialNo, Val(source, "serialNo"));
                    var incomingClass = Val(source, "licenseClass"); if (!string.IsNullOrWhiteSpace(incomingClass) && !incomingClass.Equals(match.p.LicenseClass, StringComparison.OrdinalIgnoreCase)) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add($"Ehliyet sınıfı uyuşmuyor: sistem {match.p.LicenseClass}, dosya {incomingClass}."); } else classification = changes.Count > 0 || (groupId.HasValue && match.p.StudentGroupId is null) ? DrivingMebbisImportRowClass.Change : DrivingMebbisImportRowClass.Unchanged;
                }
                else if (type == DrivingMebbisImportType.ExamResults)
                {
                    var options = examCandidates.Where(x => x.StudentDrivingProfileId == match.p.Id).ToList();
                    var importedType = ParseExamType(Val(source, "examType"));
                    if (importedType.HasValue) options = options.Where(x => examSessions.TryGetValue(x.ExamSessionId, out var e) && e.ExamType == importedType).ToList();
                    if (int.TryParse(Val(source, "attemptNo"), out var attemptNo) && attemptNo > 0) options = options.Where(x => x.AttemptNo == attemptNo).ToList();
                    if (DateTime.TryParse(Val(source, "examDate"), CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.AssumeLocal, out var examDate)) options = options.Where(x => examSessions.TryGetValue(x.ExamSessionId, out var e) && e.StartsAtUtc.ToLocalTime().Date == examDate.Date).ToList();
                    var candidate = options.FirstOrDefault();
                    if (candidate is null) { classification = DrivingMebbisImportRowClass.NotFound; messages.Add("Kursiyerin sınav aday kaydı bulunamadı."); }
                    else
                    {
                        entityId = candidate.Id; var scoreText = Val(source, "score");
                        decimal? parsedScore = null; if (!string.IsNullOrWhiteSpace(scoreText) && TryScore(scoreText, out var scoreValue)) parsedScore = scoreValue;
                        var examType = examSessions.TryGetValue(candidate.ExamSessionId, out var matchedExam) ? matchedExam.ExamType : DrivingExamType.TheoryEExam;
                        var passed = DrivingExamRules.ParseImportedResult(Val(source, "result"), parsedScore, examType);
                        var status = passed == true ? DrivingExamCandidateStatus.Passed : passed == false ? DrivingExamCandidateStatus.Failed : (DrivingExamCandidateStatus?)null;
                        if (!string.IsNullOrWhiteSpace(scoreText) && parsedScore is null) { classification = DrivingMebbisImportRowClass.Invalid; messages.Add("Sınav puanı 0-100 aralığında olmalıdır."); }
                        else if (status is null) { classification = DrivingMebbisImportRowClass.Invalid; messages.Add("Sınav sonucu geçti/kaldı olarak okunamadı."); }
                        else
                        {
                            Compare(changes, "Status", candidate.Status.ToString(), status.Value.ToString()); Compare(changes, "Score", candidate.Score?.ToString(CultureInfo.InvariantCulture) ?? "", scoreText);
                            if (candidate.Status != DrivingExamCandidateStatus.Planned && changes.Count > 0) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add($"Önceki sonuç korunuyor: {candidate.Status}, puan {candidate.Score?.ToString(CultureInfo.InvariantCulture) ?? "—"}. Değişiklik için tekil yetkili düzeltme gerekir."); }
                            else classification = changes.Count > 0 ? DrivingMebbisImportRowClass.Change : DrivingMebbisImportRowClass.Unchanged;
                            if (status == DrivingExamCandidateStatus.Failed) messages.Add("Başarısız sonuç: sınav hakkı, tekrar planlama, kursiyer durumu ve ücret etkisi onay öncesi kontrol edilmelidir.");
                        }
                    }
                }
                else if (type == DrivingMebbisImportType.CertificateNumbers)
                {
                    certificates.TryGetValue(match.p.Id, out var certificate);
                    if (certificate is null) { classification = DrivingMebbisImportRowClass.NotFound; messages.Add("Aktif sertifika kaydı bulunamadı."); }
                    else if (string.IsNullOrWhiteSpace(Val(source, "certificateNo"))) { classification = DrivingMebbisImportRowClass.Invalid; messages.Add("Sertifika numarası boş."); }
                    else if (Val(source, "certificateNo").Length > 60) { classification = DrivingMebbisImportRowClass.Invalid; messages.Add("Sertifika numarası 60 karakter sınırını aşıyor."); }
                    else
                    {
                        entityId = certificate.Id; var certificateNo = Val(source, "certificateNo");
                        var usedByAnother = certificateOwners.Any(x => x.Id != certificate.Id && x.MebbisCertificateNo.Equals(certificateNo, StringComparison.OrdinalIgnoreCase));
                        if (duplicateIncomingCertificateNos.Contains(N(certificateNo))) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add("Sertifika numarası yüklenen dosyada birden fazla kişide bulunuyor."); }
                        else if (usedByAnother) { classification = DrivingMebbisImportRowClass.Conflict; messages.Add("Sertifika numarası başka bir kayıtta kullanılıyor."); }
                        else { Compare(changes, "MebbisCertificateNo", certificate.MebbisCertificateNo, certificateNo); classification = changes.Count > 0 ? DrivingMebbisImportRowClass.Change : DrivingMebbisImportRowClass.Unchanged; }
                    }
                }
                else
                {
                    var parsed = ParseStudentStatus(Val(source, "status")); if (parsed is null) { classification = DrivingMebbisImportRowClass.Invalid; messages.Add("Kursiyer durumu desteklenmiyor; mezuniyet dosyadan uygulanamaz."); }
                    else { Compare(changes, "Status", match.p.Status.ToString(), parsed.Value.ToString()); classification = changes.Count > 0 ? DrivingMebbisImportRowClass.Change : DrivingMebbisImportRowClass.Unchanged; }
                }
            }
            result.Add(new DrivingMebbisImportRow { RowNumber = rowNo, Classification = classification, MatchKey = key, MatchedStudentProfileId = profileId, MatchedEntityId = entityId, SourceJson = JsonSerializer.Serialize(source, JsonOptions), ChangesJson = JsonSerializer.Serialize(changes, JsonOptions), MessagesJson = JsonSerializer.Serialize(messages, JsonOptions), SelectedForApply = classification is DrivingMebbisImportRowClass.Change or DrivingMebbisImportRowClass.New });
        }
        return result;
    }

    private async Task ApplyCandidateAsync(DrivingMebbisImportRow row, Dictionary<string, string> s, Guid? groupId, CancellationToken ct) { var p = await db.StudentDrivingProfiles.FindAsync([row.MatchedStudentProfileId], ct) ?? throw new InvalidOperationException("Kursiyer kaydı değişmiş."); p.Phone = Set(p.Phone, Val(s, "phone")); p.MotherName = Set(p.MotherName, Val(s, "motherName")); p.FatherName = Set(p.FatherName, Val(s, "fatherName")); p.BirthPlace = Set(p.BirthPlace, Val(s, "birthPlace")); p.EducationLevel = Set(p.EducationLevel, Val(s, "education")); p.IdentitySerialNo = Set(p.IdentitySerialNo, Val(s, "serialNo")); if (p.StudentGroupId is null) p.StudentGroupId = groupId; }
    private sealed record ImportedExamOutcome(bool RetryRequired, bool OutOfAttempts, Guid? RetryChargeId, bool ExtraLessonCreated);

    private async Task<ImportedExamOutcome> ApplyExamResultAsync(DrivingMebbisImportRow row, Dictionary<string, string> s, bool createRetryFee, CancellationToken ct)
    {
        var candidate = await db.DrivingExamCandidates.FindAsync([row.MatchedEntityId], ct) ?? throw new InvalidOperationException("Sınav kaydı değişmiş.");
        if (candidate.Status != DrivingExamCandidateStatus.Planned) throw new InvalidOperationException("Sonuçlandırılmış sınav toplu aktarımda değiştirilemez.");
        var exam = await db.DrivingExamSessions.SingleAsync(x => x.Id == candidate.ExamSessionId, ct);
        var student = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == candidate.StudentDrivingProfileId, ct);
        decimal? importedScore = TryScore(Val(s, "score"), out var parsedScore) ? parsedScore : null;
        var parsedResult = DrivingExamRules.ParseImportedResult(Val(s, "result"), importedScore, exam.ExamType);
        var importedStatus = parsedResult == true ? DrivingExamCandidateStatus.Passed : parsedResult == false ? DrivingExamCandidateStatus.Failed : throw new InvalidOperationException("Sınav sonucu geçersiz.");
        var passed = importedStatus == DrivingExamCandidateStatus.Passed;

        candidate.Status = importedStatus;
        if (importedScore.HasValue) candidate.Score = importedScore;
        var failure = Val(s, "failureReason");
        candidate.FailureReason = passed ? string.Empty : (string.IsNullOrWhiteSpace(failure) ? "MEBBİS sonucuna göre başarısız" : failure[..Math.Min(500, failure.Length)]);
        candidate.ResultNote = "MEBBİS güvenli geri aktarımı";
        candidate.ResultEnteredAtUtc = DateTime.UtcNow;
        candidate.ResultEnteredByUserId = CurrentUserId();
        student.Status = DrivingExamRules.StudentStatusAfterResult(exam.ExamType, passed);
        await db.SaveChangesAsync(ct);

        var usedAttempts = await db.DrivingExamCandidates.AsNoTracking().Where(x => x.StudentDrivingProfileId == student.Id && x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(db.DrivingExamSessions.AsNoTracking().Where(x => x.ExamType == exam.ExamType), x => x.ExamSessionId, x => x.Id, (candidateRow, _) => candidateRow.Id).CountAsync(ct);
        var outOfAttempts = !passed && DrivingExamRules.IsOutOfAttempts(usedAttempts);
        var retryRequired = !passed && !outOfAttempts;
        Guid? retryChargeId = null;
        var extraLessonCreated = false;

        if (retryRequired && createRetryFee)
        {
            var amount = exam.ExamType == DrivingExamType.DrivingPractice ? student.DrivingExamFee : 0m;
            if (amount > 0 && student.EnrollmentContractId.HasValue)
                retryChargeId = await CreateImportedChargeAsync(student, amount, DrivingChargeType.ExamFee, $"{DrivingExamRules.ExamTypeLabel(exam.ExamType)} tekrar ücreti — MEBBİS sonucu", 0, ct);
        }
        if (!passed && exam.ExamType == DrivingExamType.DrivingPractice)
        {
            var settings = await db.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();
            if (settings.FailedPracticeExtraLessonMinutes > 0)
            {
                var description = $"Zorunlu ek direksiyon eğitimi — {exam.Title} başarısız ({settings.FailedPracticeExtraLessonMinutes} dk)";
                if (settings.FailedPracticeExtraLessonFee > 0 && student.EnrollmentContractId.HasValue)
                    await CreateImportedChargeAsync(student, settings.FailedPracticeExtraLessonFee, DrivingChargeType.ExtraLesson, description, settings.FailedPracticeExtraLessonMinutes, ct);
                await ledger.AddAsync(student.Id, DrivingLedgerEntryType.ExtraPurchasedMinutes, settings.FailedPracticeExtraLessonMinutes, description, reason: "MEBBİS başarısız direksiyon sınavı sonrası zorunlu ek eğitim", cancellationToken: ct);
                extraLessonCreated = true;
            }
        }

        if (outOfAttempts)
            await notifier.NotifyManagersAsync("Sınav hakkı doldu — dönem düştü", $"{DrivingExamRules.ExamTypeLabel(exam.ExamType)} için {DrivingExamRules.MaxAttempts} hak doldu.", DrivingNotificationCategories.Exam, dedupeKey: $"mebbis-exam-out:{candidate.Id}", relatedEntityType: nameof(DrivingExamCandidate), relatedEntityId: candidate.Id.ToString(), cancellationToken: ct);
        await notifier.NotifyStudentAsync(student.Id, passed ? "Sınavı geçtiniz" : "Sınav sonucu: başarısız", passed ? $"{exam.Title} sınavını başarıyla tamamladınız." : $"{exam.Title}: {candidate.FailureReason}", DrivingNotificationCategories.Exam, dedupeKey: $"mebbis-exam-result:{candidate.Id}", relatedEntityType: nameof(DrivingExamCandidate), relatedEntityId: candidate.Id.ToString(), cancellationToken: ct);

        if (!await db.DrivingExamCandidates.AnyAsync(x => x.ExamSessionId == exam.Id && x.Status == DrivingExamCandidateStatus.Planned, ct)) exam.Status = DrivingExamSessionStatus.Completed;
        return new ImportedExamOutcome(retryRequired, outOfAttempts, retryChargeId, extraLessonCreated);
    }

    private async Task<Guid> CreateImportedChargeAsync(StudentDrivingProfile student, decimal amount, DrivingChargeType type, string description, int minutes, CancellationToken ct)
    {
        if (amount is <= 0 or > 1_000_000 || student.EnrollmentContractId is not Guid contractId) throw new InvalidOperationException("Ücret veya sözleşme bilgisi geçersiz.");
        var contract = await db.EnrollmentContracts.SingleAsync(x => x.Id == contractId, ct);
        var databaseSeq = await db.FinanceInstallments.Where(x => x.EnrollmentContractId == contractId).Select(x => (int?)x.SeqNo).MaxAsync(ct) ?? 0;
        var localSeq = db.FinanceInstallments.Local.Where(x => x.EnrollmentContractId == contractId).Select(x => x.SeqNo).DefaultIfEmpty(0).Max();
        var installment = new FinanceInstallment { EnrollmentContractId = contractId, StudentUserId = contract.StudentUserId, StudentName = contract.StudentName, SeqNo = Math.Max(databaseSeq, localSeq) + 1, Label = type == DrivingChargeType.ExamFee ? "Tekrar sınavı ücreti" : "Zorunlu ek ders", DueDateUtc = DateTime.UtcNow.Date, Amount = amount, Status = "Pending" };
        var charge = new DrivingCharge { StudentDrivingProfileId = student.Id, ChargeType = type, Description = description, GrossAmount = amount, NetAmount = amount, Minutes = minutes, FinanceInstallmentId = installment.Id, EnrollmentContractId = contractId, CreatedByUserId = CurrentUserId() };
        db.FinanceInstallments.Add(installment); db.DrivingCharges.Add(charge); contract.GrossAmount += amount; contract.NetAmount += amount;
        return charge.Id;
    }
    private async Task ApplyCertificateAsync(DrivingMebbisImportRow row, Dictionary<string, string> s, CancellationToken ct) { var c = await db.DrivingCertificates.FindAsync([row.MatchedEntityId], ct) ?? throw new InvalidOperationException("Sertifika kaydı değişmiş."); var value = Val(s, "certificateNo").ToUpperInvariant(); c.MebbisCertificateNo = value[..Math.Min(60, value.Length)]; }
    private async Task ApplyStudentStatusAsync(DrivingMebbisImportRow row, Dictionary<string, string> s, CancellationToken ct) { var p = await db.StudentDrivingProfiles.FindAsync([row.MatchedStudentProfileId], ct) ?? throw new InvalidOperationException("Kursiyer kaydı değişmiş."); p.Status = ParseStudentStatus(Val(s, "status"))!.Value; }
    private async Task ApplyTermAsync(DrivingMebbisImportRow row, Dictionary<string, string> s, CancellationToken ct) { int.TryParse(Val(s, "termYear"), out var year); int.TryParse(Val(s, "termNumber"), out var number); int.TryParse(Val(s, "quota"), out var quota); var group = row.MatchedEntityId.HasValue ? await db.DrivingStudentGroups.FindAsync([row.MatchedEntityId], ct) ?? throw new InvalidOperationException("Dönem kaydı değişmiş.") : new DrivingStudentGroup { Name = $"{year} / {number}. Dönem", TermYear = year, TermNumber = number, CreatedByUserId = CurrentUserId() }; group.MebbisTermCode = Val(s, "termCode")[..Math.Min(40, Val(s, "termCode").Length)]; if (quota is > 0 and <= 10000) group.Quota = quota; if (DateTime.TryParse(Val(s, "deadline"), CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.AssumeLocal, out var deadline)) group.RegistrationDeadlineUtc = deadline.ToUniversalTime(); if (!row.MatchedEntityId.HasValue) db.DrivingStudentGroups.Add(group); }
    private void ApplyLead(Dictionary<string, string> s) { db.DrivingLeads.Add(new DrivingLead { FullName = Val(s, "fullName")[..Math.Min(150, Val(s, "fullName").Length)], Phone = Val(s, "phone")[..Math.Min(30, Val(s, "phone").Length)], LicenseClass = Val(s, "licenseClass")[..Math.Min(20, Val(s, "licenseClass").Length)], Source = "MEBBİS Geri Aktarım", Note = $"Kimlik referansı: {MaskIdentity(Val(s, "identity"))}" }); }

    private void AddImportHistory(DrivingMebbisImportType type, Guid profileId, DrivingMebbisImportRow row,
        IReadOnlyDictionary<string, string> source, Guid actorUserId)
    {
        var (eventType, severity, title, description, status) = type switch
        {
            DrivingMebbisImportType.ExamResults => (DrivingMebbisHistoryEventType.ExamResult,
                N(Val(source, "result")) is "gecti" or "basarili" or "passed" ? DrivingMebbisHistorySeverity.Success : DrivingMebbisHistorySeverity.Warning,
                "Sınav sonucu MEBBİS’ten aktarıldı", "Sınav sonucu güvenli toplu aktarım ile işlendi.", Val(source, "result")),
            DrivingMebbisImportType.CertificateNumbers => (DrivingMebbisHistoryEventType.CertificateNumber,
                DrivingMebbisHistorySeverity.Success, "Sertifika numarası işlendi", "MEBBİS sertifika numarası toplu aktarım ile işlendi.", "Processed"),
            DrivingMebbisImportType.CandidateList => (DrivingMebbisHistoryEventType.Import,
                DrivingMebbisHistorySeverity.Info, "Aday bilgileri MEBBİS listesinden güncellendi", "Onaylanan aday bilgileri sisteme aktarıldı.", "Updated"),
            DrivingMebbisImportType.StudentStatuses => (DrivingMebbisHistoryEventType.Import,
                DrivingMebbisHistorySeverity.Info, "Kursiyer durumu MEBBİS’ten aktarıldı", "Kursiyer durumu güvenli toplu aktarım ile güncellendi.", Val(source, "status")),
            _ => (DrivingMebbisHistoryEventType.Import, DrivingMebbisHistorySeverity.Info,
                "MEBBİS geri aktarımı uygulandı", "Onaylanan kayıt sisteme işlendi.", "Applied"),
        };
        db.AddMebbisHistory(profileId, eventType, title, description, status,
            nameof(DrivingMebbisImportRow), row.Id, actorUserId, CurrentUserName(), severity);
    }

    private async Task<bool> HasApplyPermissionAsync(DrivingMebbisImportType type, CancellationToken ct) => type switch { DrivingMebbisImportType.ExamResults => await permissions.HasAsync(User, DrivingPermissions.ExamResultEnter, ct), DrivingMebbisImportType.CertificateNumbers => await permissions.HasAsync(User, DrivingPermissions.GraduationManage, ct), DrivingMebbisImportType.TermList or DrivingMebbisImportType.CandidateList or DrivingMebbisImportType.StudentStatuses => await permissions.HasAsync(User, DrivingPermissions.StudentUpdate, ct), _ => false };
    private static Dictionary<string, string> Canonical(IReadOnlyDictionary<string, string> row) { string G(params string[] names) { foreach (var pair in row) if (names.Contains(N(pair.Key))) return pair.Value.Trim(); return ""; } var fullName = G("adsoyad", "adisoyadi", "kursiyer", "kursiyeradisoyadi"); if (string.IsNullOrWhiteSpace(fullName)) fullName = string.Join(' ', new[] { G("ad", "adi"), G("soyad", "soyadi") }.Where(x => !string.IsNullOrWhiteSpace(x))); return new(StringComparer.OrdinalIgnoreCase) { ["identity"] = G("tc", "tckimlikno", "kimlikno", "yabancikimlikno"), ["studentNumber"] = G("kursiyerno", "kursiyenumarasi", "ogrencino", "ogrencinumarasi", "adayno", "adaynumarasi"), ["fullName"] = fullName, ["phone"] = G("telefon", "ceptelefonu", "gsm"), ["motherName"] = G("anneadi"), ["fatherName"] = G("babaadi"), ["birthPlace"] = G("dogumyeri"), ["education"] = G("ogrenim", "ogrenimdurumu"), ["serialNo"] = G("kimlikserino", "serino"), ["licenseClass"] = G("ehliyetsinifi", "sertifikasinifi"), ["result"] = G("sonuc", "sinavsonucu"), ["score"] = G("puan", "sinavpuani"), ["examType"] = G("sinavturu", "sinavtipi"), ["examDate"] = G("sinavtarihi", "tarih"), ["attemptNo"] = G("sinavhakki", "hak", "deneme", "denemeno"), ["failureReason"] = G("basarisizliknedeni", "kalmanedeni"), ["certificateNo"] = G("sertifikano", "sertifikanumarasi", "mebbissertifikano").ToUpperInvariant(), ["status"] = G("durum", "kursiyerdurumu"), ["termYear"] = G("donemyili", "yil"), ["termNumber"] = G("donemno", "donemnumarasi"), ["termCode"] = G("donemkodu", "mebbisdonemkodu"), ["quota"] = G("kontenjan"), ["deadline"] = G("sonkayittarihi", "kayitbitistarihi") }; }
    private static string N(string value) => new(value.Replace('ı', 'i').Replace('İ', 'I').Normalize(NormalizationForm.FormD).Where(x => CharUnicodeInfo.GetUnicodeCategory(x) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(x)).Select(char.ToLowerInvariant).ToArray());
    private static string Val(IReadOnlyDictionary<string, string> source, string key) => source.GetValueOrDefault(key)?.Trim() ?? "";
    private static string Digits(string value) => new(value.Where(char.IsDigit).ToArray());
    private static void Compare(List<object> changes, string field, string oldValue, string newValue) { if (!string.IsNullOrWhiteSpace(newValue) && !string.Equals(oldValue.Trim(), newValue.Trim(), StringComparison.OrdinalIgnoreCase)) changes.Add(new { field, oldValue, newValue }); }
    private static void CompareDate(List<object> changes, string field, DateTime? oldValue, string newValue) { if (string.IsNullOrWhiteSpace(newValue) || !DateTime.TryParse(newValue, CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.AssumeLocal, out var parsed)) return; if (oldValue?.ToLocalTime().Date != parsed.Date) changes.Add(new { field, oldValue = oldValue?.ToString("yyyy-MM-dd"), newValue = parsed.ToString("yyyy-MM-dd") }); }
    private static string Set(string target, string value) => string.IsNullOrWhiteSpace(value) ? target : value.Trim();
    private static DrivingExamCandidateStatus? ParseExamStatus(string value) { var n = N(value); return n is "gecti" or "basarili" or "passed" ? DrivingExamCandidateStatus.Passed : n is "kaldi" or "basarisiz" or "failed" ? DrivingExamCandidateStatus.Failed : null; }
    private static DrivingExamType? ParseExamType(string value) { var n = N(value); return n is "esinav" or "teorik" or "theoryeexam" ? DrivingExamType.TheoryEExam : n is "direksiyon" or "uygulama" or "drivingpractice" ? DrivingExamType.DrivingPractice : null; }
    private static bool TryScore(string value, out decimal score) => decimal.TryParse(value.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out score) && score is >= 0 and <= 100;
    private static DrivingStudentStatus? ParseStudentStatus(string value) { var n = N(value); return n switch { "aktif" or "active" => DrivingStudentStatus.Active, "teorikegitimde" or "theoryongoing" => DrivingStudentStatus.TheoryOngoing, "direksiyonda" or "practiceongoing" => DrivingStudentStatus.PracticeOngoing, "sinavbekliyor" or "exampending" => DrivingStudentStatus.ExamPending, "askida" or "suspended" => DrivingStudentStatus.Suspended, "iptal" or "cancelled" => DrivingStudentStatus.Cancelled, _ => null }; }
    private static string MaskIdentity(string value) { var d = Digits(value); return d.Length <= 4 ? "****" : $"{d[..2]}*****{d[^2..]}"; }
    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private string CurrentUserName() { var value = (User.FindFirstValue("name") ?? User.Identity?.Name ?? "Sistem").Trim(); return string.IsNullOrEmpty(value) ? "Sistem" : value[..Math.Min(150, value.Length)]; }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }
}

public sealed record ApplyMebbisImportRequest(int ExpectedPreviewVersion, IReadOnlyList<Guid>? ExcludedRowIds)
{
    public bool CreateRetryFees { get; init; }
}
public sealed record RejectMebbisImportRequest(int ExpectedPreviewVersion, string? Reason);
