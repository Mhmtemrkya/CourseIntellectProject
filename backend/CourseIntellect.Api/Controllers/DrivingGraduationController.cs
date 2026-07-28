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
    IConfiguration configuration,
    IWebHostEnvironment environment) : ControllerBase
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
                photoUrl = p.LivePhotoUrl != "" ? p.LivePhotoUrl : p.PhotoUrl,
                // Onam formları ortak öğrenci kimliğiyle çalışır (bkz. /api/consent).
                studentProfileId = s.Id })
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
        return Ok(new
        {
            students,
            graduations,
            certificates,
            actionRequests,
            certificateSetup,
            canPrintCertificate = CanPrintCertificate(),
        });
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
        var signatureUrl = request.SignatureUrl?.Trim() ?? string.Empty;
        var primaryColor = request.PrimaryColor?.Trim().ToUpperInvariant() ?? string.Empty;
        if (directorName.Length is < 2 or > 150) return BadRequest(new { message = "Kurum müdürü adı 2-150 karakter olmalıdır." });
        if (directorTitle.Length is < 2 or > 100) return BadRequest(new { message = "Müdür unvanı 2-100 karakter olmalıdır." });
        if (request.MinimumTheoryAttendancePercent is < 0 or > 100) return BadRequest(new { message = "Asgari devam oranı 0-100 arasında olmalıdır." });
        if (!Enum.TryParse<DrivingExcusedAbsencePolicy>(request.ExcusedAbsencePolicy, true, out var policy) || !Enum.IsDefined(policy))
            return BadRequest(new { message = "Mazeretli devamsızlık politikası geçersiz." });
        if (!System.Text.RegularExpressions.Regex.IsMatch(primaryColor, "^#[0-9A-F]{6}$"))
            return BadRequest(new { message = "Sertifika rengi #RRGGBB biçiminde olmalıdır." });
        if (!IsCertificateAssetPath(signatureUrl))
            return BadRequest(new { message = "İmza güvenli sertifika yükleme alanından seçilmelidir." });
        if (await ReadSafeCertificateImageAsync(signatureUrl, ct) is null)
            return BadRequest(new { message = "İmza görseli bulunamadı veya desteklenmeyen bir görseldir." });

        var settings = await db.DrivingSchoolSettings.SingleOrDefaultAsync(ct);
        var before = settings is null ? null : CertificateSettingsSnapshot(settings);
        if (settings is null) { settings = new DrivingSchoolSettings(); db.DrivingSchoolSettings.Add(settings); }
        settings.CertificateDirectorName = directorName;
        settings.CertificateDirectorTitle = directorTitle;
        if (request.InstitutionName is not null) settings.FormInstitutionName = request.InstitutionName.Trim();
        if (request.InstitutionCode is not null) settings.FormInstitutionCode = request.InstitutionCode.Trim();
        if (request.InstitutionCity is not null) settings.FormInstitutionCity = request.InstitutionCity.Trim();
        if (request.InstitutionDistrict is not null) settings.FormInstitutionDistrict = request.InstitutionDistrict.Trim();
        if (settings.FormInstitutionName.Length is < 2 or > 200)
            return BadRequest(new { message = "Resmî kurum adı 2-200 karakter olmalıdır." });
        if (settings.FormInstitutionCode.Length is < 2 or > 40)
            return BadRequest(new { message = "MEBBİS kurum kodu 2-40 karakter olmalıdır." });
        if (settings.FormInstitutionCity.Length is < 2 or > 60 || settings.FormInstitutionDistrict.Length is < 2 or > 60)
            return BadRequest(new { message = "Kurum il ve ilçe bilgileri zorunludur." });
        // Eğitim tamamlama belgesinde kurum logosu kullanılmaz. Resmî MEB logosu
        // uygulama paketinden okunur ve tenant tarafından değiştirilemez. Daha
        // önce yüklenmiş kurum görselini başka raporları etkilememek için silmeyiz.
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
        var logo = await ReadMinistryLogoAsync(ct);
        var signature = await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct);
        var today = DateTime.UtcNow;
        var bytes = pdf.Generate(new DrivingCertificatePdfModel(
            FirstNonEmpty(settings.FormInstitutionName, tenant.Name),
            settings.FormInstitutionCode,
            settings.FormInstitutionCity,
            settings.FormInstitutionDistrict,
            "ÖRNEK KURSİYER",
            "11111111110",
            "BABA ADI",
            "ANA ADI",
            "DOĞUM YERİ",
            "1998",
            "B",
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty,
            "ÖNİZLEME-2026-00001",
            "28146",
            "EĞİTİM TAMAMLAMA BELGESİ",
            today.AddMonths(-2),
            today,
            today,
            settings.CertificateDirectorName,
            "Kurum Müdürü",
            settings.CertificatePrimaryColor,
            $"{Request.Scheme}://{Request.Host}/api/public/driving-certificates/preview",
            logo,
            signature));
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

    /// <summary>
    /// Kontrol listesi tamamlanmayan bir kursiyeri, yalnızca hem mezuniyet yönetimi
    /// hem de istisna onay yetkisi bulunan kullanıcının açık ve gerekçeli kararıyla
    /// doğrudan mezun eder. İşlem tek adımda tamamlanır ancak eksik maddeler,
    /// kullanıcı ve gerekçe değiştirilemez audit kaydına yazılır.
    /// </summary>
    [HttpPost("students/{profileId:guid}/graduate-anyway")]
    [RequireDrivingPermission(DrivingPermissions.GraduationManage)]
    [RequireDrivingPermission(DrivingPermissions.GraduationOverrideApprove)]
    public async Task<IActionResult> GraduateAnyway(Guid profileId, [FromBody] ForceGraduateStudentRequest request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length is < 20 or > 500)
            return BadRequest(new { message = "Yine de mezun etme gerekçesi 20-500 karakter olmalıdır." });

        var checklist = await BuildChecklistAsync(profileId, ct);
        if (checklist is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        if (checklist.Eligible)
            return Conflict(new { message = "Kursiyer zaten tüm koşulları sağlıyor. Normal “Mezun Et” işlemini kullanın.", checklist });

        var profile = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == profileId, ct);
        var record = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId, ct)
            ?? new DrivingGraduationRecord { StudentDrivingProfileId = profileId };
        if (record.Status == DrivingGraduationStatus.Graduated && record.GraduatedAtUtc.HasValue)
            return Conflict(new { message = "Kursiyer zaten mezun edilmiş." });

        var actorId = CurrentUserId();
        if (actorId is null) return Forbid();
        var incomplete = checklist.Items.Where(x => !x.Completed)
            .Select(x => new { x.Key, x.Label, x.Detail }).ToList();

        if (db.Entry(record).State == EntityState.Detached) db.DrivingGraduationRecords.Add(record);
        record.Status = DrivingGraduationStatus.Graduated;
        record.ChecklistJson = JsonSerializer.Serialize(checklist.Items);
        record.CheckedAtUtc = DateTime.UtcNow;
        record.GraduatedAtUtc = DateTime.UtcNow;
        record.GraduatedByUserId = actorId;
        record.Note = $"Yetkili kararıyla mezun edildi. Gerekçe: {reason}";
        record.RevokedAtUtc = null;
        record.RevokedByUserId = null;
        record.RevocationReason = string.Empty;
        profile.Status = DrivingStudentStatus.Graduated;

        var pendingRequests = await db.DrivingGraduationActionRequests
            .Where(x => x.StudentDrivingProfileId == profileId
                && x.ActionType == DrivingGraduationActionType.EligibilityOverride
                && (x.Status == DrivingGraduationActionStatus.Pending || x.Status == DrivingGraduationActionStatus.FirstApproved))
            .ToListAsync(ct);
        foreach (var pending in pendingRequests) pending.Status = DrivingGraduationActionStatus.Cancelled;

        await db.SaveChangesAsync(ct);
        await notifier.NotifyStudentAsync(profileId, "Mezuniyetiniz onaylandı",
            "Kurum yetkilisi mezuniyet kaydınızı tamamladı. Belgeleriniz mezuniyet ekranından hazırlanabilir.",
            DrivingNotificationCategories.Exam,
            dedupeKey: $"graduation-force:{record.Id}:{record.GraduatedAtUtc:O}",
            relatedEntityType: nameof(DrivingGraduationRecord), relatedEntityId: record.Id.ToString(), cancellationToken: ct);
        await audit.LogChangeAsync("Kursiyer koşullar tamamlanmadan yetkili kararıyla mezun edildi", AuditCategory,
            nameof(DrivingGraduationRecord), record.Id.ToString(), reason, null,
            new { profileId, actorId, incomplete, cancelledRequestIds = pendingRequests.Select(x => x.Id).ToArray() }, ct);

        return Ok(new { record.Id, status = record.Status.ToString(), record.GraduatedAtUtc, forced = true, incomplete });
    }

    [HttpPost("students/{profileId:guid}/certificates")]
    [RequireDrivingPermission(DrivingPermissions.CertificateIssue)]
    public async Task<IActionResult> IssueCertificate(Guid profileId, [FromBody] IssueCertificateRequest request, CancellationToken ct)
    {
        if (!CanPrintCertificate()) return Forbid();
        if (!Enum.TryParse<DrivingCertificateType>(request.Type, true, out var type) || !Enum.IsDefined(type)) return BadRequest(new { message = "Belge türü geçersiz." });
        var graduation = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingGraduationStatus.Graduated, ct);
        if (graduation is null) return Conflict(new { message = "Kursiyer mezun edilmeden belge oluşturulamaz." });
        CertificateDocumentData? documentData = null;
        var systemDocumentData = await ResolveCertificateDocumentDataAsync(profileId, DateTime.UtcNow, ct);
        if (systemDocumentData is null)
            return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        if (request.Data is not null)
        {
            try
            {
                documentData = MergeAutomaticStudentData(
                    systemDocumentData,
                    NormalizeCertificateDocumentData(request.Data));
            }
            catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
        }
        else documentData = systemDocumentData;
        var active = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.StudentDrivingProfileId == profileId && x.CertificateType == type && x.Status == DrivingCertificateStatus.Active, ct);
        if (active is not null) return Ok(new { active.Id, active.DocumentNumber, type = active.CertificateType.ToString(), active.PdfFileUrl });
        var certificate = await CreateCertificateAsync(graduation, profileId, type, null, string.Empty, documentData, ct);
        return Ok(new { certificate.Id, certificate.DocumentNumber, type = certificate.CertificateType.ToString(), certificate.PdfFileUrl });
    }

    [HttpGet("students/{profileId:guid}/certificate-draft")]
    [RequireDrivingPermission(DrivingPermissions.CertificateIssue)]
    public async Task<IActionResult> CertificateDraft(Guid profileId, CancellationToken ct)
    {
        if (!CanPrintCertificate()) return Forbid();
        if (!await CanAccessProfileAsync(profileId, ct)) return Forbid();
        var data = await ResolveCertificateDocumentDataAsync(profileId, DateTime.UtcNow, ct);
        if (data is null) return NotFound(new { message = "Kursiyer kaydı bulunamadı." });
        var settings = await ResolveSettingsAsync(ct);
        var missing = MissingCertificateDocumentFields(data);
        if (await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct) is null) missing.Add("signature");
        return Ok(new
        {
            data,
            missingFields = missing,
            logoConfigured = true,
            logoSource = "MinistryOfNationalEducation",
            signatureConfigured = !missing.Contains("signature"),
            canCreateWithEmptyFields = true,
        });
    }

    [HttpPost("certificates/{id:guid}/reissue")]
    [RequireDrivingPermission(DrivingPermissions.CertificateIssue)]
    public async Task<IActionResult> Reissue(Guid id, [FromBody] CertificateReissueRequest request, CancellationToken ct)
    {
        if (!CanPrintCertificate()) return Forbid();
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length < 10) return BadRequest(new { message = "Yeniden basım gerekçesi en az 10 karakter olmalıdır." });
        var old = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (old is null) return NotFound();
        var graduation = await db.DrivingGraduationRecords.SingleOrDefaultAsync(x => x.Id == old.GraduationRecordId && x.Status == DrivingGraduationStatus.Graduated, ct);
        if (graduation is null) return Conflict(new { message = "Aktif mezuniyet olmadan belge yeniden basılamaz." });
        if (old.Status == DrivingCertificateStatus.Active) old.Status = DrivingCertificateStatus.Superseded;
        var certificate = await CreateCertificateAsync(
            graduation,
            old.StudentDrivingProfileId,
            old.CertificateType,
            old,
            reason,
            ExtractCertificateDocumentData(old.SnapshotJson),
            ct);
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
        if (!CanPrintCertificate()) return Forbid();
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
        // EK-6 üzerindeki resmî numara da değiştiği için PDF'yi yeni doğrulama
        // anahtarıyla yeniden üretiriz; eski dosya yanlış numara göstermemeli.
        await BuildAndStorePdfAsync(certificate, NewVerificationToken(), ct);
        return Ok(new { certificate.Id, certificate.MebbisCertificateNo });
    }

    [HttpGet("certificates/{id:guid}/download")]
    [RequireDrivingPermission(DrivingPermissions.GraduationView)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        if (!CanPrintCertificate()) return Forbid();
        var certificate = await db.DrivingCertificates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (certificate is null || !await CanAccessProfileAsync(certificate.StudentDrivingProfileId, ct)) return NotFound();
        if (string.IsNullOrWhiteSpace(certificate.PdfFileUrl) || !UsesCurrentCertificateLayout(certificate.SnapshotJson))
            await BuildAndStorePdfAsync(certificate, NewVerificationToken(), ct);
        var bytes = await files.ReadBytesAsync(certificate.PdfFileUrl, ct);
        return bytes is null ? NotFound(new { message = "Belge dosyası bulunamadı." }) : File(bytes, "application/pdf", $"{certificate.DocumentNumber}.pdf");
    }

    private async Task<DrivingCertificate> CreateCertificateAsync(
        DrivingGraduationRecord graduation,
        Guid profileId,
        DrivingCertificateType type,
        DrivingCertificate? old,
        string reason,
        CertificateDocumentData? documentData,
        CancellationToken ct)
    {
        var token = NewVerificationToken();
        var certificate = new DrivingCertificate { GraduationRecordId = graduation.Id, StudentDrivingProfileId = profileId, CertificateType = type,
            DocumentNumber = $"SRK-{DateTime.UtcNow:yyyy}-{Convert.ToHexString(RandomNumberGenerator.GetBytes(5))}", IssuedByUserId = CurrentUserId(),
            Version = (old?.Version ?? 0) + 1, ReissuedFromCertificateId = old?.Id, ReissueReason = reason, VerificationTokenHash = HashToken(token) };
        db.DrivingCertificates.Add(certificate); await db.SaveChangesAsync(ct);
        await BuildAndStorePdfAsync(certificate, token, ct, documentData);
        await audit.LogChangeAsync("Sertifika oluşturuldu", AuditCategory, nameof(DrivingCertificate), certificate.Id.ToString(), reason, null, new { certificate.DocumentNumber, certificate.Version }, ct);
        return certificate;
    }

    private async Task BuildAndStorePdfAsync(
        DrivingCertificate certificate,
        string token,
        CancellationToken ct,
        CertificateDocumentData? requestedDocumentData = null)
    {
        _ = db.CurrentTenantId ?? throw new InvalidOperationException("Tenant bağlamı bulunamadı.");
        var settings = await ResolveSettingsAsync(ct);
        var logo = await ReadMinistryLogoAsync(ct);
        var signature = await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct);
        var verificationUrl = $"{PublicVerificationBaseUrl()}/api/public/driving-certificates/{Uri.EscapeDataString(certificate.DocumentNumber)}/verify?token={Uri.EscapeDataString(token)}";
        var primaryColor = System.Text.RegularExpressions.Regex.IsMatch(settings.CertificatePrimaryColor ?? string.Empty, "^#[0-9A-Fa-f]{6}$")
            ? settings.CertificatePrimaryColor!
            : "#173B57";
        var storedOrRequestedDocumentData = requestedDocumentData
            ?? ExtractCertificateDocumentData(certificate.SnapshotJson)
            ?? await ResolveCertificateDocumentDataAsync(certificate.StudentDrivingProfileId, certificate.IssuedAtUtc, ct);
        var automaticDocumentData = await ResolveCertificateDocumentDataAsync(
            certificate.StudentDrivingProfileId,
            certificate.IssuedAtUtc,
            ct);
        var documentData = automaticDocumentData is null
            ? storedOrRequestedDocumentData
            : storedOrRequestedDocumentData is null
                ? automaticDocumentData
                : MergeAutomaticStudentData(automaticDocumentData, storedOrRequestedDocumentData);
        if (documentData is null) throw new InvalidOperationException("Belge verileri oluşturulamadı.");
        var snapshot = new CertificateSnapshot(
            4,
            documentData.InstitutionName,
            documentData.StudentName,
            documentData.LicenseClass,
            documentData.DirectorName,
            documentData.DirectorTitle,
            documentData);
        certificate.SnapshotJson = JsonSerializer.Serialize(snapshot);
        certificate.VerificationTokenHash = HashToken(token);
        var bytes = pdf.Generate(new DrivingCertificatePdfModel(
            documentData.InstitutionName,
            documentData.InstitutionCode,
            documentData.InstitutionCity,
            documentData.InstitutionDistrict,
            documentData.StudentName,
            documentData.IdentityNumber,
            documentData.FatherName,
            documentData.MotherName,
            documentData.BirthPlace,
            documentData.BirthYear,
            documentData.LicenseClass,
            documentData.ExistingLicenseCity,
            documentData.ExistingLicenseDate,
            documentData.ExistingLicenseNumber,
            documentData.ExistingLicenseClasses,
            certificate.DocumentNumber,
            certificate.MebbisCertificateNo,
            certificate.CertificateType == DrivingCertificateType.Completion
                ? "EĞİTİM TAMAMLAMA BELGESİ"
                : "BAŞARI BELGESİ",
            documentData.CourseStartedAtUtc,
            documentData.ExamPassedAtUtc,
            documentData.IssuedAtUtc,
            documentData.DirectorName,
            documentData.DirectorTitle,
            primaryColor,
            verificationUrl,
            logo,
            signature));
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
        var satisfied = documents.Where(x => DrivingStudentRules.CountsAsSatisfied(x.Status)).Select(x => x.DocumentType).ToHashSet();
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
    private bool CanPrintCertificate() => User.IsInRole("BranchManager") || User.IsInRole("Admin");
    private static bool UsesCurrentCertificateLayout(string? snapshotJson)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson)) return false;
        try
        {
            using var json = JsonDocument.Parse(snapshotJson);
            // v4: kursiyer verileri sistem kaydından birleştirilir ve resmî MEB
            // logosu kullanılır. Eski PDF'ler ilk indirmede güvenli biçimde yenilenir.
            return json.RootElement.TryGetProperty("LayoutVersion", out var value) && value.GetInt32() >= 4;
        }
        catch (JsonException)
        {
            return false;
        }
    }
    private static string FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;
    private static string LocalDate(DateTime? utc) =>
        utc.HasValue ? utc.Value.AddHours(3).ToString("dd.MM.yyyy") : string.Empty;
    private static string BirthYear(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        if (DateTime.TryParse(value, System.Globalization.CultureInfo.GetCultureInfo("tr-TR"),
                System.Globalization.DateTimeStyles.None, out var parsed))
            return parsed.Year.ToString();
        var match = System.Text.RegularExpressions.Regex.Match(value, @"\b(19|20)\d{2}\b");
        return match.Success ? match.Value : string.Empty;
    }

    private async Task<CertificateDocumentData?> ResolveCertificateDocumentDataAsync(
        Guid profileId,
        DateTime issuedAtUtc,
        CancellationToken ct)
    {
        var row = await db.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(db.Students.AsNoTracking(), profile => profile.StudentId, student => student.Id,
                (profile, student) => new { profile, student })
            .SingleOrDefaultAsync(ct);
        if (row is null || db.CurrentTenantId is not Guid tenantId) return null;

        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(x => x.Id == tenantId, ct);
        var settings = await ResolveSettingsAsync(ct);
        // Uygulamadaki Şube Müdürü, resmî belgede Kurum Müdürü olarak gösterilir.
        var branchManager = await db.Staff.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId
                && x.BranchId == row.student.BranchId
                && x.Role == UserRole.BranchManager)
            .OrderBy(x => x.FullName)
            .Select(x => x.FullName)
            .FirstOrDefaultAsync(ct);
        var orgManager = row.student.BranchId is Guid branchId
            ? await db.OrgUnits.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.Id == branchId)
                .Select(x => x.ManagerName)
                .FirstOrDefaultAsync(ct)
            : null;
        var graduation = await db.DrivingGraduationRecords.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId
                && x.Status == DrivingGraduationStatus.Graduated)
            .OrderByDescending(x => x.GraduatedAtUtc)
            .Select(x => (DateTime?)x.GraduatedAtUtc)
            .FirstOrDefaultAsync(ct);
        var passedDrivingExam = await db.DrivingExamCandidates.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId
                && x.Status == DrivingExamCandidateStatus.Passed)
            .Join(
                db.DrivingExamSessions.AsNoTracking()
                    .Where(x => x.ExamType == DrivingExamType.DrivingPractice),
                candidate => candidate.ExamSessionId,
                session => session.Id,
                (_, session) => (DateTime?)session.StartsAtUtc)
            .OrderByDescending(x => x)
            .FirstOrDefaultAsync(ct);

        return new CertificateDocumentData(
            FirstNonEmpty(settings.FormInstitutionName, tenant.Name, "Sürücü Kursu"),
            settings.FormInstitutionCode,
            settings.FormInstitutionCity,
            settings.FormInstitutionDistrict,
            row.student.FullName,
            FirstNonEmpty(row.profile.IdentityNumber, row.student.TcNo),
            row.profile.FatherName,
            row.profile.MotherName,
            row.profile.BirthPlace,
            BirthYear(row.student.BirthDate),
            row.profile.LicenseClass,
            row.profile.HasExistingLicense ? row.profile.LicenseIssuePlace : string.Empty,
            row.profile.HasExistingLicense ? LocalDate(row.profile.LicenseIssueDate) : string.Empty,
            row.profile.HasExistingLicense ? row.profile.ExistingLicenseNumber : string.Empty,
            row.profile.HasExistingLicense ? row.profile.ExistingLicenseClasses : string.Empty,
            row.profile.CourseStartsAtUtc ?? row.profile.RegisteredAtUtc,
            passedDrivingExam ?? row.profile.DrivingExamDate ?? graduation,
            issuedAtUtc,
            FirstNonEmpty(
                branchManager,
                orgManager,
                settings.FormDirectorName,
                settings.CertificateDirectorName,
                tenant.ContactName),
            "Kurum Müdürü");
    }

    private static CertificateDocumentData NormalizeCertificateDocumentData(CertificateDocumentData data) =>
        new(
            CleanCertificateText(data.InstitutionName, 200, "Kurum adı"),
            CleanCertificateText(data.InstitutionCode, 40, "Kurum kodu"),
            CleanCertificateText(data.InstitutionCity, 60, "Kurum ili"),
            CleanCertificateText(data.InstitutionDistrict, 60, "Kurum ilçesi"),
            CleanCertificateText(data.StudentName, 150, "Kursiyer adı"),
            CleanCertificateText(data.IdentityNumber, 30, "Kimlik numarası"),
            CleanCertificateText(data.FatherName, 100, "Baba adı"),
            CleanCertificateText(data.MotherName, 100, "Ana adı"),
            CleanCertificateText(data.BirthPlace, 100, "Doğum yeri"),
            CleanCertificateText(data.BirthYear, 4, "Doğum yılı"),
            CleanCertificateText(data.LicenseClass, 20, "Sertifika sınıfı"),
            CleanCertificateText(data.ExistingLicenseCity, 100, "Mevcut belge ili"),
            CleanCertificateText(data.ExistingLicenseDate, 20, "Mevcut belge tarihi"),
            CleanCertificateText(data.ExistingLicenseNumber, 50, "Mevcut belge numarası"),
            CleanCertificateText(data.ExistingLicenseClasses, 50, "Mevcut belge sınıfları"),
            NormalizeCertificateDate(data.CourseStartedAtUtc, "Kurs başlangıç tarihi"),
            NormalizeCertificateDate(data.ExamPassedAtUtc, "Sınav tarihi"),
            NormalizeCertificateDate(data.IssuedAtUtc, "Düzenleme tarihi"),
            CleanCertificateText(data.DirectorName, 150, "Kurum müdürü"),
            CleanCertificateText(data.DirectorTitle, 100, "Müdür unvanı"));

    /// <summary>
    /// Kursiyerin sistemde bulunan kimlik/eğitim verileri belge formunda her zaman
    /// önceliklidir. Eski kayıtlarda henüz bulunmayan alanlar ise kullanıcının
    /// belge modalına yazdığı değerle tamamlanabilir.
    /// </summary>
    private static CertificateDocumentData MergeAutomaticStudentData(
        CertificateDocumentData automatic,
        CertificateDocumentData requested) =>
        requested with
        {
            StudentName = FirstNonEmpty(automatic.StudentName, requested.StudentName),
            IdentityNumber = FirstNonEmpty(automatic.IdentityNumber, requested.IdentityNumber),
            FatherName = FirstNonEmpty(automatic.FatherName, requested.FatherName),
            MotherName = FirstNonEmpty(automatic.MotherName, requested.MotherName),
            BirthPlace = FirstNonEmpty(automatic.BirthPlace, requested.BirthPlace),
            BirthYear = FirstNonEmpty(automatic.BirthYear, requested.BirthYear),
            LicenseClass = FirstNonEmpty(automatic.LicenseClass, requested.LicenseClass),
            ExistingLicenseCity = FirstNonEmpty(automatic.ExistingLicenseCity, requested.ExistingLicenseCity),
            ExistingLicenseDate = FirstNonEmpty(automatic.ExistingLicenseDate, requested.ExistingLicenseDate),
            ExistingLicenseNumber = FirstNonEmpty(automatic.ExistingLicenseNumber, requested.ExistingLicenseNumber),
            ExistingLicenseClasses = FirstNonEmpty(automatic.ExistingLicenseClasses, requested.ExistingLicenseClasses),
            CourseStartedAtUtc = automatic.CourseStartedAtUtc ?? requested.CourseStartedAtUtc,
            ExamPassedAtUtc = automatic.ExamPassedAtUtc ?? requested.ExamPassedAtUtc,
        };

    private static string CleanCertificateText(string? value, int maxLength, string label)
    {
        var source = value ?? string.Empty;
        if (source.Length > maxLength * 2)
            throw new ArgumentException($"{label} en fazla {maxLength} karakter olabilir.");
        var cleaned = new string(source.Where(character => !char.IsControl(character)).ToArray()).Trim();
        if (cleaned.Length > maxLength)
            throw new ArgumentException($"{label} en fazla {maxLength} karakter olabilir.");
        return cleaned;
    }

    private static DateTime? NormalizeCertificateDate(DateTime? value, string label)
    {
        if (!value.HasValue) return null;
        if (value.Value.Year is < 1900 or > 2100)
            throw new ArgumentException($"{label} 1900-2100 aralığında olmalıdır.");
        return DateTime.SpecifyKind(value.Value.Date, DateTimeKind.Utc);
    }

    private static CertificateDocumentData? ExtractCertificateDocumentData(string? snapshotJson)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson)) return null;
        try
        {
            var snapshot = JsonSerializer.Deserialize<CertificateSnapshot>(snapshotJson);
            return snapshot?.DocumentData is null
                ? null
                : NormalizeCertificateDocumentData(snapshot.DocumentData);
        }
        catch (JsonException) { return null; }
        catch (ArgumentException) { return null; }
    }

    private static List<string> MissingCertificateDocumentFields(CertificateDocumentData data)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(data.InstitutionName)) missing.Add("institutionName");
        if (string.IsNullOrWhiteSpace(data.InstitutionCode)) missing.Add("institutionCode");
        if (string.IsNullOrWhiteSpace(data.InstitutionCity)) missing.Add("institutionCity");
        if (string.IsNullOrWhiteSpace(data.InstitutionDistrict)) missing.Add("institutionDistrict");
        if (string.IsNullOrWhiteSpace(data.StudentName)) missing.Add("studentName");
        if (string.IsNullOrWhiteSpace(data.IdentityNumber)) missing.Add("identityNumber");
        if (string.IsNullOrWhiteSpace(data.FatherName)) missing.Add("fatherName");
        if (string.IsNullOrWhiteSpace(data.MotherName)) missing.Add("motherName");
        if (string.IsNullOrWhiteSpace(data.BirthPlace)) missing.Add("birthPlace");
        if (string.IsNullOrWhiteSpace(data.BirthYear)) missing.Add("birthYear");
        if (string.IsNullOrWhiteSpace(data.LicenseClass)) missing.Add("licenseClass");
        if (!data.CourseStartedAtUtc.HasValue) missing.Add("courseStartedAtUtc");
        if (!data.ExamPassedAtUtc.HasValue) missing.Add("examPassedAtUtc");
        if (!data.IssuedAtUtc.HasValue) missing.Add("issuedAtUtc");
        if (string.IsNullOrWhiteSpace(data.DirectorName)) missing.Add("directorName");
        if (string.IsNullOrWhiteSpace(data.DirectorTitle)) missing.Add("directorTitle");
        return missing;
    }

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
        if (settings.FormInstitutionName.Trim().Length < 2) missing.Add("institutionName");
        if (settings.FormInstitutionCode.Trim().Length < 2) missing.Add("institutionCode");
        if (settings.FormInstitutionCity.Trim().Length < 2) missing.Add("institutionCity");
        if (settings.FormInstitutionDistrict.Trim().Length < 2) missing.Add("institutionDistrict");
        if (settings.CertificateDirectorName.Trim().Length < 2) missing.Add("directorName");
        if (settings.CertificateDirectorTitle.Trim().Length < 2) missing.Add("directorTitle");
        if (!System.Text.RegularExpressions.Regex.IsMatch(settings.CertificatePrimaryColor, "^#[0-9A-Fa-f]{6}$")) missing.Add("primaryColor");
        if (await ReadSafeCertificateImageAsync(settings.CertificateSignatureUrl, ct) is null) missing.Add("signatureUrl");
        return missing;
    }
    private static bool IsCertificateSettingsApproved(DrivingSchoolSettings settings) =>
        settings.CertificateSettingsApprovedAtUtc.HasValue
        && settings.CertificateSettingsApprovedRevision == settings.CertificateSettingsRevision;
    private static object CertificateSettingsResponse(DrivingSchoolSettings settings, IReadOnlyList<string> missing) => new
    {
        directorName = settings.CertificateDirectorName,
        directorTitle = settings.CertificateDirectorTitle,
        institutionName = settings.FormInstitutionName,
        institutionCode = settings.FormInstitutionCode,
        institutionCity = settings.FormInstitutionCity,
        institutionDistrict = settings.FormInstitutionDistrict,
        logoUrl = string.Empty,
        logoSource = "MinistryOfNationalEducation",
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
        settings.FormInstitutionName, settings.FormInstitutionCode, settings.FormInstitutionCity, settings.FormInstitutionDistrict,
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

    private async Task<byte[]> ReadMinistryLogoAsync(CancellationToken ct)
    {
        var path = Path.Combine(environment.ContentRootPath, "Assets", "meb-logo.png");
        if (!System.IO.File.Exists(path))
            throw new InvalidOperationException("Millî Eğitim Bakanlığı logo dosyası bulunamadı.");
        var bytes = await System.IO.File.ReadAllBytesAsync(path, ct);
        var isPng = bytes.Length > 8
            && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        if (!isPng || bytes.Length > 5 * 1024 * 1024)
            throw new InvalidOperationException("Millî Eğitim Bakanlığı logo dosyası geçersiz.");
        return bytes;
    }
}

public sealed record GraduationChecklistItem(string Key, string Label, bool Completed, string Detail);
public sealed record GraduationChecklistResponse(Guid StudentProfileId, string StudentName, bool Eligible, IReadOnlyList<GraduationChecklistItem> Items, DateTime CheckedAtUtc, decimal AttendancePercent, decimal MinimumAttendancePercent, string ExcusedAbsencePolicy);
public sealed record GraduateStudentRequest(string? Note);
public sealed record ForceGraduateStudentRequest(string? Reason);
public sealed record GraduationActionRequest(string? Reason, string[]? ChecklistKeys);
public sealed record GraduationDecisionRequest(string? Note);
public sealed record IssueCertificateRequest(string Type, CertificateDocumentData? Data = null);
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
    string? ExcusedAbsencePolicy,
    string? InstitutionName = null,
    string? InstitutionCode = null,
    string? InstitutionCity = null,
    string? InstitutionDistrict = null);
public sealed record ApproveDrivingCertificateSettingsRequest(bool Confirmed, string? Note);
public sealed record CertificateDocumentData(
    string InstitutionName,
    string InstitutionCode,
    string InstitutionCity,
    string InstitutionDistrict,
    string StudentName,
    string IdentityNumber,
    string FatherName,
    string MotherName,
    string BirthPlace,
    string BirthYear,
    string LicenseClass,
    string ExistingLicenseCity,
    string ExistingLicenseDate,
    string ExistingLicenseNumber,
    string ExistingLicenseClasses,
    DateTime? CourseStartedAtUtc,
    DateTime? ExamPassedAtUtc,
    DateTime? IssuedAtUtc,
    string DirectorName,
    string DirectorTitle);
public sealed record CertificateSnapshot(
    int LayoutVersion,
    string InstitutionName,
    string StudentName,
    string LicenseClass,
    string DirectorName,
    string DirectorTitle,
    CertificateDocumentData? DocumentData = null);
