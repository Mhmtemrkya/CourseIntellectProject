using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Data;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/driving-school/mebbis")]
public sealed class DrivingMebbisController(
    CourseIntellectDbContext db,
    IDrivingPermissionService permissionService,
    IAuditLogService audit,
    IFileStorageService files,
    IDrivingPhotoInspectionService photoInspector) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    [HttpPost("work-center/sync")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Sync(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (CurrentUserId() is not Guid userId) return Forbid();
        var items = await BuildItemsAsync(ct);
        var newItems = items.Where(x => x.Version == 0 && x.WorkType != DrivingMebbisWorkType.TermDeadline).ToList();
        foreach (var source in newItems)
        {
            db.DrivingMebbisWorkItems.Add(new DrivingMebbisWorkItem
            {
                WorkType = source.WorkType,
                SubjectId = source.SubjectId,
                StudentDrivingProfileId = source.StudentDrivingProfileId,
                StudentGroupId = source.StudentGroupId,
                Status = source.Status,
                DueAtUtc = source.DueAtUtc,
                LastChangedByUserId = userId,
            });
        }
        if (newItems.Count > 0)
        {
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                db.ChangeTracker.Clear();
                return Conflict(new { message = "İş kuyruğu başka bir kullanıcı tarafından eşitlendi. Listeyi yenileyin." });
            }
            await audit.LogChangeAsync("MEBBİS iş kuyruğu eşitlendi", AuditCategory, nameof(DrivingMebbisWorkItem), "batch",
                $"{newItems.Count} yeni iş kuyruğa alındı.", null,
                new { count = newItems.Count, types = newItems.GroupBy(x => x.WorkType).ToDictionary(x => x.Key.ToString(), x => x.Count()) }, ct);
        }
        return Ok(new { created = newItems.Count, generatedAtUtc = DateTime.UtcNow });
    }

    [HttpGet("work-center")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> WorkCenter(
        [FromQuery] string? status, [FromQuery] string? type, [FromQuery] string? search,
        [FromQuery] Guid? groupId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (page < 1 || pageSize is < 1 or > 100) return BadRequest(new { message = "Sayfalama değerleri geçersiz." });
        if ((search?.Length ?? 0) > 100) return BadRequest(new { message = "Arama en fazla 100 karakter olabilir." });
        if (!TryOptionalEnum(status, out DrivingMebbisWorkStatus? parsedStatus)
            || !TryOptionalEnum(type, out DrivingMebbisWorkType? parsedType))
            return BadRequest(new { message = "Durum veya iş türü geçersiz." });

        var all = await BuildItemsAsync(ct);
        var ordered = FilterAndOrder(all, parsedStatus, parsedType, search, groupId);
        var now = DateTime.UtcNow;
        var deadlines = all.Where(x => x.WorkType == DrivingMebbisWorkType.TermDeadline && x.DueAtUtc.HasValue)
            .OrderBy(x => x.DueAtUtc).Take(10).Select(x => new
            {
                x.SubjectId, x.Title, x.Reference, x.DueAtUtc,
                daysRemaining = (int)Math.Ceiling((x.DueAtUtc!.Value - now).TotalDays),
                overdue = x.DueAtUtc < now,
            });

        return Ok(new
        {
            generatedAtUtc = now,
            summary = new
            {
                total = all.Count,
                preparing = all.Count(x => x.Status == DrivingMebbisWorkStatus.Preparing),
                ready = all.Count(x => x.Status == DrivingMebbisWorkStatus.Ready),
                entryPending = all.Count(x => x.Status == DrivingMebbisWorkStatus.EntryPending),
                entered = all.Count(x => x.Status == DrivingMebbisWorkStatus.Entered),
                verified = all.Count(x => x.Status == DrivingMebbisWorkStatus.Verified),
                error = all.Count(x => x.Status == DrivingMebbisWorkStatus.Error),
                correctionPending = all.Count(x => x.Status == DrivingMebbisWorkStatus.CorrectionPending),
                missingInformation = all.Count(x => x.WorkType == DrivingMebbisWorkType.CandidateRegistration && x.Missing.Count > 0),
                documentApproval = all.Count(x => x.WorkType == DrivingMebbisWorkType.DocumentApproval),
                termAssignment = all.Count(x => x.WorkType == DrivingMebbisWorkType.TermAssignment),
                examResult = all.Count(x => x.WorkType == DrivingMebbisWorkType.ExamResult),
                certificateNumber = all.Count(x => x.WorkType == DrivingMebbisWorkType.CertificateNumber),
            },
            deadlines,
            pagination = new { page, pageSize, total = ordered.Count, totalPages = (int)Math.Ceiling(ordered.Count / (double)pageSize) },
            items = ordered.Skip((page - 1) * pageSize).Take(pageSize),
        });
    }

    [HttpGet("work-center/export")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> ExportWorkCenter(
        [FromQuery] string? status, [FromQuery] string? type, [FromQuery] string? search,
        [FromQuery] Guid? groupId, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await permissionService.HasAsync(User, DrivingPermissions.ReportExport, ct)) return Forbid();
        if ((search?.Length ?? 0) > 100) return BadRequest(new { message = "Arama en fazla 100 karakter olabilir." });
        if (!TryOptionalEnum(status, out DrivingMebbisWorkStatus? parsedStatus)
            || !TryOptionalEnum(type, out DrivingMebbisWorkType? parsedType))
            return BadRequest(new { message = "Durum veya iş türü geçersiz." });

        var items = FilterAndOrder(await BuildItemsAsync(ct), parsedStatus, parsedType, search, groupId);
        var rows = items.Select(x => new[]
        {
            WorkTypeLabel(x.WorkType),
            StatusLabel(x.Status),
            x.Title,
            x.Reference,
            string.Join(" | ", x.Missing),
            x.ErrorReason,
            x.Note,
            ExportDate(x.DueAtUtc),
            ExportDate(x.EnteredAtUtc),
            ExportDate(x.VerifiedAtUtc),
            ExportDate(x.UpdatedAtUtc),
            x.SubjectId.ToString("D", CultureInfo.InvariantCulture),
            x.StudentDrivingProfileId?.ToString("D", CultureInfo.InvariantCulture) ?? string.Empty,
            x.StudentGroupId?.ToString("D", CultureInfo.InvariantCulture) ?? string.Empty,
        }).ToList();
        var bytes = DrivingTransferCsv.Build(
            ["İş Türü", "Durum", "Kursiyer / Kayıt", "Referans", "Eksik Bilgiler", "Hata Gerekçesi", "Not", "Son Tarih (UTC)", "MEBBİS Giriş (UTC)", "Doğrulama (UTC)", "Son Güncelleme (UTC)", "Kayıt Kimliği", "Kursiyer Profil Kimliği", "Dönem Kimliği"],
            rows);
        DisableSensitiveResponseCaching();
        await audit.LogChangeAsync("MEBBİS iş merkezi dışa aktarıldı", AuditCategory, nameof(DrivingMebbisWorkItem), "export",
            $"{rows.Count} satır güvenli CSV olarak dışa aktarıldı.", null,
            new { rowCount = rows.Count, status = parsedStatus?.ToString(), type = parsedType?.ToString(), groupId, filtered = !string.IsNullOrWhiteSpace(search) }, ct);
        return File(bytes, "text/csv; charset=utf-8", $"mebbis-is-merkezi-{DateTime.UtcNow:yyyyMMdd-HHmmss}.csv");
    }

    [HttpPut("work-center/items/{workType}/{subjectId:guid}/status")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> ChangeStatus(
        string workType, Guid subjectId, [FromBody] ChangeMebbisWorkStatusRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (CurrentUserId() is not Guid userId) return Forbid();
        if (!Enum.TryParse<DrivingMebbisWorkType>(workType, true, out var parsedType) || !Enum.IsDefined(parsedType)
            || !Enum.TryParse<DrivingMebbisWorkStatus>(request.Status, true, out var target) || !Enum.IsDefined(target))
            return BadRequest(new { message = "İş türü veya hedef durum geçersiz." });
        if ((request.Note?.Length ?? 0) > 1000) return BadRequest(new { message = "Not en fazla 1000 karakter olabilir." });
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (DrivingMebbisRules.RequiresReason(target) && reason.Length < 10)
            return BadRequest(new { message = "Hata veya düzeltme geçişinde en az 10 karakter gerekçe zorunludur." });
        if (reason.Length > 1000) return BadRequest(new { message = "Gerekçe en fazla 1000 karakter olabilir." });
        if (!await SubjectExistsAsync(parsedType, subjectId, ct)) return NotFound(new { message = "MEBBİS işinin bağlı olduğu kayıt bulunamadı." });

        var existing = await db.DrivingMebbisWorkItems.SingleOrDefaultAsync(x => x.WorkType == parsedType && x.SubjectId == subjectId, ct);
        var initial = await ResolveInitialStatusAsync(parsedType, subjectId, ct);
        var current = existing?.Status ?? initial;
        if (existing is null && request.ExpectedVersion != 0)
            return Conflict(new { message = "Kayıt başka bir kullanıcı tarafından oluşturuldu. Listeyi yenileyin." });
        if (existing is not null && existing.Version != request.ExpectedVersion)
            return Conflict(new { message = "Kayıt başka bir kullanıcı tarafından değiştirildi. Listeyi yenileyin.", currentVersion = existing.Version });
        if (!DrivingMebbisRules.CanTransition(current, target))
            return Conflict(new { message = $"{current} durumundan {target} durumuna geçilemez." });

        if (target == DrivingMebbisWorkStatus.Verified)
        {
            if (!await permissionService.HasAsync(User, DrivingPermissions.MebbisVerify, ct)) return Forbid();
            if (existing?.LastChangedByUserId is Guid changer && changer == userId)
                return Conflict(new { message = "Girişi yapan kullanıcı aynı kaydı doğrulayamaz. İkinci kullanıcı kontrolü zorunludur." });
        }
        if (parsedType == DrivingMebbisWorkType.CandidateRegistration
            && target is DrivingMebbisWorkStatus.Ready or DrivingMebbisWorkStatus.EntryPending or DrivingMebbisWorkStatus.Entered)
        {
            var source = await EntrySourceAsync(subjectId, ct);
            if (source is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
            var quality = await BuildQualityReportAsync(source, ct);
            if (quality.BlockingCount > 0)
                return Conflict(new { message = "Kırmızı veri kalitesi hataları düzeltilmeden kayıt hazır durumuna alınamaz.", missing = quality.Checks.Where(x => x.Severity == MebbisQualitySeverity.Red).Select(x => x.Message) });
        }
        if (target == DrivingMebbisWorkStatus.Ready && parsedType == DrivingMebbisWorkType.DocumentApproval
            && await db.StudentDrivingDocuments.AsNoTracking().AnyAsync(x => x.StudentDrivingProfileId == subjectId && x.IsCurrent && x.Status == StudentDocumentStatus.PendingApproval, ct))
            return Conflict(new { message = "Bekleyen evrakların tamamı incelenmeden iş hazır durumuna alınamaz." });
        if (target == DrivingMebbisWorkStatus.Entered && parsedType == DrivingMebbisWorkType.TermAssignment
            && !await db.StudentDrivingProfiles.AsNoTracking().AnyAsync(x => x.Id == subjectId && x.StudentGroupId != null, ct))
            return Conflict(new { message = "Kursiyer önce bir MEBBİS dönemine atanmalıdır." });
        if (target == DrivingMebbisWorkStatus.Entered && parsedType == DrivingMebbisWorkType.ExamResult
            && await db.DrivingExamCandidates.AsNoTracking().AnyAsync(x => x.Id == subjectId && x.Status == DrivingExamCandidateStatus.Planned, ct))
            return Conflict(new { message = "Önce sınav sonucu sisteme işlenmelidir." });
        if (target == DrivingMebbisWorkStatus.Entered && parsedType == DrivingMebbisWorkType.CertificateNumber
            && !await db.DrivingCertificates.AsNoTracking().AnyAsync(x => x.Id == subjectId && x.MebbisCertificateNo != "", ct))
            return Conflict(new { message = "Önce MEBBİS sertifika numarası girilmelidir." });

        var now = DateTime.UtcNow;
        var item = existing ?? new DrivingMebbisWorkItem
        {
            WorkType = parsedType,
            SubjectId = subjectId,
            Status = current,
        };
        if (existing is null)
        {
            await FillReferencesAsync(item, ct);
            db.DrivingMebbisWorkItems.Add(item);
        }
        var before = item.Status;
        item.Status = target;
        item.Note = request.Note?.Trim() ?? item.Note;
        item.ErrorReason = target is DrivingMebbisWorkStatus.Error or DrivingMebbisWorkStatus.CorrectionPending ? reason : string.Empty;
        item.EnteredAtUtc = target == DrivingMebbisWorkStatus.Entered ? now : item.EnteredAtUtc;
        item.VerifiedAtUtc = target == DrivingMebbisWorkStatus.Verified ? now : null;
        item.LastChangedByUserId = userId;
        item.UpdatedAtUtc = now;
        item.Version = existing is null ? 1 : existing.Version + 1;

        if (parsedType == DrivingMebbisWorkType.CandidateRegistration && target == DrivingMebbisWorkStatus.Entered)
        {
            var profile = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == subjectId, ct);
            profile.MebbisEnteredAtUtc ??= now;
        }

        if (item.StudentDrivingProfileId is Guid historyProfileId)
        {
            var history = HistoryFor(parsedType, target, before, reason, CurrentUserName());
            db.AddMebbisHistory(historyProfileId, history.Type, history.Title, history.Description, target.ToString(),
                nameof(DrivingMebbisWorkItem), item.Id, userId, CurrentUserName(), history.Severity, now);
            if (target == DrivingMebbisWorkStatus.Error)
                await AddErrorOccurrenceAsync(DrivingMebbisErrorCatalog.General, historyProfileId, reason,
                    nameof(DrivingMebbisWorkItem), item.Id, userId, now, ct);
        }

        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS iş durumu değişti", AuditCategory, nameof(DrivingMebbisWorkItem), item.Id.ToString(),
            $"{parsedType}: {before} → {target}. {(reason.Length == 0 ? string.Empty : reason)}",
            new { status = before, version = request.ExpectedVersion }, new { item.Status, item.Version, item.ErrorReason }, ct);
        return Ok(new { item.Id, workType = item.WorkType.ToString(), status = item.Status.ToString(), item.Version, item.UpdatedAtUtc });
    }

    [HttpGet("entry-assistant/students/{profileId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> EntryAssistant(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        DisableSensitiveResponseCaching();

        var source = await EntrySourceAsync(profileId, ct);
        if (source is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });

        var progress = await db.DrivingMebbisFieldProgresses.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId).ToListAsync(ct);
        var userIds = progress.Where(x => x.CompletedByUserId.HasValue).Select(x => x.CompletedByUserId!.Value).Distinct().ToList();
        var userNames = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == db.CurrentTenantId && userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var values = BuildEntryValues(source);
        var progressMap = progress.ToDictionary(x => x.FieldKey, StringComparer.Ordinal);
        var fields = DrivingMebbisEntryFields.Ordered.Select(definition =>
        {
            progressMap.TryGetValue(definition.Key, out var state);
            var value = values[definition.Key];
            return new
            {
                definition.Key,
                definition.Label,
                value,
                hasValue = !string.IsNullOrWhiteSpace(value),
                completed = state?.IsCompleted == true,
                completedByUserId = state?.CompletedByUserId,
                completedByName = state?.CompletedByUserId is Guid completedBy && userNames.TryGetValue(completedBy, out var name) ? name : null,
                completedAtUtc = state?.CompletedAtUtc,
                version = state?.Version ?? 0,
            };
        }).ToList();
        var missing = await CandidateMissingAsync(profileId, ct);
        var quality = await BuildQualityReportAsync(source, ct);
        var currentPhotoDocumentId = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.DocumentType == StudentDocumentType.BiometricPhoto && x.IsCurrent)
            .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
        var latestPhotoInspection = currentPhotoDocumentId is null ? null : await db.DrivingPhotoInspections.AsNoTracking()
            .Where(x => x.StudentDrivingDocumentId == currentPhotoDocumentId).OrderByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
        var workItem = await db.DrivingMebbisWorkItems.AsNoTracking().SingleOrDefaultAsync(
            x => x.WorkType == DrivingMebbisWorkType.CandidateRegistration && x.SubjectId == profileId, ct);

        return Ok(new
        {
            profileId,
            studentName = source.Student.FullName,
            studentNumber = source.Profile.StudentNumber,
            warning = "Bu ekran kişisel veri içerir. Bilgileri yalnızca yetkili MEBBİS işlemi için kullanın.",
            fields,
            progress = new
            {
                completed = fields.Count(x => x.completed),
                total = fields.Count,
                percent = fields.Count == 0 ? 0 : (int)Math.Round(fields.Count(x => x.completed) * 100d / fields.Count),
            },
            readinessMissing = missing,
            canComplete = fields.All(x => x.hasValue && x.completed) && quality.BlockingCount == 0,
            quality,
            photoInspection = latestPhotoInspection is null ? null : ToPhotoInspectionDto(latestPhotoInspection),
            workItem = new
            {
                status = (workItem?.Status ?? (missing.Count == 0 ? DrivingMebbisWorkStatus.Ready : DrivingMebbisWorkStatus.Preparing)).ToString(),
                version = workItem?.Version ?? 0,
            },
        });
    }

    [HttpGet("quality/students/{profileId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Quality(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        DisableSensitiveResponseCaching();
        var source = await EntrySourceAsync(profileId, ct);
        if (source is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        return Ok(await BuildQualityReportAsync(source, ct));
    }

    [HttpGet("photo-inspections/students/{profileId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> LatestPhotoInspection(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        DisableSensitiveResponseCaching();
        if (await EntrySourceAsync(profileId, ct) is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        var currentPhotoDocumentId = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.DocumentType == StudentDocumentType.BiometricPhoto && x.IsCurrent)
            .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
        var inspection = currentPhotoDocumentId is null ? null : await db.DrivingPhotoInspections.AsNoTracking()
            .Where(x => x.StudentDrivingDocumentId == currentPhotoDocumentId).OrderByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
        return inspection is null ? NoContent() : Ok(ToPhotoInspectionDto(inspection));
    }

    [HttpPost("photo-inspections/students/{profileId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    [EnableRateLimiting("photo-analysis")]
    public async Task<IActionResult> InspectPhoto(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (CurrentUserId() is not Guid userId) return Forbid();
        DisableSensitiveResponseCaching();
        if (await EntrySourceAsync(profileId, ct) is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        var document = await db.StudentDrivingDocuments.AsNoTracking().SingleOrDefaultAsync(
            x => x.StudentDrivingProfileId == profileId && x.DocumentType == StudentDocumentType.BiometricPhoto && x.IsCurrent, ct);
        if (document is null) return BadRequest(new { message = "Denetim için güncel biyometrik fotoğraf belgesi yükleyin." });
        var prefix = await files.ReadPrefixAsync(document.FileUrl, 1, ct);
        if (prefix is null) return BadRequest(new { message = "Fotoğraf güvenli dosya deposunda bulunamadı." });
        if (prefix.Length > 10 * 1024 * 1024) return BadRequest(new { message = "Biyometrik fotoğraf en fazla 10 MB olabilir." });
        var bytes = await files.ReadBytesAsync(document.FileUrl, ct);
        if (bytes is null) return BadRequest(new { message = "Fotoğraf güvenli dosya deposundan okunamadı." });

        DrivingPhotoAnalysisResult result;
        try { result = await photoInspector.AnalyzeAsync(bytes, document.FileName, document.UploadedAtUtc, ct); }
        catch (InvalidDataException ex) { return BadRequest(new { message = ex.Message }); }

        string mebbisFileUrl = string.Empty;
        long? mebbisBytes = null;
        if (result.MebbisJpeg is { Length: > 0 } converted)
        {
            await using var stream = new MemoryStream(converted, writable: false);
            var saved = await files.SaveAsync(stream, $"mebbis-{profileId:N}.jpg", "image/jpeg", "driving-mebbis-photos", string.Empty, ct);
            mebbisFileUrl = saved.FileUrl;
            mebbisBytes = saved.Size;
        }

        var inspection = new DrivingPhotoInspection
        {
            StudentDrivingProfileId = profileId,
            StudentDrivingDocumentId = document.Id,
            SourceSha256 = result.SourceSha256,
            SourceBytes = result.SourceBytes,
            Width = result.Width,
            Height = result.Height,
            FaceCount = result.FaceCount,
            FaceConfidence = result.FaceConfidence,
            AverageBrightness = result.AverageBrightness,
            BackgroundUniformity = result.BackgroundUniformity,
            Overall = result.Overall,
            ChecksJson = JsonSerializer.Serialize(result.Checks, PhotoJsonOptions),
            MebbisFileUrl = mebbisFileUrl,
            MebbisBytes = mebbisBytes,
            MebbisWidth = result.MebbisWidth,
            MebbisHeight = result.MebbisHeight,
            AnalyzerVersion = result.AnalyzerVersion,
            CreatedByUserId = userId,
        };
        db.DrivingPhotoInspections.Add(inspection);
        if (!string.Equals(result.Overall, "Green", StringComparison.OrdinalIgnoreCase))
            await AddErrorOccurrenceAsync(DrivingMebbisErrorCatalog.PhotoFormatInvalid, profileId,
                $"Fotoğraf kalite denetimi {result.Overall} sonucu verdi.", nameof(DrivingPhotoInspection),
                inspection.Id, userId, inspection.CreatedAtUtc, ct);
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Biyometrik fotoğraf kalite denetimi", AuditCategory, nameof(DrivingPhotoInspection), inspection.Id.ToString(),
            $"Fotoğraf yerel modelle denetlendi: {inspection.Overall}.", null,
            new { inspection.Overall, inspection.FaceCount, inspection.Width, inspection.Height, mebbisCopyCreated = mebbisFileUrl.Length > 0, inspection.AnalyzerVersion }, ct);
        return Ok(ToPhotoInspectionDto(inspection));
    }

    [HttpGet("photo-inspections/{inspectionId:guid}/mebbis-file")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> DownloadMebbisPhoto(Guid inspectionId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        DisableSensitiveResponseCaching();
        var inspection = await db.DrivingPhotoInspections.AsNoTracking().SingleOrDefaultAsync(x => x.Id == inspectionId, ct);
        if (inspection is null || string.IsNullOrWhiteSpace(inspection.MebbisFileUrl)) return NotFound(new { message = "MEBBİS fotoğraf kopyası bulunamadı." });
        var bytes = await files.ReadBytesAsync(inspection.MebbisFileUrl, ct);
        if (bytes is null) return NotFound(new { message = "MEBBİS fotoğraf kopyası dosya deposunda bulunamadı." });
        return File(bytes, "image/jpeg", $"mebbis-fotograf-{inspection.StudentDrivingProfileId:N}.jpg");
    }

    [HttpPut("entry-assistant/students/{profileId:guid}/fields/{fieldKey}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> UpdateEntryField(
        Guid profileId, string fieldKey, [FromBody] UpdateMebbisEntryFieldRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (CurrentUserId() is not Guid userId) return Forbid();
        DisableSensitiveResponseCaching();
        if (!DrivingMebbisEntryFields.IsKnown(fieldKey)) return BadRequest(new { message = "MEBBİS alanı geçersiz." });
        if (request.ExpectedVersion < 0) return BadRequest(new { message = "Sürüm bilgisi geçersiz." });

        var source = await EntrySourceAsync(profileId, ct);
        if (source is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        if (request.Completed && string.IsNullOrWhiteSpace(BuildEntryValues(source)[fieldKey]))
            return Conflict(new { message = "Boş bir alan tamamlandı olarak işaretlenemez. Önce kursiyer bilgisini tamamlayın." });

        var state = await db.DrivingMebbisFieldProgresses.SingleOrDefaultAsync(
            x => x.StudentDrivingProfileId == profileId && x.FieldKey == fieldKey, ct);
        if (state is null && request.ExpectedVersion != 0)
            return Conflict(new { message = "Alan başka bir kullanıcı tarafından değiştirildi. Ekranı yenileyin." });
        if (state is not null && state.Version != request.ExpectedVersion)
            return Conflict(new { message = "Alan başka bir kullanıcı tarafından değiştirildi. Ekranı yenileyin.", currentVersion = state.Version });

        var now = DateTime.UtcNow;
        state ??= new DrivingMebbisFieldProgress
        {
            StudentDrivingProfileId = profileId,
            FieldKey = fieldKey,
            Version = 0,
        };
        if (state.Version == 0) db.DrivingMebbisFieldProgresses.Add(state);
        state.IsCompleted = request.Completed;
        state.CompletedByUserId = request.Completed ? userId : null;
        state.CompletedAtUtc = request.Completed ? now : null;
        state.UpdatedAtUtc = now;
        state.Version++;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Conflict(new { message = "Alan başka bir kullanıcı tarafından değiştirildi. Ekranı yenileyin." });
        }
        await audit.LogChangeAsync("MEBBİS giriş alanı güncellendi", AuditCategory, nameof(DrivingMebbisFieldProgress), state.Id.ToString(),
            $"Alan ilerlemesi {(request.Completed ? "tamamlandı" : "geri alındı")} olarak işaretlendi.",
            new { fieldKey, version = request.ExpectedVersion }, new { fieldKey, state.IsCompleted, state.Version }, ct);
        var userName = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == db.CurrentTenantId && x.Id == userId).Select(x => x.FullName).SingleOrDefaultAsync(ct);
        return Ok(new { fieldKey, completed = state.IsCompleted, completedByUserId = state.CompletedByUserId,
            completedByName = request.Completed ? userName : null, completedAtUtc = state.CompletedAtUtc, state.Version });
    }

    [HttpPost("entry-assistant/students/{profileId:guid}/complete")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> CompleteEntryAssistant(
        Guid profileId, [FromBody] CompleteMebbisEntryAssistantRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (CurrentUserId() is not Guid userId) return Forbid();
        DisableSensitiveResponseCaching();
        if (request.ExpectedWorkItemVersion < 0) return BadRequest(new { message = "Sürüm bilgisi geçersiz." });

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var source = await EntrySourceAsync(profileId, ct);
        if (source is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        var values = BuildEntryValues(source);
        var emptyFields = DrivingMebbisEntryFields.Ordered.Where(x => string.IsNullOrWhiteSpace(values[x.Key])).Select(x => x.Label).ToList();
        if (emptyFields.Count > 0) return Conflict(new { message = "MEBBİS alanları eksik.", missing = emptyFields });
        var completedKeys = await db.DrivingMebbisFieldProgresses.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.IsCompleted).Select(x => x.FieldKey).ToListAsync(ct);
        var uncheckedFields = DrivingMebbisEntryFields.Ordered.Where(x => !completedKeys.Contains(x.Key, StringComparer.Ordinal)).Select(x => x.Label).ToList();
        if (uncheckedFields.Count > 0) return Conflict(new { message = "Tüm alanların MEBBİS'e girildiğini işaretleyin.", missing = uncheckedFields });
        var quality = await BuildQualityReportAsync(source, ct);
        if (quality.BlockingCount > 0)
            return Conflict(new { message = "Kırmızı veri kalitesi hataları düzeltilmeden MEBBİS girişi tamamlanamaz.", missing = quality.Checks.Where(x => x.Severity == MebbisQualitySeverity.Red).Select(x => x.Message) });

        var item = await db.DrivingMebbisWorkItems.SingleOrDefaultAsync(
            x => x.WorkType == DrivingMebbisWorkType.CandidateRegistration && x.SubjectId == profileId, ct);
        if (item is null && request.ExpectedWorkItemVersion != 0)
            return Conflict(new { message = "İş kaydı başka bir kullanıcı tarafından oluşturuldu. Ekranı yenileyin." });
        if (item is not null && item.Version != request.ExpectedWorkItemVersion)
            return Conflict(new { message = "İş kaydı başka bir kullanıcı tarafından değiştirildi. Ekranı yenileyin.", currentVersion = item.Version });
        var current = item?.Status ?? DrivingMebbisWorkStatus.Ready;
        if (current == DrivingMebbisWorkStatus.Preparing) current = DrivingMebbisWorkStatus.Ready;
        if (current is not (DrivingMebbisWorkStatus.Ready or DrivingMebbisWorkStatus.EntryPending))
            return Conflict(new { message = $"{current} durumundaki kayıt giriş asistanıyla tamamlanamaz." });

        var now = DateTime.UtcNow;
        item ??= new DrivingMebbisWorkItem
        {
            WorkType = DrivingMebbisWorkType.CandidateRegistration,
            SubjectId = profileId,
            StudentDrivingProfileId = profileId,
            StudentGroupId = source.Profile.StudentGroupId,
            Version = 0,
        };
        if (item.Version == 0) db.DrivingMebbisWorkItems.Add(item);
        item.Status = DrivingMebbisWorkStatus.Entered;
        item.EnteredAtUtc = now;
        item.VerifiedAtUtc = null;
        item.LastChangedByUserId = userId;
        item.ErrorReason = string.Empty;
        item.UpdatedAtUtc = now;
        item.Version++;
        source.Profile.MebbisEnteredAtUtc ??= now;

        db.AddMebbisHistory(profileId, DrivingMebbisHistoryEventType.CandidateEntry,
            "Aday kaydı MEBBİS’e girildi", "Giriş asistanındaki tüm alanlar tamamlanarak aday kaydı işlendi.",
            DrivingMebbisWorkStatus.Entered.ToString(), nameof(DrivingMebbisWorkItem), item.Id, userId, CurrentUserName(),
            DrivingMebbisHistorySeverity.Success, now);

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await audit.LogChangeAsync("MEBBİS giriş asistanı tamamlandı", AuditCategory, nameof(DrivingMebbisWorkItem), item.Id.ToString(),
            "Kursiyer alanlarının MEBBİS'e girildiği personel tarafından tamamlandı olarak işaretlendi; alan değerleri denetim kaydına yazılmadı.",
            new { status = current, version = request.ExpectedWorkItemVersion }, new { item.Status, item.Version, fieldCount = DrivingMebbisEntryFields.Ordered.Count }, ct);
        return Ok(new { status = item.Status.ToString(), item.Version, item.EnteredAtUtc });
    }

    private async Task<List<MebbisItemDto>> BuildItemsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var profiles = await db.StudentDrivingProfiles.AsNoTracking()
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p, s.FullName, s.TcNo, s.BirthDate })
            .OrderByDescending(x => x.p.RegisteredAtUtc).ToListAsync(ct);
        var profileIds = profiles.Select(x => x.p.Id).ToList();
        var docs = await db.StudentDrivingDocuments.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.IsCurrent).ToListAsync(ct);
        var groups = await db.DrivingStudentGroups.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);
        var groupMap = groups.ToDictionary(x => x.Id);
        var persisted = await db.DrivingMebbisWorkItems.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == null || profileIds.Contains(x.StudentDrivingProfileId.Value))
            .ToListAsync(ct);
        var stateMap = persisted.ToDictionary(x => (x.WorkType, x.SubjectId));
        var docsByProfile = docs.ToLookup(x => x.StudentDrivingProfileId);
        var items = new List<MebbisItemDto>();

        foreach (var row in profiles)
        {
            var profileDocs = docsByProfile[row.p.Id].ToList();
            var missing = CandidateMissing(row.p, row.TcNo, row.BirthDate, profileDocs);
            var initial = missing.Count > 0 ? DrivingMebbisWorkStatus.Preparing
                : row.p.MebbisEnteredAtUtc.HasValue ? DrivingMebbisWorkStatus.Entered : DrivingMebbisWorkStatus.Ready;
            items.Add(ToDto(DrivingMebbisWorkType.CandidateRegistration, row.p.Id, row.p.Id, row.p.StudentGroupId,
                row.FullName, $"Kursiyer #{row.p.StudentNumber}", "Aday kaydı", DisplayPhoto(row.p.LivePhotoUrl, row.p.PhotoUrl), initial, missing,
                row.p.StudentGroupId is Guid gid && groupMap.TryGetValue(gid, out var group) ? group.RegistrationDeadlineUtc : null, stateMap));

            var pendingDocs = profileDocs.Where(x => x.Status == StudentDocumentStatus.PendingApproval).ToList();
            if (pendingDocs.Count > 0)
                items.Add(ToDto(DrivingMebbisWorkType.DocumentApproval, row.p.Id, row.p.Id, row.p.StudentGroupId,
                    row.FullName, $"{pendingDocs.Count} evrak onay bekliyor", "Evrak onayı", DisplayPhoto(row.p.LivePhotoUrl, row.p.PhotoUrl), DrivingMebbisWorkStatus.Preparing,
                    pendingDocs.Select(x => DrivingStudentRules.DocumentLabel(x.DocumentType)).ToList(), null, stateMap));
            if (!row.p.StudentGroupId.HasValue)
                items.Add(ToDto(DrivingMebbisWorkType.TermAssignment, row.p.Id, row.p.Id, null,
                    row.FullName, $"Kursiyer #{row.p.StudentNumber}", "Dönem ataması", DisplayPhoto(row.p.LivePhotoUrl, row.p.PhotoUrl), DrivingMebbisWorkStatus.EntryPending,
                    ["Kursiyer henüz bir döneme atanmamış"], null, stateMap));
        }

        var examRows = await db.DrivingExamCandidates.AsNoTracking()
            .Where(x => x.Status == DrivingExamCandidateStatus.Planned)
            .Join(db.DrivingExamSessions.AsNoTracking().Where(x => x.EndsAtUtc <= now), c => c.ExamSessionId, e => e.Id, (c, e) => new { c, e })
            .Join(db.StudentDrivingProfiles.AsNoTracking(), x => x.c.StudentDrivingProfileId, p => p.Id, (x, p) => new { x.c, x.e, p.StudentId, p.StudentGroupId, p.PhotoUrl, p.LivePhotoUrl })
            .Join(db.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { x.c, x.e, x.StudentGroupId, x.PhotoUrl, x.LivePhotoUrl, s.FullName }).ToListAsync(ct);
        foreach (var row in examRows)
            items.Add(ToDto(DrivingMebbisWorkType.ExamResult, row.c.Id, row.c.StudentDrivingProfileId, row.StudentGroupId,
                row.FullName, row.e.Title, "Sınav sonucu", DisplayPhoto(row.LivePhotoUrl, row.PhotoUrl), DrivingMebbisWorkStatus.EntryPending, [], row.e.EndsAtUtc, stateMap));

        var certificateRows = await db.DrivingCertificates.AsNoTracking()
            .Where(x => x.Status == DrivingCertificateStatus.Active && x.MebbisCertificateNo == "")
            .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => new { c, p.StudentId, p.StudentGroupId, p.PhotoUrl, p.LivePhotoUrl })
            .Join(db.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { x.c, x.StudentGroupId, x.PhotoUrl, x.LivePhotoUrl, s.FullName }).ToListAsync(ct);
        foreach (var row in certificateRows)
            items.Add(ToDto(DrivingMebbisWorkType.CertificateNumber, row.c.Id, row.c.StudentDrivingProfileId, row.StudentGroupId,
                row.FullName, row.c.DocumentNumber, "Sertifika numarası", DisplayPhoto(row.LivePhotoUrl, row.PhotoUrl), DrivingMebbisWorkStatus.EntryPending, [], null, stateMap));

        foreach (var group in groups.Where(x => x.RegistrationDeadlineUtc.HasValue && x.RegistrationDeadlineUtc <= now.AddDays(14)))
            items.Add(ToDto(DrivingMebbisWorkType.TermDeadline, group.Id, null, group.Id, group.Name,
                $"{group.TermYear}/{group.TermNumber} • {group.MebbisTermCode}", "Dönem son tarihi", string.Empty, DrivingMebbisWorkStatus.Ready,
                [], group.RegistrationDeadlineUtc, stateMap));

        var profileNames = profiles.ToDictionary(x => x.p.Id, x => x.FullName);
        var profilePhotos = profiles.ToDictionary(x => x.p.Id, x => DisplayPhoto(x.p.LivePhotoUrl, x.p.PhotoUrl));
        foreach (var orphan in persisted.Where(x => !items.Any(i => i.WorkType == x.WorkType && i.SubjectId == x.SubjectId)))
            items.Add(ToDto(orphan.WorkType, orphan.SubjectId, orphan.StudentDrivingProfileId, orphan.StudentGroupId,
                orphan.StudentDrivingProfileId is Guid profileId && profileNames.TryGetValue(profileId, out var name) ? name : "MEBBİS iş kaydı",
                orphan.ErrorReason.Length > 0 ? orphan.ErrorReason : orphan.WorkType.ToString(),
                orphan.WorkType == DrivingMebbisWorkType.Reconciliation ? "Mutabakat" : orphan.WorkType.ToString(),
                orphan.StudentDrivingProfileId is Guid photoProfileId && profilePhotos.TryGetValue(photoProfileId, out var photo) ? photo : string.Empty,
                orphan.Status, [], orphan.DueAtUtc, stateMap));
        return items;
    }

    private static MebbisItemDto ToDto(DrivingMebbisWorkType type, Guid subjectId, Guid? profileId, Guid? groupId,
        string title, string reference, string category, string photoUrl, DrivingMebbisWorkStatus initial, List<string> missing, DateTime? dueAt,
        IReadOnlyDictionary<(DrivingMebbisWorkType, Guid), DrivingMebbisWorkItem> stateMap)
    {
        stateMap.TryGetValue((type, subjectId), out var saved);
        var status = saved?.Status ?? initial;
        return new(type, subjectId, profileId, groupId, title, reference, category, photoUrl, status, missing,
            saved?.ErrorReason ?? string.Empty, saved?.Note ?? string.Empty, dueAt ?? saved?.DueAtUtc,
            saved?.AssignedToUserId, saved?.EnteredAtUtc, saved?.VerifiedAtUtc, saved?.Version ?? 0, saved?.UpdatedAtUtc);
    }

    private static string DisplayPhoto(string? livePhotoUrl, string? photoUrl)
        => !string.IsNullOrWhiteSpace(livePhotoUrl) ? livePhotoUrl : photoUrl ?? string.Empty;

    private static List<MebbisItemDto> FilterAndOrder(
        IEnumerable<MebbisItemDto> source,
        DrivingMebbisWorkStatus? status,
        DrivingMebbisWorkType? type,
        string? search,
        Guid? groupId)
    {
        var filtered = source;
        if (status.HasValue) filtered = filtered.Where(x => x.Status == status.Value);
        if (type.HasValue) filtered = filtered.Where(x => x.WorkType == type.Value);
        if (groupId.HasValue) filtered = filtered.Where(x => x.StudentGroupId == groupId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            filtered = filtered.Where(x => x.Title.Contains(term, StringComparison.CurrentCultureIgnoreCase)
                || x.Reference.Contains(term, StringComparison.CurrentCultureIgnoreCase));
        }
        return filtered.OrderBy(x => StatusOrder(x.Status))
            .ThenBy(x => x.DueAtUtc ?? DateTime.MaxValue)
            .ThenBy(x => x.Title, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    private static string ExportDate(DateTime? value)
        => value.HasValue ? value.Value.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) : string.Empty;

    private static string WorkTypeLabel(DrivingMebbisWorkType value) => value switch
    {
        DrivingMebbisWorkType.CandidateRegistration => "Aday kaydı",
        DrivingMebbisWorkType.DocumentApproval => "Evrak onayı",
        DrivingMebbisWorkType.TermAssignment => "Dönem ataması",
        DrivingMebbisWorkType.ExamResult => "Sınav sonucu",
        DrivingMebbisWorkType.CertificateNumber => "Sertifika numarası",
        DrivingMebbisWorkType.TermDeadline => "Dönem son tarihi",
        DrivingMebbisWorkType.Reconciliation => "Mutabakat",
        _ => value.ToString(),
    };

    private static string StatusLabel(DrivingMebbisWorkStatus value) => value switch
    {
        DrivingMebbisWorkStatus.Preparing => "Hazırlanıyor",
        DrivingMebbisWorkStatus.Ready => "MEBBİS'e hazır",
        DrivingMebbisWorkStatus.EntryPending => "Giriş bekliyor",
        DrivingMebbisWorkStatus.Entered => "MEBBİS'e girildi",
        DrivingMebbisWorkStatus.Verified => "Doğrulandı",
        DrivingMebbisWorkStatus.Error => "Hatalı",
        DrivingMebbisWorkStatus.CorrectionPending => "Düzeltme bekliyor",
        _ => value.ToString(),
    };

    private async Task<List<string>> CandidateMissingAsync(Guid profileId, CancellationToken ct)
    {
        var row = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.Id == profileId)
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p, s.TcNo, s.BirthDate }).SingleAsync(ct);
        var docs = await db.StudentDrivingDocuments.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId && x.IsCurrent).ToListAsync(ct);
        return CandidateMissing(row.p, row.TcNo, row.BirthDate, docs);
    }

    private static List<string> CandidateMissing(StudentDrivingProfile p, string? tcNo, string? birthDate, List<StudentDrivingDocument> docs)
    {
        bool Approved(StudentDocumentType type) => docs.Any(d => d.DocumentType == type && DrivingStudentRules.CountsAsSatisfied(d.Status));
        var identity = p.IdentityKind == IdentityKind.TurkishId && string.IsNullOrWhiteSpace(p.IdentityNumber) ? tcNo : p.IdentityNumber;
        return DrivingStudentRules.MebbisMissingFields(new DrivingStudentRules.MebbisCandidate(
            p.IdentityKind != IdentityKind.TurkishId || DrivingStudentRules.IsValidTurkishId(identity), birthDate, p.FatherName, p.MotherName,
            p.BirthPlace, p.EducationLevel, p.IdentitySerialNo, p.Phone, Approved(StudentDocumentType.BiometricPhoto) || p.PhotoUrl != "",
            Approved(StudentDocumentType.HealthReport),
            Approved(StudentDocumentType.Diploma), Approved(StudentDocumentType.CriminalRecord)));
    }

    private async Task<DrivingMebbisWorkStatus> ResolveInitialStatusAsync(DrivingMebbisWorkType type, Guid subjectId, CancellationToken ct)
    {
        if (type == DrivingMebbisWorkType.CandidateRegistration)
        {
            var profile = await db.StudentDrivingProfiles.AsNoTracking().SingleAsync(x => x.Id == subjectId, ct);
            if ((await CandidateMissingAsync(subjectId, ct)).Count > 0) return DrivingMebbisWorkStatus.Preparing;
            return profile.MebbisEnteredAtUtc.HasValue ? DrivingMebbisWorkStatus.Entered : DrivingMebbisWorkStatus.Ready;
        }
        return type == DrivingMebbisWorkType.DocumentApproval ? DrivingMebbisWorkStatus.Preparing
            : type == DrivingMebbisWorkType.TermDeadline ? DrivingMebbisWorkStatus.Ready
            : DrivingMebbisWorkStatus.EntryPending;
    }

    private Task<bool> SubjectExistsAsync(DrivingMebbisWorkType type, Guid id, CancellationToken ct) => type switch
    {
        DrivingMebbisWorkType.CandidateRegistration or DrivingMebbisWorkType.DocumentApproval or DrivingMebbisWorkType.TermAssignment
            => db.StudentDrivingProfiles.AsNoTracking().Where(x => x.Id == id)
                .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (_, _) => 1).AnyAsync(ct),
        DrivingMebbisWorkType.ExamResult => db.DrivingExamCandidates.AsNoTracking().Where(x => x.Id == id)
            .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => p.StudentId)
            .Join(db.Students.AsNoTracking(), studentId => studentId, s => s.Id, (_, _) => 1).AnyAsync(ct),
        DrivingMebbisWorkType.CertificateNumber => db.DrivingCertificates.AsNoTracking().Where(x => x.Id == id)
            .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => p.StudentId)
            .Join(db.Students.AsNoTracking(), studentId => studentId, s => s.Id, (_, _) => 1).AnyAsync(ct),
        DrivingMebbisWorkType.TermDeadline => db.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.Id == id, ct),
        DrivingMebbisWorkType.Reconciliation => db.DrivingMebbisWorkItems.AsNoTracking()
            .Where(x => x.WorkType == type && x.SubjectId == id)
            .Where(x => x.StudentDrivingProfileId == null || db.StudentDrivingProfiles.AsNoTracking()
                .Where(p => p.Id == x.StudentDrivingProfileId)
                .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (_, _) => 1).Any())
            .AnyAsync(ct),
        _ => Task.FromResult(false),
    };

    private async Task FillReferencesAsync(DrivingMebbisWorkItem item, CancellationToken ct)
    {
        if (item.WorkType is DrivingMebbisWorkType.CandidateRegistration or DrivingMebbisWorkType.DocumentApproval or DrivingMebbisWorkType.TermAssignment)
        {
            var p = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.Id == item.SubjectId).Select(x => new { x.Id, x.StudentGroupId }).SingleAsync(ct);
            item.StudentDrivingProfileId = p.Id; item.StudentGroupId = p.StudentGroupId;
        }
        else if (item.WorkType == DrivingMebbisWorkType.ExamResult)
        {
            var p = await db.DrivingExamCandidates.AsNoTracking().Where(x => x.Id == item.SubjectId)
                .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => new { p.Id, p.StudentGroupId }).SingleAsync(ct);
            item.StudentDrivingProfileId = p.Id; item.StudentGroupId = p.StudentGroupId;
        }
        else if (item.WorkType == DrivingMebbisWorkType.CertificateNumber)
        {
            var p = await db.DrivingCertificates.AsNoTracking().Where(x => x.Id == item.SubjectId)
                .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => new { p.Id, p.StudentGroupId }).SingleAsync(ct);
            item.StudentDrivingProfileId = p.Id; item.StudentGroupId = p.StudentGroupId;
        }
        else if (item.WorkType == DrivingMebbisWorkType.TermDeadline) item.StudentGroupId = item.SubjectId;
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
    {
        var value = (User.FindFirstValue("name") ?? User.Identity?.Name ?? "Sistem").Trim();
        return string.IsNullOrWhiteSpace(value) ? "Sistem" : value;
    }

    private static (DrivingMebbisHistoryEventType Type, DrivingMebbisHistorySeverity Severity, string Title, string Description) HistoryFor(
        DrivingMebbisWorkType workType, DrivingMebbisWorkStatus target, DrivingMebbisWorkStatus before, string reason, string actorName)
    {
        if (target == DrivingMebbisWorkStatus.Ready)
            return (DrivingMebbisHistoryEventType.Preparation, DrivingMebbisHistorySeverity.Success,
                "MEBBİS hazırlık kontrolü tamamlandı", $"{workType} işi MEBBİS girişine hazırlandı.");
        if (target == DrivingMebbisWorkStatus.Verified)
            return (DrivingMebbisHistoryEventType.Verification, DrivingMebbisHistorySeverity.Success,
                $"{actorName} tarafından doğrulandı", $"{workType} işlemi ikinci kullanıcı kontrolüyle doğrulandı.");
        if (target == DrivingMebbisWorkStatus.Entered)
            return (workType switch
                {
                    DrivingMebbisWorkType.CandidateRegistration => DrivingMebbisHistoryEventType.CandidateEntry,
                    DrivingMebbisWorkType.ExamResult => DrivingMebbisHistoryEventType.ExamResult,
                    DrivingMebbisWorkType.CertificateNumber => DrivingMebbisHistoryEventType.CertificateNumber,
                    _ => DrivingMebbisHistoryEventType.StatusChange,
                }, DrivingMebbisHistorySeverity.Success, $"{workType} MEBBİS’e işlendi", "İşlem MEBBİS’e girildi olarak kaydedildi.");
        if (target is DrivingMebbisWorkStatus.Error or DrivingMebbisWorkStatus.CorrectionPending)
            return (DrivingMebbisHistoryEventType.Correction, DrivingMebbisHistorySeverity.Error,
                target == DrivingMebbisWorkStatus.Error ? "MEBBİS işleminde hata bildirildi" : "MEBBİS kaydı düzeltmeye alındı",
                string.IsNullOrWhiteSpace(reason) ? $"{workType}: {before} → {target}" : reason);
        return (DrivingMebbisHistoryEventType.StatusChange, DrivingMebbisHistorySeverity.Info,
            "MEBBİS iş durumu güncellendi", $"{workType}: {before} → {target}");
    }

    private async Task<EntrySource?> EntrySourceAsync(Guid profileId, CancellationToken ct)
    {
        var row = await db.StudentDrivingProfiles
            .Where(x => x.Id == profileId)
            .Join(db.Students, p => p.StudentId, s => s.Id, (p, s) => new { Profile = p, Student = s })
            .SingleOrDefaultAsync(ct);
        if (row is null) return null;
        var health = await db.StudentDrivingDocuments.AsNoTracking().SingleOrDefaultAsync(
            x => x.StudentDrivingProfileId == profileId && x.DocumentType == StudentDocumentType.HealthReport && x.IsCurrent, ct);
        return new EntrySource(row.Profile, row.Student, health);
    }

    private async Task<MebbisQualityReport> BuildQualityReportAsync(EntrySource source, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var profile = source.Profile;
        var student = source.Student;
        var currentDocs = await db.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id && x.IsCurrent).ToListAsync(ct);
        var checks = new List<MebbisQualityCheck>();
        void Add(string key, string title, string category, MebbisQualitySeverity severity, string message)
            => checks.Add(new(key, title, category, severity, message));

        var identity = profile.IdentityKind == IdentityKind.TurkishId && string.IsNullOrWhiteSpace(profile.IdentityNumber)
            ? student.TcNo : profile.IdentityNumber;
        if (profile.IdentityKind == IdentityKind.TurkishId)
            Add("nationalId", "TC kimlik algoritması", "Kimlik", DrivingStudentRules.IsValidTurkishId(identity) ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Red,
                DrivingStudentRules.IsValidTurkishId(identity) ? "TC kimlik kontrol basamakları geçerli." : "TC kimlik numarası algoritmik olarak geçersiz.");
        else
            Add("nationalId", "Kimlik numarası", "Kimlik", identity.Trim().Length >= 5 ? MebbisQualitySeverity.Orange : MebbisQualitySeverity.Red,
                identity.Trim().Length >= 5 ? "Yabancı kimlik/pasaport personel tarafından belgeyle karşılaştırılmalı." : "Kimlik/pasaport numarası eksik.");

        var birthValid = DrivingMebbisQualityRules.TryParseBirthDate(student.BirthDate, out var birth);
        var age = birthValid ? DrivingMebbisQualityRules.AgeOn(birth, today) : -1;
        var minAge = DrivingMebbisQualityRules.MinimumAgeFor(profile.LicenseClass);
        var birthSeverity = !birthValid || age is < 0 or > 100 || age < minAge ? MebbisQualitySeverity.Red : MebbisQualitySeverity.Green;
        Add("age", "Doğum tarihi ve sınıf yaşı", "Kimlik", birthSeverity,
            !birthValid ? "Doğum tarihi okunamıyor." : age > 100 ? "Doğum tarihi makul aralığın dışında." : age < minAge
                ? $"{profile.LicenseClass} sınıfı için en az {minAge} yaş gerekir; aday {age} yaşında." : $"Aday {age} yaşında; {profile.LicenseClass} sınıfı yaş koşulunu karşılıyor.");
        if (profile.LicenseClass.Equals("A", StringComparison.OrdinalIgnoreCase) && age is >= 20 and < 24)
            Add("aClassPrerequisite", "A sınıfı ön koşulu", "Ehliyet", MebbisQualitySeverity.Orange, "24 yaş altındaki A sınıfı adayı için en az iki yıllık A2 deneyimi belge üzerinden doğrulanmalı.");
        else
            Add("aClassPrerequisite", "Sınıf ön koşulu", "Ehliyet", MebbisQualitySeverity.Green, "Yaşa bağlı ek A2 ön koşulu görünmüyor.");

        Add("phone", "Telefon formatı", "İletişim", DrivingMebbisQualityRules.IsValidPhone(profile.Phone) ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Red,
            DrivingMebbisQualityRules.IsValidPhone(profile.Phone) ? "Telefon Türkiye mobil numara formatına uygun." : "Telefon 5XX XXX XX XX formatına uygun değil.");
        Add("identitySerial", "Kimlik seri numarası", "Kimlik", DrivingMebbisQualityRules.IsPlausibleIdentitySerial(profile.IdentitySerialNo) ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Orange,
            DrivingMebbisQualityRules.IsPlausibleIdentitySerial(profile.IdentitySerialNo) ? "Kimlik seri numarası biçimi uygun." : "Kimlik seri numarası yeni veya eski kart formatıyla eşleşmiyor; personel kontrolü gerekir.");

        var health = currentDocs.FirstOrDefault(x => x.DocumentType == StudentDocumentType.HealthReport);
        var healthSeverity = health?.Status == StudentDocumentStatus.Approved
            ? MebbisQualitySeverity.Green
            : MebbisQualitySeverity.Red;
        Add("healthReport", "Sağlık raporu onayı", "Belgeler", healthSeverity,
            health is null ? "Sağlık raporu bulunmuyor."
            : health.Status == StudentDocumentStatus.Approved ? "Sağlık raporu kurum tarafından onaylanmış."
            : "Sağlık raporu onaylı değil.");

        var diploma = currentDocs.FirstOrDefault(x => x.DocumentType == StudentDocumentType.Diploma);
        Add("educationDocument", "Öğrenim belgesi onayı", "Belgeler", diploma?.Status == StudentDocumentStatus.Approved ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Red,
            diploma is null ? "Diploma/öğrenim belgesi bulunmuyor." : diploma.Status == StudentDocumentStatus.Approved ? "Öğrenim belgesi kurum tarafından onaylanmış." : $"Öğrenim belgesi {DrivingStudentRules.EffectiveStatus(diploma.Status)} durumunda.");

        var photoDoc = currentDocs.FirstOrDefault(x => x.DocumentType == StudentDocumentType.BiometricPhoto);
        var photoUrl = !string.IsNullOrWhiteSpace(photoDoc?.FileUrl) ? photoDoc.FileUrl : profile.PhotoUrl;
        var photoPath = Uri.TryCreate(photoUrl, UriKind.Absolute, out var photoUri) ? photoUri.AbsolutePath : photoUrl;
        var extension = Path.GetExtension(photoDoc?.FileName?.Length > 0 ? photoDoc.FileName : photoPath).ToLowerInvariant();
        var formatAllowed = extension is ".jpg" or ".jpeg" or ".png";
        if (string.IsNullOrWhiteSpace(photoUrl))
            Add("photoFormat", "Fotoğraf dosyası", "Fotoğraf", MebbisQualitySeverity.Red, "Biyometrik fotoğraf bulunmuyor.");
        else
            Add("photoFormat", "Fotoğraf dosya formatı", "Fotoğraf", formatAllowed ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Red,
                formatAllowed ? "Fotoğraf JPG/JPEG/PNG formatında." : "Fotoğraf formatı desteklenmiyor; JPG, JPEG veya PNG yükleyin.");

        if (!string.IsNullOrWhiteSpace(photoUrl) && formatAllowed)
        {
            var prefix = await files.ReadPrefixAsync(photoUrl, 256 * 1024, ct);
            var info = prefix is null ? null : DrivingMebbisQualityRules.InspectImageHeader(prefix.Bytes);
            Add("photoResolution", "Fotoğraf ölçüsü ve çözünürlüğü", "Fotoğraf",
                prefix is null ? MebbisQualitySeverity.Orange : info is null ? MebbisQualitySeverity.Red
                : info.Width < 480 || info.Height < 600 ? MebbisQualitySeverity.Orange : MebbisQualitySeverity.Green,
                prefix is null ? "Fotoğraf başlığı güvenli depodan okunamadı; personel görseli kontrol etmeli."
                : info is null ? "Dosya uzantısı görsel olsa da içerik geçerli bir JPEG/PNG değil."
                : info.Width < 480 || info.Height < 600 ? $"Fotoğraf {info.Width}×{info.Height}; en az 480×600 önerilir." : $"Fotoğraf {info.Width}×{info.Height} ve çözünürlük yeterli.");
        }
        else Add("photoResolution", "Fotoğraf ölçüsü ve çözünürlüğü", "Fotoğraf", MebbisQualitySeverity.Orange, "Çözünürlük, geçerli bir görsel yüklenince denetlenebilir.");
        Add("photoRecency", "Fotoğraf güncelliği", "Fotoğraf",
            photoDoc is null ? MebbisQualitySeverity.Yellow : photoDoc.UploadedAtUtc < now.AddMonths(-6) ? MebbisQualitySeverity.Red : MebbisQualitySeverity.Green,
            photoDoc is null ? "Fotoğraf çekim/yükleme tarihi doğrulanamıyor." : photoDoc.UploadedAtUtc < now.AddMonths(-6) ? "Biyometrik fotoğraf altı aydan eski; güncel fotoğraf yüklenmeli." : "Fotoğraf son altı ay içinde yüklenmiş.");

        var photoInspection = photoDoc is null ? null : await db.DrivingPhotoInspections.AsNoTracking()
            .Where(x => x.StudentDrivingDocumentId == photoDoc.Id).OrderByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
        if (photoDoc is not null && photoInspection is null)
            Add("photoInspection", "Otomatik fotoğraf denetimi", "Fotoğraf", MebbisQualitySeverity.Red, "Güncel biyometrik fotoğraf henüz otomatik kalite denetiminden geçmedi.");
        else if (photoInspection is not null)
        {
            var photoChecks = DeserializePhotoChecks(photoInspection.ChecksJson);
            foreach (var check in photoChecks)
            {
                var severity = Enum.TryParse<MebbisQualitySeverity>(check.Severity, true, out var parsed) ? parsed : MebbisQualitySeverity.Red;
                Add($"photoAi.{check.Key}", check.Title, "Fotoğraf otomatik denetim", severity, check.Message);
            }
        }

        var openStatuses = DrivingStudentStatuses.Open.ToArray();
        var duplicateTcCount = profile.IdentityKind == IdentityKind.TurkishId && !string.IsNullOrWhiteSpace(identity)
            ? await db.StudentDrivingProfiles.IgnoreQueryFilters().AsNoTracking().Where(x => x.TenantId == db.CurrentTenantId && x.Id != profile.Id && openStatuses.Contains(x.Status))
                .Join(db.Students.IgnoreQueryFilters().AsNoTracking().Where(x => x.TenantId == db.CurrentTenantId && x.TcNo == identity), p => p.StudentId, s => s.Id, (_, _) => 1).CountAsync(ct) : 0;
        Add("duplicateNationalId", "Aynı TC ile aktif kayıt", "Mükerrer kayıt", duplicateTcCount == 0 ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Red,
            duplicateTcCount == 0 ? "Aynı TC kimlikle başka aktif kurs dosyası yok." : $"Aynı TC kimlikle {duplicateTcCount} başka aktif kurs dosyası bulundu.");
        var otherOpenPeriods = await db.StudentDrivingProfiles.IgnoreQueryFilters().AsNoTracking()
            .CountAsync(x => x.TenantId == db.CurrentTenantId && x.Id != profile.Id && x.StudentId == profile.StudentId && openStatuses.Contains(x.Status) && x.StudentGroupId != profile.StudentGroupId, ct);
        Add("otherOpenPeriod", "Başka dönemde açık kayıt", "Mükerrer kayıt", otherOpenPeriods == 0 ? MebbisQualitySeverity.Green : MebbisQualitySeverity.Red,
            otherOpenPeriods == 0 ? "Aynı kişinin başka dönemde açık kaydı yok." : $"Aynı kişinin başka dönemde {otherOpenPeriods} açık kaydı bulunuyor.");

        var group = profile.StudentGroupId is Guid groupId ? await db.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == groupId, ct) : null;
        if (group is null)
        {
            Add("groupQuota", "Dönem kontenjanı", "Dönem", MebbisQualitySeverity.Red, "Kursiyer bir MEBBİS dönemine atanmamış.");
            Add("registrationDeadline", "Son kayıt tarihi", "Dönem", MebbisQualitySeverity.Red, "Dönem ataması olmadığı için son kayıt tarihi doğrulanamıyor.");
        }
        else
        {
            var groupCount = await db.StudentDrivingProfiles.AsNoTracking().CountAsync(x => x.StudentGroupId == group.Id && openStatuses.Contains(x.Status), ct);
            var quotaSeverity = group.Quota > 0 && groupCount > group.Quota ? MebbisQualitySeverity.Red : group.Quota > 0 && groupCount == group.Quota ? MebbisQualitySeverity.Yellow : MebbisQualitySeverity.Green;
            Add("groupQuota", "Dönem kontenjanı", "Dönem", quotaSeverity, group.Quota <= 0 ? $"Dönemde {groupCount} açık kayıt var; kontenjan sınırı tanımlanmamış."
                : groupCount > group.Quota ? $"Dönem kontenjanı aşıldı: {groupCount}/{group.Quota}." : groupCount == group.Quota ? $"Dönem kontenjanı dolu: {groupCount}/{group.Quota}." : $"Dönem kontenjanı uygun: {groupCount}/{group.Quota}.");
            var deadlineSeverity = group.RegistrationDeadlineUtc is null ? MebbisQualitySeverity.Orange : group.RegistrationDeadlineUtc < now ? MebbisQualitySeverity.Red
                : group.RegistrationDeadlineUtc <= now.AddDays(3) ? MebbisQualitySeverity.Yellow : MebbisQualitySeverity.Green;
            Add("registrationDeadline", "Son kayıt tarihi", "Dönem", deadlineSeverity, group.RegistrationDeadlineUtc is null ? "Dönem son kayıt tarihi tanımlanmamış."
                : group.RegistrationDeadlineUtc < now ? $"Dönemin son kayıt tarihi geçti: {group.RegistrationDeadlineUtc:dd.MM.yyyy}."
                : group.RegistrationDeadlineUtc <= now.AddDays(3) ? $"Son kayıt tarihine üç günden az kaldı: {group.RegistrationDeadlineUtc:dd.MM.yyyy}." : $"Son kayıt tarihi uygun: {group.RegistrationDeadlineUtc:dd.MM.yyyy}.");
        }

        var package = await db.DrivingPackages.AsNoTracking().SingleOrDefaultAsync(x => x.Id == profile.PackageId, ct);
        var preferredVehicle = profile.PreferredVehicleId is Guid vehicleId ? await db.DrivingVehicles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == vehicleId, ct) : null;
        var hasCompatibleVehicle = await db.DrivingVehicles.AsNoTracking().AnyAsync(x => x.IsActive && !x.IsInMaintenance && x.LicenseClass == profile.LicenseClass && x.TransmissionType == profile.TransmissionType, ct);
        var vehicleSeverity = package is not null && (!package.LicenseClass.Equals(profile.LicenseClass, StringComparison.OrdinalIgnoreCase) || package.TransmissionType != profile.TransmissionType)
            ? MebbisQualitySeverity.Red : preferredVehicle is not null && (!preferredVehicle.LicenseClass.Equals(profile.LicenseClass, StringComparison.OrdinalIgnoreCase) || preferredVehicle.TransmissionType != profile.TransmissionType)
            ? MebbisQualitySeverity.Red : !hasCompatibleVehicle ? MebbisQualitySeverity.Orange : MebbisQualitySeverity.Green;
        Add("vehicleCompatibility", "Ehliyet ve araç sınıfı uyumu", "Araç", vehicleSeverity,
            vehicleSeverity == MebbisQualitySeverity.Red ? "Paket veya tercih edilen araç, kursiyerin ehliyet sınıfı/vites türüyle uyumlu değil."
            : vehicleSeverity == MebbisQualitySeverity.Orange ? "Kurum filosunda aktif ve uygun sınıfta araç bulunamadı." : "Ehliyet sınıfı, paket ve uygun aktif araç birbiriyle uyumlu.");

        var ordered = checks.OrderByDescending(x => x.Severity).ThenBy(x => x.Category).ThenBy(x => x.Title).ToList();
        return new MebbisQualityReport(
            GeneratedAtUtc: now,
            Overall: (ordered.Count == 0 ? MebbisQualitySeverity.Green : ordered.Max(x => x.Severity)).ToString(),
            BlockingCount: ordered.Count(x => x.Severity == MebbisQualitySeverity.Red),
            ReviewCount: ordered.Count(x => x.Severity == MebbisQualitySeverity.Orange),
            WarningCount: ordered.Count(x => x.Severity == MebbisQualitySeverity.Yellow),
            PassedCount: ordered.Count(x => x.Severity == MebbisQualitySeverity.Green),
            Ready: ordered.All(x => x.Severity != MebbisQualitySeverity.Red),
            Checks: ordered);
    }

    private static Dictionary<string, string> BuildEntryValues(EntrySource source)
    {
        var names = source.Student.FullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var firstName = names.Length > 1 ? string.Join(' ', names[..^1]) : names.FirstOrDefault() ?? string.Empty;
        var lastName = names.Length > 1 ? names[^1] : string.Empty;
        var identity = source.Profile.IdentityKind == IdentityKind.TurkishId && string.IsNullOrWhiteSpace(source.Profile.IdentityNumber)
            ? source.Student.TcNo : source.Profile.IdentityNumber;
        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["nationalId"] = identity?.Trim() ?? string.Empty,
            ["firstName"] = firstName,
            ["lastName"] = lastName,
            ["birthDate"] = source.Student.BirthDate?.Trim() ?? string.Empty,
            ["motherName"] = source.Profile.MotherName.Trim(),
            ["fatherName"] = source.Profile.FatherName.Trim(),
            ["birthPlace"] = source.Profile.BirthPlace.Trim(),
            ["educationLevel"] = source.Profile.EducationLevel.Trim(),
            ["phone"] = source.Profile.Phone.Trim(),
            ["licenseClass"] = source.Profile.LicenseClass.Trim(),
        };
    }

    private void DisableSensitiveResponseCaching()
    {
        Response.Headers.CacheControl = "no-store, private";
        Response.Headers.Pragma = "no-cache";
        Response.Headers.XContentTypeOptions = "nosniff";
    }

    private static readonly JsonSerializerOptions PhotoJsonOptions = new(JsonSerializerDefaults.Web);

    private static IReadOnlyList<DrivingPhotoCheckResult> DeserializePhotoChecks(string json)
    {
        try { return JsonSerializer.Deserialize<List<DrivingPhotoCheckResult>>(json, PhotoJsonOptions) ?? []; }
        catch (JsonException) { return [new("inspectionData", "Denetim verisi", "Red", "Fotoğraf denetim kaydı okunamadı; denetimi yeniden çalıştırın.")]; }
    }

    private static object ToPhotoInspectionDto(DrivingPhotoInspection inspection) => new
    {
        inspection.Id,
        inspection.StudentDrivingProfileId,
        inspection.StudentDrivingDocumentId,
        inspection.Overall,
        checks = DeserializePhotoChecks(inspection.ChecksJson),
        inspection.SourceBytes,
        inspection.Width,
        inspection.Height,
        inspection.FaceCount,
        inspection.FaceConfidence,
        inspection.AverageBrightness,
        inspection.BackgroundUniformity,
        mebbisCopyAvailable = !string.IsNullOrWhiteSpace(inspection.MebbisFileUrl),
        inspection.MebbisBytes,
        inspection.MebbisWidth,
        inspection.MebbisHeight,
        inspection.AnalyzerVersion,
        inspection.CreatedAtUtc,
        downloadUrl = string.IsNullOrWhiteSpace(inspection.MebbisFileUrl) ? null : $"/api/driving-school/mebbis/photo-inspections/{inspection.Id}/mebbis-file",
    };

    private async Task AddErrorOccurrenceAsync(string code, Guid profileId, string note, string sourceType,
        Guid sourceId, Guid userId, DateTime occurredAtUtc, CancellationToken ct)
    {
        var definition = await db.DrivingMebbisErrorDefinitions.SingleOrDefaultAsync(x => x.Code == code, ct);
        if (definition is null)
        {
            var template = DrivingMebbisErrorCatalog.Defaults.Single(x => x.Code == code);
            definition = new DrivingMebbisErrorDefinition
            {
                Code = template.Code, Title = template.Title, Description = template.Description,
                PossibleCause = template.PossibleCause,
                ResolutionStepsJson = JsonSerializer.Serialize(template.ResolutionSteps, PhotoJsonOptions),
                Severity = template.Severity, IsSystem = true, CreatedByUserId = userId,
            };
            db.DrivingMebbisErrorDefinitions.Add(definition);
        }
        db.DrivingMebbisErrorOccurrences.Add(new DrivingMebbisErrorOccurrence
        {
            ErrorDefinitionId = definition.Id, StudentDrivingProfileId = profileId,
            SourceType = sourceType, SourceId = sourceId, Note = note,
            ReportedByUserId = userId, ReportedByName = CurrentUserName(), OccurredAtUtc = occurredAtUtc,
        });
    }

    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (db.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled
            && string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase);
    }

    private static bool TryOptionalEnum<T>(string? value, out T? parsed) where T : struct, Enum
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (!Enum.TryParse<T>(value, true, out var result) || !Enum.IsDefined(result)) return false;
        parsed = result; return true;
    }

    private static int StatusOrder(DrivingMebbisWorkStatus status) => status switch
    {
        DrivingMebbisWorkStatus.Error => 0,
        DrivingMebbisWorkStatus.CorrectionPending => 1,
        DrivingMebbisWorkStatus.Preparing => 2,
        DrivingMebbisWorkStatus.Ready => 3,
        DrivingMebbisWorkStatus.EntryPending => 4,
        DrivingMebbisWorkStatus.Entered => 5,
        _ => 6,
    };
}

public sealed record ChangeMebbisWorkStatusRequest(string Status, string? Reason, string? Note, int ExpectedVersion);
public sealed record UpdateMebbisEntryFieldRequest(bool Completed, int ExpectedVersion);
public sealed record CompleteMebbisEntryAssistantRequest(int ExpectedWorkItemVersion);
internal sealed record EntrySource(StudentDrivingProfile Profile, StudentProfile Student, StudentDrivingDocument? HealthReport);
public sealed record MebbisQualityReport(
    DateTime GeneratedAtUtc,
    string Overall,
    int BlockingCount,
    int ReviewCount,
    int WarningCount,
    int PassedCount,
    bool Ready,
    IReadOnlyList<MebbisQualityCheck> Checks);
public sealed record MebbisItemDto(
    DrivingMebbisWorkType WorkType, Guid SubjectId, Guid? StudentDrivingProfileId, Guid? StudentGroupId,
    string Title, string Reference, string Category, string PhotoUrl, DrivingMebbisWorkStatus Status, List<string> Missing,
    string ErrorReason, string Note, DateTime? DueAtUtc, Guid? AssignedToUserId, DateTime? EnteredAtUtc,
    DateTime? VerifiedAtUtc, int Version, DateTime? UpdatedAtUtc);
