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
using System.Data;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Randevunun durum makinesi: talep, onay, buluşma, iptal, devamsızlık ve yeniden
/// planlama. Ayrıca ders hakkı defterinin okunması ve gerekçeli elle düzeltmesi.
///
/// <para>Bu uçların ortak kuralı: dakika hesabı asla burada yapılmaz —
/// <see cref="IDrivingLedgerService"/>'e yazılır, bakiye ondan okunur.</para>
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school")]
public sealed class DrivingAppointmentsController(
    CourseIntellectDbContext dbContext,
    IDrivingLedgerService ledgerService,
    IDrivingAvailabilityService availabilityService,
    IDrivingNotifier notifier,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    // ─── Kurum randevu ayarları ───────────────────────────────────────────────

    [HttpGet("settings")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var settings = await ResolveSettingsAsync(ct);
        return Ok(new
        {
            settings.LateCancellationHours,
            settings.LateCancellationDeductPercent,
            settings.NoShowDeductPercent,
            settings.RequireApprovalForStudentRequests,
            settings.MinRescheduleHours,
            settings.MaxInstructorDailyMinutes,
            settings.MaxVehicleDailyMinutes,
            settings.MaxStudentDailyLessons,
            settings.MaxStudentDailyMinutes,
            settings.LessonEarliestHour,
            settings.LessonLatestHour,
            settings.FailedPracticeExtraLessonMinutes,
            settings.FailedPracticeExtraLessonFee,
            settings.MaxVehicleAgeYears,
            settings.PreparationMinutes,
            settings.FinancialHoldEnabled,
            settings.FinancialHoldThreshold,
            settings.MinimumTheoryAttendancePercent,
            excusedAbsencePolicy = settings.ExcusedAbsencePolicy.ToString(),
            settings.CertificateDirectorName,
            settings.CertificateDirectorTitle,
            settings.CertificateLogoUrl,
            settings.CertificateSignatureUrl,
            settings.CertificatePrimaryColor,
        });
    }

    [HttpPut("settings")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateDrivingSettingsRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.LateCancellationHours is < 0 or > 168) return BadRequest(new { message = "Geç iptal süresi 0-168 saat arasında olmalıdır." });
        if (request.MinRescheduleHours is < 0 or > 168) return BadRequest(new { message = "Yeniden planlama süresi 0-168 saat arasında olmalıdır." });
        if (request.LateCancellationDeductPercent is < 0 or > 100 || request.NoShowDeductPercent is < 0 or > 100)
            return BadRequest(new { message = "Kesinti yüzdesi 0-100 arasında olmalıdır." });
        if (request.MaxInstructorDailyMinutes is < 0 or > 1440 || request.MaxVehicleDailyMinutes is < 0 or > 1440)
            return BadRequest(new { message = "Günlük dakika limiti 0-1440 arasında olmalıdır (0 = sınırsız)." });
        if (request.MaxStudentDailyLessons is < 0 or > 10) return BadRequest(new { message = "Öğrenci günlük ders limiti 0-10 arasında olmalıdır." });
        if (request.MaxStudentDailyMinutes is < 0 or > 1440) return BadRequest(new { message = "Öğrenci günlük dakika limiti 0-1440 arasında olmalıdır (0 = sınırsız)." });
        if (request.LessonEarliestHour is < 0 or > 24 || request.LessonLatestHour is < 0 or > 24)
            return BadRequest(new { message = "Ders saat penceresi 0-24 arasında olmalıdır." });
        if (request.FailedPracticeExtraLessonMinutes is < 0 or > 1440) return BadRequest(new { message = "Zorunlu ek ders süresi 0-1440 dakika arasında olmalıdır (0 = kapalı)." });
        if (request.FailedPracticeExtraLessonFee is < 0 or > 1_000_000) return BadRequest(new { message = "Zorunlu ek ders ücreti geçersiz." });
        if (request.MaxVehicleAgeYears is < 0 or > 60) return BadRequest(new { message = "Araç yaş sınırı 0-60 arasında olmalıdır (0 = kapalı)." });
        if (request.PreparationMinutes is < 0 or > 240) return BadRequest(new { message = "Hazırlık süresi 0-240 dakika arasında olmalıdır." });
        if (request.FinancialHoldThreshold < 0) return BadRequest(new { message = "Borç eşiği negatif olamaz." });
        if (request.MinimumTheoryAttendancePercent is < 0 or > 100) return BadRequest(new { message = "Asgari devam oranı 0-100 arasında olmalıdır." });
        if (!Enum.TryParse<DrivingExcusedAbsencePolicy>(request.ExcusedAbsencePolicy, true, out var excusedPolicy) || !Enum.IsDefined(excusedPolicy))
            return BadRequest(new { message = "Mazeretli devamsızlık kuralı geçersiz." });

        var settings = await dbContext.DrivingSchoolSettings.SingleOrDefaultAsync(ct);
        var before = settings is null ? null : Snapshot(settings);
        if (settings is null)
        {
            settings = new DrivingSchoolSettings();
            dbContext.DrivingSchoolSettings.Add(settings);
        }

        settings.LateCancellationHours = request.LateCancellationHours;
        settings.LateCancellationDeductPercent = request.LateCancellationDeductPercent;
        settings.NoShowDeductPercent = request.NoShowDeductPercent;
        settings.RequireApprovalForStudentRequests = request.RequireApprovalForStudentRequests;
        settings.MinRescheduleHours = request.MinRescheduleHours;
        settings.MaxInstructorDailyMinutes = request.MaxInstructorDailyMinutes;
        settings.MaxVehicleDailyMinutes = request.MaxVehicleDailyMinutes;
        settings.MaxStudentDailyLessons = request.MaxStudentDailyLessons;
        settings.MaxStudentDailyMinutes = request.MaxStudentDailyMinutes;
        settings.LessonEarliestHour = request.LessonEarliestHour;
        settings.LessonLatestHour = request.LessonLatestHour;
        settings.FailedPracticeExtraLessonMinutes = request.FailedPracticeExtraLessonMinutes;
        settings.FailedPracticeExtraLessonFee = request.FailedPracticeExtraLessonFee;
        settings.MaxVehicleAgeYears = request.MaxVehicleAgeYears;
        settings.PreparationMinutes = request.PreparationMinutes;
        settings.FinancialHoldEnabled = request.FinancialHoldEnabled;
        settings.FinancialHoldThreshold = request.FinancialHoldThreshold;
        settings.MinimumTheoryAttendancePercent = request.MinimumTheoryAttendancePercent;
        settings.ExcusedAbsencePolicy = excusedPolicy;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Randevu ayarları güncellendi", AuditCategory, "DrivingSchoolSettings", settings.Id.ToString(),
            $"Geç iptal {settings.LateCancellationHours} saat / %{settings.LateCancellationDeductPercent}, devamsızlık %{settings.NoShowDeductPercent}, "
                + $"öğretmen günlük {settings.MaxInstructorDailyMinutes} dk, hazırlık {settings.PreparationMinutes} dk.",
            before, Snapshot(settings), ct);
        return Ok(new { settings.Id });
    }

    private static object Snapshot(DrivingSchoolSettings settings) => new
    {
        settings.LateCancellationHours,
        settings.LateCancellationDeductPercent,
        settings.NoShowDeductPercent,
        settings.RequireApprovalForStudentRequests,
        settings.MinRescheduleHours,
        settings.MaxInstructorDailyMinutes,
        settings.MaxVehicleDailyMinutes,
        settings.MaxStudentDailyLessons,
        settings.MaxStudentDailyMinutes,
        settings.LessonEarliestHour,
        settings.LessonLatestHour,
        settings.FailedPracticeExtraLessonMinutes,
        settings.FailedPracticeExtraLessonFee,
        settings.MaxVehicleAgeYears,
        settings.PreparationMinutes,
        settings.FinancialHoldEnabled,
        settings.FinancialHoldThreshold,
        settings.MinimumTheoryAttendancePercent,
        settings.ExcusedAbsencePolicy,
        settings.CertificateDirectorName,
        settings.CertificateDirectorTitle,
        settings.CertificateLogoUrl,
        settings.CertificateSignatureUrl,
        settings.CertificatePrimaryColor,
    };

    // ─── Durum geçişleri ──────────────────────────────────────────────────────

    /// <summary>Öğrencinin randevu talebi. Kurum ayarı isterse yönetici onayına düşer.</summary>
    [HttpPost("appointments/{id:guid}/approve")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentApprove)]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var appointment = await dbContext.DrivingAppointments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (appointment is null) return NotFound(new { message = "Randevu bulunamadı." });
        if (appointment.Status is not (DrivingAppointmentStatus.Requested or DrivingAppointmentStatus.WaitingApproval or DrivingAppointmentStatus.Planned))
            return Conflict(new { message = $"Bu randevu onaylanabilir durumda değil ({DrivingAppointmentStatuses.Label(appointment.Status)})." });

        var before = appointment.Status;
        appointment.Status = DrivingAppointmentStatus.Approved;
        AddStatusHistory(appointment.Id, before, DrivingAppointmentStatus.Approved, "Randevu onaylandı");
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Randevu onaylandı", AuditCategory, "DrivingAppointment", appointment.Id.ToString(),
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} randevusu onaylandı.",
            new { status = before.ToString() }, new { status = appointment.Status.ToString() }, ct);

        await notifier.NotifyStudentAsync(appointment.StudentDrivingProfileId,
            "Randevunuz onaylandı",
            $"{DrivingAvailability.ToLocal(appointment.StartsAtUtc):dd.MM.yyyy HH:mm} tarihli direksiyon dersiniz onaylandı.",
            DrivingNotificationCategories.Appointment,
            dedupeKey: $"appointment-approved:{appointment.Id}",
            relatedEntityType: "DrivingAppointment", relatedEntityId: appointment.Id.ToString(), cancellationToken: ct);

        return Ok(new { status = appointment.Status.ToString() });
    }

    /// <summary>Öğretmen buluşma noktasında öğrenciyle buluştu — ders başlatmaya hazır.</summary>
    [HttpPost("appointments/{id:guid}/check-in")]
    [Authorize(Roles = "Teacher")]
    [RequireDrivingPermission(DrivingPermissions.LessonStart)]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var instructorProfileId = await CurrentInstructorProfileIdAsync(ct);
        if (instructorProfileId is null) return Forbid();

        var appointment = await dbContext.DrivingAppointments.SingleOrDefaultAsync(x => x.Id == id && x.InstructorProfileId == instructorProfileId, ct);
        if (appointment is null) return NotFound(new { message = "Atanmış randevu bulunamadı." });
        if (appointment.Status is not (DrivingAppointmentStatus.Planned or DrivingAppointmentStatus.Approved))
            return Conflict(new { message = $"Bu randevuda buluşma kaydedilemez ({DrivingAppointmentStatuses.Label(appointment.Status)})." });

        var before = appointment.Status;
        appointment.Status = DrivingAppointmentStatus.CheckedIn;
        appointment.CheckedInAtUtc = DateTime.UtcNow;
        AddStatusHistory(appointment.Id, before, DrivingAppointmentStatus.CheckedIn, "Öğrenciyle buluşuldu");
        await dbContext.SaveChangesAsync(ct);
        return Ok(new { status = appointment.Status.ToString(), appointment.CheckedInAtUtc });
    }

    /// <summary>
    /// Randevu iptali. Kimin iptal ettiği duruma yazılır; ceza yalnızca öğrencinin
    /// GEÇ iptalinde uygulanır — kurum veya öğretmen iptalinde hak tam iade edilir.
    /// </summary>
    [HttpPost("appointments/{id:guid}/cancel")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCancel)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelAppointmentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length is < 5 or > 500) return BadRequest(new { message = "İptal nedeni 5-500 karakter olmalıdır." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var appointment = await LoadForActorAsync(id, ct);
        if (appointment is null) return NotFound(new { message = "Randevu bulunamadı." });
        if (!DrivingAppointmentStatuses.CanCancel(appointment.Status))
            return Conflict(new { message = $"Bu randevu iptal edilemez ({DrivingAppointmentStatuses.Label(appointment.Status)})." });

        var settings = await ResolveSettingsAsync(ct);
        var cancelledBy = ResolveCancellationActor();
        var lessonMinutes = (int)(appointment.EndsAtUtc - appointment.StartsAtUtc).TotalMinutes;

        // Ceza yalnızca ÖĞRENCİ kaynaklı ve GEÇ iptalde. Kurum/öğretmen iptalinde
        // öğrenci cezalandırılmaz — hakkı olduğu gibi geri döner.
        var isLate = cancelledBy == DrivingAppointmentStatus.CancelledByStudent
            && DrivingLessonBalance.IsLateStudentCancellation(appointment.StartsAtUtc, DateTime.UtcNow, settings.LateCancellationHours);
        var penalty = isLate
            ? DrivingLessonBalance.PenaltyMinutes(lessonMinutes, settings.LateCancellationDeductPercent)
            : 0;

        var before = appointment.Status;
        appointment.Status = cancelledBy;
        appointment.CancellationReason = reason;
        appointment.CancelledByUserId = CurrentUserId();
        appointment.CancelledAtUtc = DateTime.UtcNow;

        // Rezervasyon her hâlükârda serbest bırakılır; ceza varsa ayrı hareket olarak düşer.
        await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.ReservationReleased, lessonMinutes,
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} randevusu iptal edildi, rezervasyon çözüldü",
            appointmentId: appointment.Id, cancellationToken: ct);

        if (penalty > 0)
        {
            await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.CancelledDeductedMinutes, -penalty,
                $"Geç iptal cezası ({settings.LateCancellationHours} saatten yakın iptal)",
                appointmentId: appointment.Id, reason: reason, cancellationToken: ct);
        }

        AddStatusHistory(appointment.Id, before, cancelledBy, reason,
            penalty > 0 ? $"Geç iptal: {penalty} dk ders hakkından düşüldü." : "Ders hakkı iade edildi.");

        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(appointment.StudentDrivingProfileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var balance = await ledgerService.GetBalanceAsync(appointment.StudentDrivingProfileId, ct);
        await auditLogService.LogChangeAsync("Randevu iptal edildi", AuditCategory, "DrivingAppointment", appointment.Id.ToString(),
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} — {DrivingAppointmentStatuses.Label(cancelledBy)}. Gerekçe: {reason}."
                + (penalty > 0 ? $" Geç iptal cezası: {penalty} dk." : " Ceza uygulanmadı."),
            new { status = before.ToString() },
            new { status = cancelledBy.ToString(), reason, penaltyMinutes = penalty }, ct);

        // İptali kim yaptıysa KARŞI tarafa haber verilir; kendi yaptığı işlemi
        // kullanıcıya tekrar bildirmenin anlamı yok.
        var when = $"{DrivingAvailability.ToLocal(appointment.StartsAtUtc):dd.MM.yyyy HH:mm}";
        if (cancelledBy == DrivingAppointmentStatus.CancelledByStudent)
        {
            await notifier.NotifyInstructorAsync(appointment.InstructorProfileId,
                "Öğrenci dersi iptal etti",
                $"{when} tarihli dersiniz iptal edildi. Gerekçe: {reason}",
                DrivingNotificationCategories.Appointment,
                dedupeKey: $"appointment-cancelled-instructor:{appointment.Id}",
                relatedEntityType: "DrivingAppointment", relatedEntityId: appointment.Id.ToString(), cancellationToken: ct);
        }
        else
        {
            await notifier.NotifyStudentAsync(appointment.StudentDrivingProfileId,
                "Randevunuz iptal edildi",
                $"{when} tarihli dersiniz iptal edildi. Gerekçe: {reason}."
                    + (penalty > 0 ? $" {penalty} dk ders hakkınızdan düşüldü." : " Ders hakkınız iade edildi."),
                DrivingNotificationCategories.Appointment,
                dedupeKey: $"appointment-cancelled-student:{appointment.Id}",
                relatedEntityType: "DrivingAppointment", relatedEntityId: appointment.Id.ToString(), cancellationToken: ct);
        }

        return Ok(new
        {
            status = appointment.Status.ToString(),
            penaltyMinutes = penalty,
            isLateCancellation = isLate,
            remainingMinutes = balance.RemainingMinutes,
            availableMinutes = balance.AvailableMinutes,
        });
    }

    /// <summary>
    /// Devamsızlık: öğrenci gelmedi. Kurum ayarındaki yüzde kadar hak yanar,
    /// kalan rezervasyon serbest bırakılır.
    /// </summary>
    [HttpPost("appointments/{id:guid}/no-show")]
    [RequireDrivingPermission(DrivingPermissions.LessonMarkNoShow)]
    public async Task<IActionResult> MarkNoShow(Guid id, [FromBody] MarkNoShowRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var appointment = await LoadForActorAsync(id, ct);
        if (appointment is null) return NotFound(new { message = "Randevu bulunamadı." });
        if (!DrivingAppointmentStatuses.Blocking.Contains(appointment.Status) || appointment.Status == DrivingAppointmentStatus.InProgress)
            return Conflict(new { message = $"Bu randevuya devamsızlık yazılamaz ({DrivingAppointmentStatuses.Label(appointment.Status)})." });
        if (DateTime.UtcNow < appointment.StartsAtUtc)
            return BadRequest(new { message = "Devamsızlık ancak randevu saati geldikten sonra yazılabilir." });

        var settings = await ResolveSettingsAsync(ct);
        var lessonMinutes = (int)(appointment.EndsAtUtc - appointment.StartsAtUtc).TotalMinutes;
        var penalty = DrivingLessonBalance.PenaltyMinutes(lessonMinutes, settings.NoShowDeductPercent);

        var before = appointment.Status;
        appointment.Status = DrivingAppointmentStatus.NoShow;

        await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.ReservationReleased, lessonMinutes,
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} randevusunda devamsızlık, rezervasyon çözüldü",
            appointmentId: appointment.Id, cancellationToken: ct);

        if (penalty > 0)
        {
            await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.NoShowDeductedMinutes, -penalty,
                "Devamsızlık kesintisi", appointmentId: appointment.Id, reason: request.Note?.Trim(), cancellationToken: ct);
        }

        AddStatusHistory(appointment.Id, before, DrivingAppointmentStatus.NoShow,
            "Öğrenci derse gelmedi", $"{penalty} dk ders hakkından düşüldü. {request.Note?.Trim()}".Trim());

        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(appointment.StudentDrivingProfileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var balance = await ledgerService.GetBalanceAsync(appointment.StudentDrivingProfileId, ct);
        await auditLogService.LogChangeAsync("Devamsızlık yazıldı", AuditCategory, "DrivingAppointment", appointment.Id.ToString(),
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} — öğrenci gelmedi, {penalty} dk düşüldü.",
            new { status = before.ToString() },
            new { status = appointment.Status.ToString(), penaltyMinutes = penalty }, ct);

        await notifier.NotifyStudentAsync(appointment.StudentDrivingProfileId,
            "Derse gelmediniz",
            $"{DrivingAvailability.ToLocal(appointment.StartsAtUtc):dd.MM.yyyy HH:mm} tarihli dersinize katılmadığınız için "
                + $"{penalty} dakika ders hakkınızdan düşüldü. Kalan: {balance.RemainingMinutes} dk.",
            DrivingNotificationCategories.Appointment,
            dedupeKey: $"appointment-noshow:{appointment.Id}",
            relatedEntityType: "DrivingAppointment", relatedEntityId: appointment.Id.ToString(), cancellationToken: ct);

        return Ok(new { status = appointment.Status.ToString(), penaltyMinutes = penalty, remainingMinutes = balance.RemainingMinutes });
    }

    /// <summary>
    /// Yeniden planlama: eski randevu <c>Rescheduled</c> olur, yerine yeni randevu
    /// açılır ve ikisi birbirine bağlanır. Ders hakkı yanmaz — rezervasyon devreder.
    /// </summary>
    [HttpPost("appointments/{id:guid}/reschedule")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentReschedule)]
    public async Task<IActionResult> Reschedule(Guid id, [FromBody] RescheduleAppointmentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length is < 5 or > 500) return BadRequest(new { message = "Yeniden planlama nedeni 5-500 karakter olmalıdır." });

        var duration = request.EndsAtUtc - request.StartsAtUtc;
        if (request.StartsAtUtc < DateTime.UtcNow || duration < TimeSpan.FromMinutes(30) || duration > TimeSpan.FromHours(4))
            return BadRequest(new { message = "Yeni randevu zamanı 30 dakika ile 4 saat arasında ve gelecekte olmalıdır." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var appointment = await LoadForActorAsync(id, ct);
        if (appointment is null) return NotFound(new { message = "Randevu bulunamadı." });
        if (!DrivingAppointmentStatuses.CanCancel(appointment.Status))
            return Conflict(new { message = $"Bu randevu yeniden planlanamaz ({DrivingAppointmentStatuses.Label(appointment.Status)})." });

        var settings = await ResolveSettingsAsync(ct);
        if (appointment.StartsAtUtc - DateTime.UtcNow < TimeSpan.FromHours(settings.MinRescheduleHours))
            return BadRequest(new { message = $"Randevuya {settings.MinRescheduleHours} saatten az kaldığı için yeniden planlanamaz." });

        var instructorProfileId = request.InstructorProfileId ?? appointment.InstructorProfileId;
        var vehicleId = request.VehicleId ?? appointment.VehicleId;

        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var conflict = await dbContext.DrivingAppointments.AnyAsync(x =>
            x.Id != appointment.Id
            && blocking.Contains(x.Status)
            && x.StartsAtUtc < request.EndsAtUtc && x.EndsAtUtc > request.StartsAtUtc
            && (x.VehicleId == vehicleId || x.InstructorProfileId == instructorProfileId || x.StudentDrivingProfileId == appointment.StudentDrivingProfileId), ct);
        if (conflict) return Conflict(new { message = "Yeni zaman için öğrenci, öğretmen veya araç dolu." });

        // Sürükle-bırak da dâhil, yeni zaman TÜM uygunluk kurallarından geçer
        // (izin, çalışma saati, araç ataması, günlük limit, hazırlık payı).
        // Kendi eski randevusu çakışma sayılmasın diye hariç tutulur.
        var violations = await availabilityService.CheckAsync(
            new AppointmentCandidate(
                appointment.StudentDrivingProfileId, instructorProfileId, vehicleId,
                request.StartsAtUtc, request.EndsAtUtc, ExcludeAppointmentId: appointment.Id),
            ct);
        if (violations.Count > 0)
            return BadRequest(new
            {
                message = string.Join(" ", violations.Select(x => x.Message)),
                violations = violations.Select(x => new { x.Code, x.Message }),
            });

        var oldMinutes = (int)(appointment.EndsAtUtc - appointment.StartsAtUtc).TotalMinutes;
        var newMinutes = (int)duration.TotalMinutes;

        var replacement = new DrivingAppointment
        {
            StudentDrivingProfileId = appointment.StudentDrivingProfileId,
            InstructorProfileId = instructorProfileId,
            VehicleId = vehicleId,
            StartsAtUtc = request.StartsAtUtc,
            EndsAtUtc = request.EndsAtUtc,
            Status = DrivingAppointmentStatus.Planned,
            Notes = appointment.Notes,
            MeetingPoint = appointment.MeetingPoint,
            RescheduledFromAppointmentId = appointment.Id,
            CreatedByUserId = CurrentUserId(),
        };
        dbContext.DrivingAppointments.Add(replacement);

        var before = appointment.Status;
        appointment.Status = DrivingAppointmentStatus.Rescheduled;
        appointment.RescheduledToAppointmentId = replacement.Id;
        appointment.CancellationReason = reason;

        // Eski rezervasyon çözülür, yeni randevu için yeniden bloke edilir.
        // (Süre değiştiyse fark otomatik olarak doğru yansır.)
        await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.ReservationReleased, oldMinutes,
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} randevusu ertelendi", appointmentId: appointment.Id, cancellationToken: ct);
        await ledgerService.AddAsync(appointment.StudentDrivingProfileId, DrivingLedgerEntryType.PlannedMinutes, -newMinutes,
            $"{replacement.StartsAtUtc:dd.MM.yyyy HH:mm} yeni randevusu için ayrılan süre", appointmentId: replacement.Id, cancellationToken: ct);

        AddStatusHistory(appointment.Id, before, DrivingAppointmentStatus.Rescheduled, reason,
            $"Yeni randevu: {replacement.StartsAtUtc:dd.MM.yyyy HH:mm}");
        AddStatusHistory(replacement.Id, null, DrivingAppointmentStatus.Planned,
            "Yeniden planlamayla oluşturuldu", $"Kaynak randevu: {appointment.StartsAtUtc:dd.MM.yyyy HH:mm}");

        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(appointment.StudentDrivingProfileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync("Randevu yeniden planlandı", AuditCategory, "DrivingAppointment", appointment.Id.ToString(),
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} → {replacement.StartsAtUtc:dd.MM.yyyy HH:mm}. Gerekçe: {reason}",
            new { status = before.ToString(), startsAtUtc = appointment.StartsAtUtc },
            new { status = appointment.Status.ToString(), newAppointmentId = replacement.Id, startsAtUtc = replacement.StartsAtUtc }, ct);

        var message = $"Dersiniz {DrivingAvailability.ToLocal(appointment.StartsAtUtc):dd.MM.yyyy HH:mm} tarihinden "
            + $"{DrivingAvailability.ToLocal(replacement.StartsAtUtc):dd.MM.yyyy HH:mm} tarihine alındı. Gerekçe: {reason}";
        await notifier.NotifyStudentAsync(appointment.StudentDrivingProfileId,
            "Randevunuz yeniden planlandı", message, DrivingNotificationCategories.Appointment,
            dedupeKey: $"appointment-rescheduled-student:{replacement.Id}",
            relatedEntityType: "DrivingAppointment", relatedEntityId: replacement.Id.ToString(), cancellationToken: ct);
        await notifier.NotifyInstructorAsync(replacement.InstructorProfileId,
            "Ders yeniden planlandı", message, DrivingNotificationCategories.Appointment,
            dedupeKey: $"appointment-rescheduled-instructor:{replacement.Id}",
            relatedEntityType: "DrivingAppointment", relatedEntityId: replacement.Id.ToString(), cancellationToken: ct);

        return Ok(new { previousAppointmentId = appointment.Id, newAppointmentId = replacement.Id, status = replacement.Status.ToString() });
    }

    /// <summary>Randevunun tüm durum değişiklikleri: kim, ne zaman, neden.</summary>
    [HttpGet("appointments/{id:guid}/history")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> GetHistory(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var rows = await dbContext.DrivingAppointmentStatusHistory.AsNoTracking()
            .Where(x => x.AppointmentId == id)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                fromStatus = x.FromStatus == null ? null : x.FromStatus.ToString(),
                toStatus = x.ToStatus.ToString(),
                x.ChangedByName,
                x.Reason,
                x.Note,
                x.CreatedAtUtc,
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    // ─── Ders hakkı defteri ───────────────────────────────────────────────────

    [HttpGet("students/{profileId:guid}/ledger")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetLedger(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await dbContext.StudentDrivingProfiles.AnyAsync(x => x.Id == profileId, ct))
            return NotFound(new { message = "Kursiyer bulunamadı." });

        var balance = await ledgerService.GetBalanceAsync(profileId, ct);
        var reconciliation = await ledgerService.ReconcileAsync(profileId, ct);
        var entries = await dbContext.DrivingLessonLedgerEntries.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(300)
            .Select(x => new
            {
                x.Id,
                entryType = x.EntryType.ToString(),
                x.MinutesDelta,
                x.Description,
                x.Reason,
                x.AppointmentId,
                x.CreatedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(new
        {
            balance = new
            {
                balance.PurchasedMinutes,
                balance.ExtraPurchasedMinutes,
                balance.UsedMinutes,
                balance.PlannedMinutes,
                balance.PenaltyMinutes,
                balance.RefundedMinutes,
                balance.ManualAdjustmentMinutes,
                balance.TotalGrantedMinutes,
                balance.ConsumedMinutes,
                balance.RemainingMinutes,
                balance.AvailableMinutes,
            },
            reconciliation = new
            {
                reconciliation.IsBalanced,
                reconciliation.LedgerPlannedMinutes,
                reconciliation.ActiveAppointmentMinutes,
                reconciliation.DifferenceMinutes,
            },
            entries,
        });
    }

    /// <summary>Ek direksiyon dersi satın alma (dakika ekler).</summary>
    [HttpPost("students/{profileId:guid}/ledger/extra-minutes")]
    [RequireDrivingPermission(DrivingPermissions.LessonBalanceAdjust)]
    public async Task<IActionResult> AddExtraMinutes(Guid profileId, [FromBody] AddExtraMinutesRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.Minutes is < 1 or > 10000) return BadRequest(new { message = "Ek süre 1-10000 dakika arasında olmalıdır." });
        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await ledgerService.AddAsync(profileId, DrivingLedgerEntryType.ExtraPurchasedMinutes, request.Minutes,
            "Ek direksiyon dersi satın alındı", reason: request.Note?.Trim(), cancellationToken: ct);
        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(profileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var balance = await ledgerService.GetBalanceAsync(profileId, ct);
        await auditLogService.LogChangeAsync("Ek ders hakkı eklendi", AuditCategory, "StudentDrivingProfile", profileId.ToString(),
            $"{request.Minutes} dk ek direksiyon hakkı satın alındı. {request.Note?.Trim()}".Trim(),
            null, new { addedMinutes = request.Minutes, balance.RemainingMinutes }, ct);
        return Ok(new { balance.RemainingMinutes, balance.AvailableMinutes });
    }

    /// <summary>
    /// Gerekçeli elle düzeltme. Hem artı hem eksi olabilir; gerekçe ZORUNLUDUR çünkü
    /// bu, defterin doğal akışını bozan tek işlemdir.
    /// </summary>
    [HttpPost("students/{profileId:guid}/ledger/adjust")]
    [RequireDrivingPermission(DrivingPermissions.LessonBalanceAdjust)]
    public async Task<IActionResult> AdjustBalance(Guid profileId, [FromBody] AdjustBalanceRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.MinutesDelta == 0 || Math.Abs(request.MinutesDelta) > 10000)
            return BadRequest(new { message = "Düzeltme 0 olamaz ve ±10000 dakikayı aşamaz." });
        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length is < 10 or > 500)
            return BadRequest(new { message = "Elle düzeltme gerekçesi 10-500 karakter olmalıdır." });

        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var before = await ledgerService.GetBalanceAsync(profileId, ct);

        // Eksiye düşüren düzeltme, planlanmış randevuları karşılıksız bırakır.
        if (request.MinutesDelta < 0 && before.AvailableMinutes + request.MinutesDelta < 0)
            return BadRequest(new
            {
                message = $"Bu düzeltme bakiyeyi eksiye düşürür (serbest: {before.AvailableMinutes} dk). Önce randevuları iptal edin.",
                availableMinutes = before.AvailableMinutes,
            });

        var entryType = request.IsRefund ? DrivingLedgerEntryType.RefundedMinutes : DrivingLedgerEntryType.ManualAdjustmentMinutes;
        await ledgerService.AddAsync(profileId, entryType, request.MinutesDelta,
            request.IsRefund ? "Ders hakkı iadesi" : "Yetkili elle düzeltmesi", reason: reason, cancellationToken: ct);
        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(profileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var after = await ledgerService.GetBalanceAsync(profileId, ct);
        await auditLogService.LogChangeAsync("Ders hakkı elle düzeltildi", AuditCategory, "StudentDrivingProfile", profileId.ToString(),
            $"{(request.MinutesDelta > 0 ? "+" : string.Empty)}{request.MinutesDelta} dk. Gerekçe: {reason}",
            new { before.RemainingMinutes, before.AvailableMinutes },
            new { after.RemainingMinutes, after.AvailableMinutes, minutesDelta = request.MinutesDelta, reason }, ct);
        return Ok(new { after.RemainingMinutes, after.AvailableMinutes });
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────────

    /// <summary>
    /// Öğrenci yalnızca KENDİ randevusuna, öğretmen yalnızca kendi dersine dokunabilir;
    /// yönetici/sekreter kurumun tamamına. (Kurum izolasyonu zaten query filter'da.)
    /// </summary>
    private async Task<DrivingAppointment?> LoadForActorAsync(Guid appointmentId, CancellationToken ct)
    {
        var appointment = await dbContext.DrivingAppointments.SingleOrDefaultAsync(x => x.Id == appointmentId, ct);
        if (appointment is null) return null;

        if (User.IsInRole("Student") && !User.IsInRole("Admin"))
        {
            var profileId = await CurrentStudentProfileIdAsync(ct);
            return appointment.StudentDrivingProfileId == profileId ? appointment : null;
        }

        if (User.IsInRole("Teacher") && !User.IsInRole("Admin"))
        {
            var instructorId = await CurrentInstructorProfileIdAsync(ct);
            return appointment.InstructorProfileId == instructorId ? appointment : null;
        }

        return appointment;
    }

    /// <summary>İptali kim yaptıysa o duruma yazılır — iade kuralı buna bağlıdır.</summary>
    private DrivingAppointmentStatus ResolveCancellationActor()
    {
        if (User.IsInRole("Student") && !User.IsInRole("Admin")) return DrivingAppointmentStatus.CancelledByStudent;
        if (User.IsInRole("Teacher") && !User.IsInRole("Admin")) return DrivingAppointmentStatus.CancelledByInstructor;
        return DrivingAppointmentStatus.CancelledByInstitution;
    }

    private async Task<DrivingSchoolSettings> ResolveSettingsAsync(CancellationToken ct)
        => await dbContext.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct)
           ?? new DrivingSchoolSettings();

    private void AddStatusHistory(
        Guid appointmentId,
        DrivingAppointmentStatus? from,
        DrivingAppointmentStatus to,
        string reason,
        string note = "")
        => dbContext.DrivingAppointmentStatusHistory.Add(new DrivingAppointmentStatusHistory
        {
            AppointmentId = appointmentId,
            FromStatus = from,
            ToStatus = to,
            ChangedByUserId = CurrentUserId(),
            ChangedByName = User.FindFirstValue("name") ?? User.FindFirstValue("unique_name") ?? "Sistem",
            Reason = reason,
            Note = note,
        });

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private async Task<Guid?> CurrentInstructorProfileIdAsync(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return null;
        return await dbContext.DrivingInstructorProfiles
            .Join(dbContext.Staff.Where(x => x.UserId == userId), x => x.StaffId, x => x.Id, (profile, _) => (Guid?)profile.Id)
            .SingleOrDefaultAsync(ct);
    }

    private async Task<Guid?> CurrentStudentProfileIdAsync(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return null;
        return await dbContext.StudentDrivingProfiles
            .Join(dbContext.Students.Where(x => x.UserId == userId), x => x.StudentId, x => x.Id, (profile, _) => (Guid?)profile.Id)
            .SingleOrDefaultAsync(ct);
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

public sealed record UpdateDrivingSettingsRequest(
    int LateCancellationHours,
    int LateCancellationDeductPercent,
    int NoShowDeductPercent,
    bool RequireApprovalForStudentRequests,
    int MinRescheduleHours,
    int MaxInstructorDailyMinutes,
    int MaxVehicleDailyMinutes,
    int MaxStudentDailyLessons,
    int PreparationMinutes,
    bool FinancialHoldEnabled,
    decimal FinancialHoldThreshold,
    decimal MinimumTheoryAttendancePercent = 80,
    // Mevzuat alanları: eski istemciler göndermezse varsayılan mevzuat değeri yazılır.
    int MaxStudentDailyMinutes = 120,
    int LessonEarliestHour = 7,
    int LessonLatestHour = 19,
    int FailedPracticeExtraLessonMinutes = 120,
    decimal FailedPracticeExtraLessonFee = 0,
    int MaxVehicleAgeYears = 0,
    string ExcusedAbsencePolicy = "ExcludeFromCalculation",
    string? CertificateDirectorName = null,
    string? CertificateDirectorTitle = null,
    string? CertificateLogoUrl = null,
    string? CertificateSignatureUrl = null,
    string? CertificatePrimaryColor = "#173B57");

public sealed record CancelAppointmentRequest(string? Reason);

public sealed record MarkNoShowRequest(string? Note);

public sealed record RescheduleAppointmentRequest(
    DateTime StartsAtUtc,
    DateTime EndsAtUtc,
    Guid? InstructorProfileId,
    Guid? VehicleId,
    string? Reason);

public sealed record AddExtraMinutesRequest(int Minutes, string? Note);

public sealed record AdjustBalanceRequest(int MinutesDelta, string? Reason, bool IsRefund);
