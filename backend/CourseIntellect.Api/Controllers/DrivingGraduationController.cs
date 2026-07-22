using System.Security.Claims;
using System.Security.Cryptography;
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
[Route("api/driving-school/graduation")]
public sealed class DrivingGraduationController(
    CourseIntellectDbContext db,
    IDrivingNotifier notifier,
    IAuditLogService audit,
    IFileStorageService files,
    IDrivingCertificatePdfService pdf,
    IConfiguration configuration) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";
    private static readonly HashSet<string> OverridableChecklistKeys = new(StringComparer.OrdinalIgnoreCase)
        { "documents", "theory", "practice", "finance", "schedule" };

    [HttpGet("overview")]
    [RequireDrivingPermission(DrivingPermissions.GraduationView)]
    public async Task<IActionResult> Overview(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var ownProfileId = User.IsInRole("Student") ? await CurrentStudentProfileIdAsync(ct) : null;
        var profiles = db.StudentDrivingProfiles.AsNoTracking();
        if (User.IsInRole("Student"))
        {
            if (ownProfileId is null) return Forbid();
            profiles = profiles.Where(x => x.Id == ownProfileId);
        }

        var students = await profiles.Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new
            { p.Id, s.FullName, p.LicenseClass, transmissionType = p.TransmissionType.ToString(), status = p.Status.ToString(), p.RegisteredAtUtc,
                photoUrl = p.LivePhotoUrl != "" ? p.LivePhotoUrl : p.PhotoUrl })
            .OrderBy(x => x.FullName).ToListAsync(ct);
        var ids = students.Select(x => x.Id).ToList();
        var graduations = await db.DrivingGraduationRecords.AsNoTracking().Where(x => ids.Contains(x.StudentDrivingProfileId))
            .Select(x => new { x.Id, x.StudentDrivingProfileId, status = x.Status.ToString(), x.ChecklistJson, x.CheckedAtUtc, x.GraduatedAtUtc, x.Note, x.RevokedAtUtc, x.RevocationReason }).ToListAsync(ct);
        var certificates = await db.DrivingCertificates.AsNoTracking().Where(x => ids.Contains(x.StudentDrivingProfileId))
            .OrderByDescending(x => x.IssuedAtUtc)
            .Select(x => new { x.Id, x.StudentDrivingProfileId, type = x.CertificateType.ToString(), x.DocumentNumber, x.MebbisCertificateNo, x.IssuedAtUtc,
                status = x.Status.ToString(), x.Version, x.ReissuedFromCertificateId, x.ReissueReason, x.PdfFileUrl,
                deliveryStatus = x.DeliveryStatus.ToString(), x.DeliveredAtUtc, x.DeliveredTo, x.DeliveryNote, x.RevokedAtUtc, x.RevocationReason }).ToListAsync(ct);
        var actionRequests = User.IsInRole("Student") ? [] : await db.DrivingGraduationActionRequests.AsNoTracking()
            .Where(x => ids.Contains(x.StudentDrivingProfileId)).OrderByDescending(x => x.RequestedAtUtc)
            .Select(x => new { x.Id, x.StudentDrivingProfileId, actionType = x.ActionType.ToString(), status = x.Status.ToString(), x.RequestedChecklistKeysJson,
                x.Reason, x.RequestedByUserId, x.RequestedAtUtc, x.FirstApprovedByUserId, x.FirstApprovedAtUtc, x.SecondApprovedByUserId, x.SecondApprovedAtUtc, x.DecisionNote }).ToListAsync(ct);
        object? certificateSetup = null;
        if (!User.IsInRole("Student"))
        {
            var settings = await ResolveSettingsAsync(ct);
            var missing = await CertificateSetupMissingAsync(settings, ct);
            certificateSetup = new
            {
                complete = missing.Count == 0 && IsCertificateSettingsApproved(settings),
                missingFields = missing,
                directorName = settings.CertificateDirectorName,
                directorTitle = settings.CertificateDirectorTitle,
                settings.MinimumTheoryAttendancePercent,
                excusedAbsencePolicy = settings.ExcusedAbsencePolicy.ToString(),
                logoConfigured = !missing.Contains("logoUrl"),
                signatureConfigured = !missing.Contains("signatureUrl"),
                approved = IsCertificateSettingsApproved(settings),
                settings.CertificateSettingsApprovedAtUtc,
            };
        }
        return Ok(new { students, graduations, certificates, actionRequests, certificateSetup });
    }

    [HttpGet("certificate-settings")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> GetCertificateSettings(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var settings = await ResolveSettingsAsync(ct);
        var missing = await CertificateSetupMissingAsync(settings, ct);
        return Ok(CertificateSettingsResponse(settings, missing));
    }

    [HttpPut("certificate-settings")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> UpdateCertificateSettings([FromBody] UpdateDrivingCertificateSettingsRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var directorName = request.DirectorName?.Trim() ?? string.Empty;
        var directorTitle = request.DirectorTitle?.Trim() ?? string.Empty;
        var logoUrl = request.LogoUrl?.Trim() ?? string.Empty;
        var signatureUrl = request.SignatureUrl?.Trim() ?? string.Empty;
        var primaryColor = request.PrimaryColor?.Trim().ToUpperInvariant() ?? string.Empty;
        if (directorName.Length is < 2 or > 150) return BadRequest(new { message = "Kurum müdürü adı 2-150 karakter olmalıdır." });
        if (directorTitle.Length is < 2 or > 100) return BadRequest(new { message = "Müdür unvanı 2-100 karakter olmalıdır." });
        if (request.MinimumTheoryAttendancePercent is < 0 or > 100) return BadRequest(new { message = "Asgari devam oranı 0-100 arasında olmalıdır." });
        if (!Enum.TryParse<DrivingExcusedAbsencePolicy>(request.ExcusedAbsencePolicy, true, out var policy) || !Enum.IsDefined(policy))
            return BadRequest(new { message = "Mazeretli devamsızlık politikası geçersiz." });
        if (!System.Text.RegularExpressions.Regex.IsMatch(primaryColor, "^#[0-9A-F]{6}$"))
            return BadRequest(new { message = "Sertifika rengi #RRGGBB biçiminde olmalıdır." });
        if (!IsCertificateAssetPath(logoUrl) || !IsCertificateAssetPath(signatureUrl))
            return BadRequest(new { message = "Logo ve imza güvenli sertifika yükleme alanından seçilmelidir." });
        if (await ReadSafeCertificateImageAsync(logoUrl, ct) is null)
            return BadRequest(new { message = "Kurum logosu bulunamadı veya desteklenmeyen bir görseldir." });
        if (await ReadSafeCertificateImageAsync(signatureUrl, ct) is null)
            return BadRequest(new { message = "İmza görseli bulunamadı veya desteklenmeyen bir görseldir." });

        var settings = await db.DrivingSchoolSettings.SingleOrDefaultAsync(ct);
        var before = settings is null ? null : CertificateSettingsSnapshot(settings);
        if (settings is null) { settings = new DrivingSchoolSettings(); db.DrivingSchoolSettings.Add(settings); }
        settings.CertificateDirectorName = directorName;
        settings.CertificateDirectorTitle = directorTitle;
        settings.CertificateLogoUrl = logoUrl;
        settings.CertificateSignatureUrl = signatureUrl;
        settings.CertificatePrimaryColor = primaryColor;
        settings.MinimumTheoryAttendancePercent = request.MinimumTheoryAttendancePercent;
        settings.ExcusedAbsencePolicy = policy;
        settings.CertificateSettingsRevision = Math.Max(1, settings.CertificateSettingsRevision + 1);
        settings.CertificateSettingsApprovedRevision = null;
        settings.CertificateSettingsApprovedByUserId = null;
        settings.CertificateSettingsApprovedAtUtc = null;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Kurum ve sertifika ayarları güncellendi", AuditCategory, nameof(DrivingSchoolSettings), settings.Id.ToString(),
            $"Müdür, kurumsal görseller ve %{settings.MinimumTheoryAttendancePercent:0.##} devam politikası güncellendi.", before, CertificateSettingsSnapshot(settings), ct);
        return Ok(CertificateSettingsResponse(settings, []));
    }

    [HttpPost("certificate-settings/approve")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> ApproveCertificateSettings([FromBody] ApproveDrivingCertificateSettingsRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var settings = await db.DrivingSchoolSettings.SingleOrDefaultAsync(ct);
        if (settings is null) return Conflict(new { message = "Onaylanacak kurum ve sertifika ayarı bulunamadı." });
        var missing = await CertificateSetupMissingAsync(settings, ct);
        if (missing.Count > 0) return Conflict(new { message = "Eksik kurum bilgileri onaylanamaz.", missingFields = missing });
        if (request.Confirmed != true) return BadRequest(new { message = "Sertifika önizlemesinin kontrol edildiği açıkça onaylanmalıdır." });
        var userId = CurrentUserId(); if (userId is null) return Forbid();
        settings.CertificateSettingsApprovedRevision = settings.CertificateSettingsRevision;
        settings.CertificateSettingsApprovedByUserId = userId;
        settings.CertificateSettingsApprovedAtUtc = DateTime.UtcNow;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Sertifika önizlemesi kurum yöneticisi tarafından onaylandı", AuditCategory, nameof(DrivingSchoolSettings), settings.Id.ToString(),
            request.Note?.Trim() ?? string.Empty, null, new { settings.CertificateSettingsRevision, settings.CertificateSettingsApprovedAtUtc, approvedBy = userId }, ct);
        return Ok(CertificateSettingsResponse(settings, []));
    }

    [HttpGet("certificate-settings/preview")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> PreviewCertificate(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var settings = await ResolveSettingsAsync(ct);
        var missing = await CertificateSetupMissingAsync(settings, ct);
        if (missing.Count > 0) return Conflict(new { message = "Önizleme için kurum bilgilerini tamamlayın.", missingFields = missing });
        var tenantId = db.CurrentTenantId!.Value;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == tenantId, ct);
        var logo = await ReadSafeCertificateImageAsync(settings.CertificateLogoUrl, ct);
        var signature = await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct);
        var bytes = pdf.Generate(new DrivingCertificatePdfModel(tenant.Name, "ÖRNEK KURSİYER", "B", "ÖNİZLEME-2026-00001",
            "EĞİTİM TAMAMLAMA BELGESİ", DateTime.UtcNow, settings.CertificateDirectorName, settings.CertificateDirectorTitle,
            settings.CertificatePrimaryColor, $"{Request.Scheme}://{Request.Host}/api/public/driving-certificates/preview", logo, signature));
        return File(bytes, "application/pdf", "sertifika-onizleme.pdf");
    }

    [HttpGet("students/{profileId:guid}/checklist")]
    [RequireDrivingPermission(DrivingPermissions.GraduationView)]
    public async Task<IActionResult> Checklist(Guid profileId, CancellationToken ct)
    {
        if (!await CanAccessProfileAsync(profileId, ct)) return Forbid();
        var result = await BuildChecklistAsync(profileId, ct);
        return result is null ? NotFound(new { message = "Kursiyer bulunamadı." }) : Ok(result);
    }

    [HttpPost("students/{profileId:guid}/override-requests")]
    [RequireDrivingPermission(DrivingPermissions.GraduationOverrideRequest)]
    public async Task<IActionResult> RequestOverride(Guid profileId, [FromBody] GraduationActionRequest request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length < 20) return BadRequest(new { message = "İstisna gerekçesi en az 20 karakter olmalıdır." });
        var checklist = await BuildChecklistAsync(profileId, ct);
        if (checklist is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        var requested = (request.ChecklistKeys ?? []).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var incomplete = checklist.Items.Where(x => !x.Completed).Select(x => x.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (requested.Length == 0 || requested.Any(x => !incomplete.Contains(x) || !OverridableChecklistKeys.Contains(x)))
            return BadRequest(new { message = "Yalnızca tamamlanmamış ve istisnaya açık maddeler için talep oluşturulabilir." });
        if (await db.DrivingGraduationActionRequests.AnyAsync(x => x.StudentDrivingProfileId == profileId && x.ActionType == DrivingGraduationActionType.EligibilityOverride &&
            (x.Status == DrivingGraduationActionStatus.Pending || x.Status == DrivingGraduationActionStatus.FirstApproved), ct))
            return Conflict(new { message = "Bu kursiyer için sonuçlanmamış bir istisna talebi var." });
        var userId = CurrentUserId(); if (userId is null) return Forbid();
        var entity = new DrivingGraduationActionRequest { StudentDrivingProfileId = profileId, ActionType = DrivingGraduationActionType.EligibilityOverride,
            RequestedChecklistKeysJson = JsonSerializer.Serialize(requested), Reason = reason, RequestedByUserId = userId.Value };
        db.DrivingGraduationActionRequests.Add(entity); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Mezuniyet istisna talebi", AuditCategory, nameof(DrivingGraduationActionRequest), entity.Id.ToString(), reason, null, new { profileId, requested }, ct);
        return Ok(new { entity.Id, status = entity.Status.ToString() });
    }

    [HttpPost("students/{profileId:guid}/revocation-requests")]
    [RequireDrivingPermission(DrivingPermissions.GraduationRevokeRequest)]
    public async Task<IActionResult> RequestRevocation(Guid profileId, [FromBody] GraduationActionRequest request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length < 20) return BadRequest(new { message = "Geri alma gerekçesi en az 20 karakter olmalıdır." });
        var graduation = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingGraduationStatus.Graduated, ct);
        if (graduation is null) return Conflict(new { message = "Aktif mezuniyet kaydı bulunamadı." });
        if (await db.DrivingGraduationActionRequests.AnyAsync(x => x.StudentDrivingProfileId == profileId && x.ActionType == DrivingGraduationActionType.GraduationRevocation &&
            (x.Status == DrivingGraduationActionStatus.Pending || x.Status == DrivingGraduationActionStatus.FirstApproved), ct))
            return Conflict(new { message = "Bu mezuniyet için sonuçlanmamış bir geri alma talebi var." });
        var userId = CurrentUserId(); if (userId is null) return Forbid();
        var entity = new DrivingGraduationActionRequest { StudentDrivingProfileId = profileId, GraduationRecordId = graduation.Id,
            ActionType = DrivingGraduationActionType.GraduationRevocation, Reason = reason, RequestedByUserId = userId.Value };
        db.DrivingGraduationActionRequests.Add(entity); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Mezuniyet geri alma talebi", AuditCategory, nameof(DrivingGraduationActionRequest), entity.Id.ToString(), reason, null, new { profileId }, ct);
        return Ok(new { entity.Id, status = entity.Status.ToString() });
    }

    [HttpPost("action-requests/{id:guid}/approve")]
    [RequireDrivingPermission(DrivingPermissions.GraduationOverrideApprove)]
    public async Task<IActionResult> ApproveAction(Guid id, [FromBody] GraduationDecisionRequest request, CancellationToken ct)
    {
        var entity = await db.DrivingGraduationActionRequests.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound(new { message = "Talep bulunamadı." });
        if (entity.Status is not (DrivingGraduationActionStatus.Pending or DrivingGraduationActionStatus.FirstApproved)) return Conflict(new { message = "Talep onaya açık değil." });
        var userId = CurrentUserId(); if (userId is null) return Forbid();
        if (entity.RequestedByUserId == userId || entity.FirstApprovedByUserId == userId) return Conflict(new { message = "Talep sahibi ve ilk onaylayan aynı talebi onaylayamaz; iki farklı yetkili gerekir." });
        if (entity.Status == DrivingGraduationActionStatus.Pending)
        {
            entity.FirstApprovedByUserId = userId; entity.FirstApprovedAtUtc = DateTime.UtcNow; entity.Status = DrivingGraduationActionStatus.FirstApproved;
        }
        else
        {
            entity.SecondApprovedByUserId = userId; entity.SecondApprovedAtUtc = DateTime.UtcNow; entity.Status = DrivingGraduationActionStatus.Approved;
            if (entity.ActionType == DrivingGraduationActionType.GraduationRevocation) await ApplyGraduationRevocationAsync(entity, ct);
        }
        entity.DecisionNote = request.Note?.Trim() ?? string.Empty;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Mezuniyet talebi onaylandı", AuditCategory, nameof(DrivingGraduationActionRequest), entity.Id.ToString(), entity.DecisionNote, null, new { entity.Status, userId }, ct);
        return Ok(new { status = entity.Status.ToString() });
    }

    [HttpPost("action-requests/{id:guid}/reject")]
    [RequireDrivingPermission(DrivingPermissions.GraduationOverrideApprove)]
    public async Task<IActionResult> RejectAction(Guid id, [FromBody] GraduationDecisionRequest request, CancellationToken ct)
    {
        var note = request.Note?.Trim() ?? string.Empty;
        if (note.Length < 10) return BadRequest(new { message = "Ret gerekçesi en az 10 karakter olmalıdır." });
        var entity = await db.DrivingGraduationActionRequests.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();
        if (entity.Status is not (DrivingGraduationActionStatus.Pending or DrivingGraduationActionStatus.FirstApproved)) return Conflict(new { message = "Talep karara açık değil." });
        var userId = CurrentUserId(); if (userId is null || entity.RequestedByUserId == userId) return Forbid();
        entity.Status = DrivingGraduationActionStatus.Rejected; entity.RejectedByUserId = userId; entity.RejectedAtUtc = DateTime.UtcNow; entity.DecisionNote = note;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Mezuniyet talebi reddedildi", AuditCategory, nameof(DrivingGraduationActionRequest), entity.Id.ToString(), note, null, new { entity.Status }, ct);
        return Ok(new { status = entity.Status.ToString() });
    }

    [HttpPost("students/{profileId:guid}/graduate")]
    [RequireDrivingPermission(DrivingPermissions.GraduationManage)]
    public async Task<IActionResult> Graduate(Guid profileId, [FromBody] GraduateStudentRequest request, CancellationToken ct)
    {
        var checklist = await BuildChecklistAsync(profileId, ct);
        if (checklist is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        DrivingGraduationActionRequest? approvedOverride = null;
        if (!checklist.Eligible)
        {
            var incomplete = checklist.Items.Where(x => !x.Completed).Select(x => x.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
            approvedOverride = await db.DrivingGraduationActionRequests.Where(x => x.StudentDrivingProfileId == profileId && x.ActionType == DrivingGraduationActionType.EligibilityOverride && x.Status == DrivingGraduationActionStatus.Approved)
                .OrderByDescending(x => x.SecondApprovedAtUtc).FirstOrDefaultAsync(ct);
            var covered = approvedOverride is null ? [] : JsonSerializer.Deserialize<string[]>(approvedOverride.RequestedChecklistKeysJson) ?? [];
            if (incomplete.Any(x => !covered.Contains(x, StringComparer.OrdinalIgnoreCase)))
                return Conflict(new { message = "Mezuniyet kontrol listesi tamamlanmadı veya iki onaylı istisna tüm eksikleri kapsamıyor.", checklist });
        }
        var profile = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == profileId, ct);
        var record = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId, ct) ?? new DrivingGraduationRecord { StudentDrivingProfileId = profileId };
        if (db.Entry(record).State == EntityState.Detached) db.DrivingGraduationRecords.Add(record);
        record.Status = DrivingGraduationStatus.Graduated; record.ChecklistJson = JsonSerializer.Serialize(checklist.Items); record.CheckedAtUtc = DateTime.UtcNow;
        record.GraduatedAtUtc = DateTime.UtcNow; record.GraduatedByUserId = CurrentUserId(); record.Note = request.Note?.Trim() ?? string.Empty;
        record.RevokedAtUtc = null; record.RevokedByUserId = null; record.RevocationReason = string.Empty; profile.Status = DrivingStudentStatus.Graduated;
        if (approvedOverride is not null) { approvedOverride.Status = DrivingGraduationActionStatus.Applied; approvedOverride.AppliedAtUtc = DateTime.UtcNow; }
        await db.SaveChangesAsync(ct);
        await notifier.NotifyStudentAsync(profileId, "Mezuniyetiniz onaylandı", "Eğitim ve sınav koşullarını tamamladınız. Belgeniz hazırlanabilir.", DrivingNotificationCategories.Exam,
            dedupeKey: $"graduation:{record.Id}:{record.GraduatedAtUtc:O}", relatedEntityType: nameof(DrivingGraduationRecord), relatedEntityId: record.Id.ToString(), cancellationToken: ct);
        await audit.LogChangeAsync("Kursiyer mezun edildi", AuditCategory, nameof(DrivingGraduationRecord), record.Id.ToString(), record.Note, null, new { profileId, overrideRequestId = approvedOverride?.Id }, ct);
        return Ok(new { record.Id, status = record.Status.ToString(), record.GraduatedAtUtc });
    }

    [HttpPost("students/{profileId:guid}/certificates")]
    [RequireDrivingPermission(DrivingPermissions.CertificateIssue)]
    public async Task<IActionResult> IssueCertificate(Guid profileId, [FromBody] IssueCertificateRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<DrivingCertificateType>(request.Type, true, out var type) || !Enum.IsDefined(type)) return BadRequest(new { message = "Belge türü geçersiz." });
        var graduation = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingGraduationStatus.Graduated, ct);
        if (graduation is null) return Conflict(new { message = "Kursiyer mezun edilmeden belge oluşturulamaz." });
        var active = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId && x.CertificateType == type && x.Status == DrivingCertificateStatus.Active, ct);
        if (active is not null) return Ok(new { active.Id, active.DocumentNumber, type = active.CertificateType.ToString(), active.PdfFileUrl });
        var settings = await ResolveSettingsAsync(ct);
        var missing = await CertificateIssuanceMissingAsync(settings, ct);
        if (missing.Count > 0) return Conflict(new { message = "Kurum ve sertifika ayarları tamamlanmadan belge düzenlenemez.", missingFields = missing });
        var certificate = await CreateCertificateAsync(graduation, profileId, type, null, string.Empty, ct);
        return Ok(new { certificate.Id, certificate.DocumentNumber, type = certificate.CertificateType.ToString(), certificate.PdfFileUrl });
    }

    [HttpPost("certificates/{id:guid}/reissue")]
    [RequireDrivingPermission(DrivingPermissions.CertificateIssue)]
    public async Task<IActionResult> Reissue(Guid id, [FromBody] CertificateReissueRequest request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length < 10) return BadRequest(new { message = "Yeniden basım gerekçesi en az 10 karakter olmalıdır." });
        var old = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (old is null) return NotFound();
        var graduation = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.Id == old.GraduationRecordId && x.Status == DrivingGraduationStatus.Graduated, ct);
        if (graduation is null) return Conflict(new { message = "Aktif mezuniyet olmadan belge yeniden basılamaz." });
        var settings = await ResolveSettingsAsync(ct);
        var missing = await CertificateIssuanceMissingAsync(settings, ct);
        if (missing.Count > 0) return Conflict(new { message = "Kurum ve sertifika ayarları tamamlanmadan belge yeniden basılamaz.", missingFields = missing });
        if (old.Status == DrivingCertificateStatus.Active) old.Status = DrivingCertificateStatus.Superseded;
        var certificate = await CreateCertificateAsync(graduation, old.StudentDrivingProfileId, old.CertificateType, old, reason, ct);
        await audit.LogChangeAsync("Sertifika yeniden basıldı", AuditCategory, nameof(DrivingCertificate), certificate.Id.ToString(), reason, new { old.Id, old.DocumentNumber }, new { certificate.Id, certificate.DocumentNumber }, ct);
        return Ok(new { certificate.Id, certificate.DocumentNumber, certificate.Version, certificate.PdfFileUrl });
    }

    [HttpPost("certificates/{id:guid}/revoke")]
    [RequireDrivingPermission(DrivingPermissions.CertificateRevoke)]
    public async Task<IActionResult> RevokeCertificate(Guid id, [FromBody] CertificateReissueRequest request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length < 10) return BadRequest(new { message = "İptal gerekçesi en az 10 karakter olmalıdır." });
        var certificate = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (certificate is null) return NotFound();
        if (certificate.Status == DrivingCertificateStatus.Revoked) return Ok(new { status = certificate.Status.ToString() });
        certificate.Status = DrivingCertificateStatus.Revoked; certificate.RevokedAtUtc = DateTime.UtcNow; certificate.RevokedByUserId = CurrentUserId(); certificate.RevocationReason = reason;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Sertifika iptal edildi", AuditCategory, nameof(DrivingCertificate), certificate.Id.ToString(), reason, null, new { certificate.Status }, ct);
        return Ok(new { status = certificate.Status.ToString(), certificate.RevokedAtUtc });
    }

    [HttpPut("certificates/{id:guid}/delivery")]
    [RequireDrivingPermission(DrivingPermissions.CertificateDeliver)]
    public async Task<IActionResult> UpdateDelivery(Guid id, [FromBody] CertificateDeliveryRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<DrivingCertificateDeliveryStatus>(request.Status, true, out var status) || !Enum.IsDefined(status)) return BadRequest(new { message = "Teslim durumu geçersiz." });
        if (status == DrivingCertificateDeliveryStatus.Delivered && (request.DeliveredTo?.Trim().Length ?? 0) < 3) return BadRequest(new { message = "Teslim alan kişi zorunludur." });
        var certificate = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (certificate is null) return NotFound();
        certificate.DeliveryStatus = status; certificate.DeliveredAtUtc = status == DrivingCertificateDeliveryStatus.Delivered ? DateTime.UtcNow : null;
        certificate.DeliveredTo = request.DeliveredTo?.Trim() ?? string.Empty; certificate.DeliveryNote = request.Note?.Trim() ?? string.Empty;
        await db.SaveChangesAsync(ct); return Ok(new { deliveryStatus = certificate.DeliveryStatus.ToString(), certificate.DeliveredAtUtc });
    }

    /// <summary>MEBBİS'in verdiği resmî sertifika numarasını işler (kurum MEBBİS'ten okur).</summary>
    [HttpPut("certificates/{id:guid}/mebbis-no")]
    [RequireDrivingPermission(DrivingPermissions.CertificateIssue)]
    public async Task<IActionResult> UpdateMebbisNo(Guid id, [FromBody] CertificateMebbisNoRequest request, CancellationToken ct)
    {
        var value = (request.MebbisCertificateNo ?? string.Empty).Trim().ToUpperInvariant();
        if (value.Length > 60) return BadRequest(new { message = "MEBBİS sertifika numarası en fazla 60 karakter olabilir." });
        var certificate = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (certificate is null) return NotFound();
        if (value.Length > 0 && await db.DrivingCertificates.AsNoTracking().AnyAsync(x => x.Id != id && x.MebbisCertificateNo == value, ct))
            return Conflict(new { message = "Bu MEBBİS sertifika numarası başka bir belgede kullanılıyor." });

        var before = certificate.MebbisCertificateNo;
        certificate.MebbisCertificateNo = value;
        db.AddMebbisHistory(certificate.StudentDrivingProfileId,
            value.Length > 0 ? DrivingMebbisHistoryEventType.CertificateNumber : DrivingMebbisHistoryEventType.Correction,
            value.Length > 0 ? "Sertifika numarası işlendi" : "MEBBİS sertifika numarası kaldırıldı",
            value.Length > 0 ? "MEBBİS sertifika numarası belgeyle ilişkilendirildi." : "Sertifika numarası kurum personeli tarafından geri alındı.",
            value.Length > 0 ? "Processed" : "Removed", nameof(DrivingCertificate), certificate.Id, CurrentUserId(), CurrentUserName(),
            value.Length > 0 ? DrivingMebbisHistorySeverity.Success : DrivingMebbisHistorySeverity.Warning);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Bu MEBBİS sertifika numarası başka bir belgede kullanılıyor." });
        }
        await audit.LogChangeAsync("MEBBİS sertifika no işlendi", AuditCategory, nameof(DrivingCertificate), certificate.Id.ToString(),
            $"{certificate.DocumentNumber} → MEBBİS no: {(value.Length == 0 ? "—" : value)}",
            new { mebbisCertificateNo = before }, new { certificate.MebbisCertificateNo }, ct);
        return Ok(new { certificate.Id, certificate.MebbisCertificateNo });
    }

    [HttpGet("certificates/{id:guid}/download")]
    [RequireDrivingPermission(DrivingPermissions.GraduationView)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var certificate = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (certificate is null || !await CanAccessProfileAsync(certificate.StudentDrivingProfileId, ct)) return NotFound();
        if (string.IsNullOrWhiteSpace(certificate.PdfFileUrl)) await BuildAndStorePdfAsync(certificate, NewVerificationToken(), ct);
        var bytes = await files.ReadBytesAsync(certificate.PdfFileUrl, ct);
        return bytes is null ? NotFound(new { message = "Belge dosyası bulunamadı." }) : File(bytes, "application/pdf", $"{certificate.DocumentNumber}.pdf");
    }

    private async Task<DrivingCertificate> CreateCertificateAsync(DrivingGraduationRecord graduation, Guid profileId, DrivingCertificateType type, DrivingCertificate? old, string reason, CancellationToken ct)
    {
        var token = NewVerificationToken();
        var certificate = new DrivingCertificate { GraduationRecordId = graduation.Id, StudentDrivingProfileId = profileId, CertificateType = type,
            DocumentNumber = $"SRK-{DateTime.UtcNow:yyyy}-{Convert.ToHexString(RandomNumberGenerator.GetBytes(5))}", IssuedByUserId = CurrentUserId(),
            Version = (old?.Version ?? 0) + 1, ReissuedFromCertificateId = old?.Id, ReissueReason = reason, VerificationTokenHash = HashToken(token) };
        db.DrivingCertificates.Add(certificate); await db.SaveChangesAsync(ct);
        await BuildAndStorePdfAsync(certificate, token, ct);
        await audit.LogChangeAsync("Sertifika oluşturuldu", AuditCategory, nameof(DrivingCertificate), certificate.Id.ToString(), reason, null, new { certificate.DocumentNumber, certificate.Version }, ct);
        return certificate;
    }

    private async Task BuildAndStorePdfAsync(DrivingCertificate certificate, string token, CancellationToken ct)
    {
        var row = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.Id == certificate.StudentDrivingProfileId)
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p.LicenseClass, s.FullName }).SingleAsync(ct);
        var tenantId = db.CurrentTenantId ?? throw new InvalidOperationException("Tenant bağlamı bulunamadı.");
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == tenantId, ct);
        var settings = await ResolveSettingsAsync(ct);
        var director = string.IsNullOrWhiteSpace(settings.CertificateDirectorName) ? tenant.ContactName : settings.CertificateDirectorName;
        var logo = await ReadSafeCertificateImageAsync(settings.CertificateLogoUrl, ct);
        var signature = await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct);
        var verificationUrl = $"{PublicVerificationBaseUrl()}/api/public/driving-certificates/{Uri.EscapeDataString(certificate.DocumentNumber)}/verify?token={Uri.EscapeDataString(token)}";
        var snapshot = new CertificateSnapshot(tenant.Name, row.FullName, row.LicenseClass, director, settings.CertificateDirectorTitle);
        certificate.SnapshotJson = JsonSerializer.Serialize(snapshot);
        certificate.VerificationTokenHash = HashToken(token);
        var bytes = pdf.Generate(new DrivingCertificatePdfModel(tenant.Name, row.FullName, row.LicenseClass, certificate.DocumentNumber,
            certificate.CertificateType == DrivingCertificateType.Completion ? "EĞİTİM TAMAMLAMA BELGESİ" : "BAŞARI BELGESİ", certificate.IssuedAtUtc,
            director, settings.CertificateDirectorTitle, settings.CertificatePrimaryColor, verificationUrl, logo, signature));
        await using var stream = new MemoryStream(bytes);
        var asset = await files.SaveAsync(stream, $"{certificate.DocumentNumber}.pdf", "application/pdf", "driving-certificates", $"{Request.Scheme}://{Request.Host}", ct);
        certificate.PdfFileUrl = asset.FileUrl; await db.SaveChangesAsync(ct);
    }

    private async Task ApplyGraduationRevocationAsync(DrivingGraduationActionRequest request, CancellationToken ct)
    {
        var graduation = await db.DrivingGraduationRecords.SingleAsync(x => x.Id == request.GraduationRecordId, ct);
        graduation.Status = DrivingGraduationStatus.Revoked; graduation.RevokedAtUtc = DateTime.UtcNow; graduation.RevokedByUserId = CurrentUserId(); graduation.RevocationReason = request.Reason;
        var profile = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == request.StudentDrivingProfileId, ct); profile.Status = DrivingStudentStatus.GraduationPending;
        var certs = await db.DrivingCertificates.Where(x => x.GraduationRecordId == graduation.Id && x.Status == DrivingCertificateStatus.Active).ToListAsync(ct);
        foreach (var cert in certs) { cert.Status = DrivingCertificateStatus.Revoked; cert.RevokedAtUtc = DateTime.UtcNow; cert.RevokedByUserId = CurrentUserId(); cert.RevocationReason = request.Reason; }
        request.Status = DrivingGraduationActionStatus.Applied; request.AppliedAtUtc = DateTime.UtcNow;
        await notifier.NotifyStudentAsync(profile.Id, "Mezuniyet kaydı geri alındı", "Kurumunuz ayrıntılar için sizinle iletişime geçecektir.", DrivingNotificationCategories.Exam,
            dedupeKey: $"graduation-revoked:{request.Id}", relatedEntityType: nameof(DrivingGraduationRecord), relatedEntityId: graduation.Id.ToString(), cancellationToken: ct);
    }

    private async Task<GraduationChecklistResponse?> BuildChecklistAsync(Guid profileId, CancellationToken ct)
    {
        var profile = await db.StudentDrivingProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == profileId, ct); if (profile is null) return null;
        var student = await db.Students.AsNoTracking().SingleAsync(x => x.Id == profile.StudentId, ct);
        var package = await db.DrivingPackages.AsNoTracking().SingleAsync(x => x.Id == profile.PackageId, ct);
        var settings = await ResolveSettingsAsync(ct); var now = DateTime.UtcNow;
        var required = DrivingStudentRules.RequiredDocumentsFor(student.BirthDate, now);
        var documents = await db.StudentDrivingDocuments.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId && x.IsCurrent).ToListAsync(ct);
        var satisfied = documents.Where(x => DrivingStudentRules.CountsAsSatisfied(x.Status, x.ExpiresAtUtc, now)).Select(x => x.DocumentType).ToHashSet();
        var missing = DrivingStudentRules.MissingDocuments(required, satisfied);
        var attendance = await db.DrivingTheoryAttendances.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId)
            .Join(db.DrivingTheorySessions.AsNoTracking().Where(x => x.Status != DrivingTheorySessionStatus.Cancelled), a => a.TheorySessionId, s => s.Id,
                (a, s) => new { a.Status, Minutes = (int)(s.EndsAtUtc - s.StartsAtUtc).TotalMinutes }).ToListAsync(ct);
        var scheduledMinutes = attendance.Sum(x => x.Minutes); var attendedMinutes = attendance.Where(x => x.Status is DrivingTheoryAttendanceStatus.Present or DrivingTheoryAttendanceStatus.Late).Sum(x => x.Minutes);
        var excusedMinutes = attendance.Where(x => x.Status == DrivingTheoryAttendanceStatus.Excused).Sum(x => x.Minutes);
        var denominator = settings.ExcusedAbsencePolicy == DrivingExcusedAbsencePolicy.ExcludeFromCalculation ? Math.Max(0, scheduledMinutes - excusedMinutes) : scheduledMinutes;
        if (settings.ExcusedAbsencePolicy == DrivingExcusedAbsencePolicy.CountsAsPresent) attendedMinutes += excusedMinutes;
        var attendancePercent = denominator == 0 ? 0m : Math.Round(attendedMinutes * 100m / denominator, 2);
        var drivingPeriods = await db.DrivingLessons.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId && x.CompletedAtUtc != null).Select(x => new { x.StartedAtUtc, x.CompletedAtUtc }).ToListAsync(ct);
        var drivingMinutes = drivingPeriods.Sum(x => (int)(x.CompletedAtUtc!.Value - x.StartedAtUtc).TotalMinutes);
        var passedTypes = await db.DrivingExamCandidates.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingExamCandidateStatus.Passed)
            .Join(db.DrivingExamSessions.AsNoTracking(), x => x.ExamSessionId, x => x.Id, (_, exam) => exam.ExamType).Distinct().ToListAsync(ct);
        var debt = profile.EnrollmentContractId is Guid contractId ? await db.FinanceInstallments.AsNoTracking().Where(x => x.EnrollmentContractId == contractId).SumAsync(x => x.Amount - x.PaidAmount, ct) : 0m;
        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var openAppointments = await db.DrivingAppointments.AsNoTracking().CountAsync(x => x.StudentDrivingProfileId == profileId && blocking.Contains(x.Status), ct);
        var pendingRequests = await db.DrivingAppointmentRequests.AsNoTracking().CountAsync(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingAppointmentRequestStatus.Pending, ct);
        var contractExists = profile.EnrollmentContractId.HasValue;
        var contractSigned = contractExists && profile.ContractSignedAtUtc.HasValue && !string.IsNullOrWhiteSpace(profile.SignatureUrl);
        var items = new List<GraduationChecklistItem>
        {
            new("contract", "Sözleşme ve imza", contractSigned, !contractExists ? "Kayıt sözleşmesi bulunmuyor." : contractSigned ? $"İmzalandı: {profile.ContractSignedAtUtc:dd.MM.yyyy}" : "Sözleşme imzası eksik."),
            new("kvkk", "KVKK aydınlatma/onay kaydı", profile.KvkkConsentAtUtc.HasValue, profile.KvkkConsentAtUtc.HasValue ? $"Onay: {profile.KvkkConsentAtUtc:dd.MM.yyyy}" : "KVKK onay kaydı bulunmuyor."),
            new("communicationConsent", "İletişim izni (bilgi)", true, profile.CommunicationConsent ? "İzin verildi." : "İzin verilmedi; mezuniyeti etkilemez."),
            new("documents", "Zorunlu kursiyer evrakları", missing.Count == 0, missing.Count == 0 ? "Tüm belgeler onaylı ve geçerli." : $"Eksik/geçersiz: {string.Join(", ", missing.Select(DrivingStudentRules.DocumentLabel))}"),
            new("theory", "Teorik eğitim ve devam", attendedMinutes >= package.TheoryLessonMinutes && attendancePercent >= settings.MinimumTheoryAttendancePercent,
                $"{attendedMinutes}/{package.TheoryLessonMinutes} dakika; devam %{attendancePercent:0.##} (asgari %{settings.MinimumTheoryAttendancePercent:0.##}, mazeret: {settings.ExcusedAbsencePolicy})"),
            // Taban = max(paket, mevzuat asgarisi): kurum paketi düşük tutsa bile
            // bilinen sınıflarda mevzuat asgarisinin altında mezuniyet verilmez.
            new("practice", "Direksiyon eğitimi",
                drivingMinutes >= Math.Max(package.DrivingLessonMinutes, DrivingCurriculum.MinimumPracticeMinutesFor(profile.LicenseClass)),
                $"{drivingMinutes}/{Math.Max(package.DrivingLessonMinutes, DrivingCurriculum.MinimumPracticeMinutesFor(profile.LicenseClass))} dakika"
                    + (DrivingCurriculum.MinimumPracticeMinutesFor(profile.LicenseClass) > package.DrivingLessonMinutes
                        ? $" (mevzuat asgarisi: {DrivingCurriculum.MinimumPracticeLessonHoursFor(profile.LicenseClass)} ders saati)" : string.Empty)),
            new("theoryExam", "E-sınav sonucu", passedTypes.Contains(DrivingExamType.TheoryEExam), passedTypes.Contains(DrivingExamType.TheoryEExam) ? "Geçti" : "Başarılı sonuç yok"),
            new("drivingExam", "Direksiyon sınavı sonucu", passedTypes.Contains(DrivingExamType.DrivingPractice), passedTypes.Contains(DrivingExamType.DrivingPractice) ? "Geçti" : "Başarılı sonuç yok"),
            new("finance", "Finansal kapanış", debt <= 0, debt <= 0 ? "Borç yok" : $"Kalan borç: {debt:0.00} TRY"),
            new("schedule", "Açık randevu ve talepler", openAppointments == 0 && pendingRequests == 0, $"{openAppointments} açık randevu, {pendingRequests} bekleyen talep"),
        };
        return new GraduationChecklistResponse(profileId, student.FullName, items.All(x => x.Completed), items, now, attendancePercent, settings.MinimumTheoryAttendancePercent, settings.ExcusedAbsencePolicy.ToString());
    }

    private async Task<DrivingSchoolSettings> ResolveSettingsAsync(CancellationToken ct) => await db.DrivingSchoolSettings.SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();
    private async Task<bool> CanAccessProfileAsync(Guid profileId, CancellationToken ct) => await CanUseModuleAsync(ct) && (!User.IsInRole("Student") || await CurrentStudentProfileIdAsync(ct) == profileId);
    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private string CurrentUserName() { var value = (User.FindFirstValue("name") ?? User.Identity?.Name ?? "Sistem").Trim(); return string.IsNullOrWhiteSpace(value) ? "Sistem" : value; }
    private async Task<Guid?> CurrentStudentProfileIdAsync(CancellationToken ct) { var id = CurrentUserId(); return id is null ? null : await db.StudentDrivingProfiles.Join(db.Students.Where(x => x.UserId == id), p => p.StudentId, s => s.Id, (p, _) => (Guid?)p.Id).SingleOrDefaultAsync(ct); }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }
    private static string NewVerificationToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    private string PublicVerificationBaseUrl()
    {
        var configured = configuration["CertificateVerification:PublicBaseUrl"]?.Trim().TrimEnd('/');
        return !string.IsNullOrWhiteSpace(configured) ? configured : $"{Request.Scheme}://{Request.Host}";
    }
    private static bool IsCertificateAssetPath(string? value) => !string.IsNullOrWhiteSpace(value)
        && value.Trim().StartsWith("/uploads/driving-certificate-assets/", StringComparison.OrdinalIgnoreCase);
    private async Task<List<string>> CertificateSetupMissingAsync(DrivingSchoolSettings settings, CancellationToken ct)
    {
        var missing = new List<string>();
        if (settings.CertificateDirectorName.Trim().Length < 2) missing.Add("directorName");
        if (settings.CertificateDirectorTitle.Trim().Length < 2) missing.Add("directorTitle");
        if (!System.Text.RegularExpressions.Regex.IsMatch(settings.CertificatePrimaryColor, "^#[0-9A-Fa-f]{6}$")) missing.Add("primaryColor");
        if (await ReadSafeCertificateImageAsync(settings.CertificateLogoUrl, ct) is null) missing.Add("logoUrl");
        if (await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct) is null) missing.Add("signatureUrl");
        return missing;
    }
    private async Task<List<string>> CertificateIssuanceMissingAsync(DrivingSchoolSettings settings, CancellationToken ct)
    {
        var missing = await CertificateSetupMissingAsync(settings, ct);
        if (!IsCertificateSettingsApproved(settings)) missing.Add("approval");
        return missing;
    }
    private static bool IsCertificateSettingsApproved(DrivingSchoolSettings settings) =>
        settings.CertificateSettingsApprovedAtUtc.HasValue
        && settings.CertificateSettingsApprovedRevision == settings.CertificateSettingsRevision;
    private static object CertificateSettingsResponse(DrivingSchoolSettings settings, IReadOnlyList<string> missing) => new
    {
        directorName = settings.CertificateDirectorName,
        directorTitle = settings.CertificateDirectorTitle,
        logoUrl = settings.CertificateLogoUrl,
        signatureUrl = settings.CertificateSignatureUrl,
        primaryColor = settings.CertificatePrimaryColor,
        settings.MinimumTheoryAttendancePercent,
        excusedAbsencePolicy = settings.ExcusedAbsencePolicy.ToString(),
        setupComplete = missing.Count == 0,
        missingFields = missing,
        approved = IsCertificateSettingsApproved(settings),
        settings.CertificateSettingsRevision,
        settings.CertificateSettingsApprovedAtUtc,
        settings.UpdatedAtUtc,
    };
    private static object CertificateSettingsSnapshot(DrivingSchoolSettings settings) => new
    {
        settings.CertificateDirectorName, settings.CertificateDirectorTitle, settings.CertificateLogoUrl,
        settings.CertificateSignatureUrl, settings.CertificatePrimaryColor, settings.MinimumTheoryAttendancePercent, settings.ExcusedAbsencePolicy,
        settings.CertificateSettingsRevision, settings.CertificateSettingsApprovedRevision,
    };
    private async Task<byte[]?> ReadSafeCertificateImageAsync(string url, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("/uploads/driving-certificate-assets/", StringComparison.OrdinalIgnoreCase)) return null;
        var bytes = await files.ReadBytesAsync(url, ct);
        if (bytes is null || bytes.Length is 0 or > 5 * 1024 * 1024) return null;
        var png = bytes.Length > 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var jpeg = bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        var webp = bytes.Length > 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP";
        return png || jpeg || webp ? bytes : null;
    }
}

public sealed record GraduationChecklistItem(string Key, string Label, bool Completed, string Detail);
public sealed record GraduationChecklistResponse(Guid StudentProfileId, string StudentName, bool Eligible, IReadOnlyList<GraduationChecklistItem> Items, DateTime CheckedAtUtc, decimal AttendancePercent, decimal MinimumAttendancePercent, string ExcusedAbsencePolicy);
public sealed record GraduateStudentRequest(string? Note);
public sealed record GraduationActionRequest(string? Reason, string[]? ChecklistKeys);
public sealed record GraduationDecisionRequest(string? Note);
public sealed record IssueCertificateRequest(string Type);
public sealed record CertificateReissueRequest(string? Reason);
public sealed record CertificateDeliveryRequest(string Status, string? DeliveredTo, string? Note);
public sealed record CertificateMebbisNoRequest(string? MebbisCertificateNo);
public sealed record UpdateDrivingCertificateSettingsRequest(
    string? DirectorName,
    string? DirectorTitle,
    string? LogoUrl,
    string? SignatureUrl,
    string? PrimaryColor,
    decimal MinimumTheoryAttendancePercent,
    string? ExcusedAbsencePolicy);
public sealed record ApproveDrivingCertificateSettingsRequest(bool Confirmed, string? Note);
public sealed record CertificateSnapshot(string InstitutionName, string StudentName, string LicenseClass, string DirectorName, string DirectorTitle);
