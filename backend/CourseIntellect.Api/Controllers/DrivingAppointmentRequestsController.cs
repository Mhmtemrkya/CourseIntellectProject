using System.Data;
using System.Security.Claims;
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
[Route("api/driving-school")]
public sealed class DrivingAppointmentRequestsController(
    CourseIntellectDbContext db,
    IDrivingAvailabilityService availability,
    IDrivingLedgerService ledger,
    IDrivingNotifier notifier,
    IAuditLogService audit) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    [HttpGet("student/appointment-options")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCreate)]
    public async Task<IActionResult> Options([FromQuery] DateTime? from, [FromQuery] int durationMinutes = 60, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profileId = await CurrentStudentProfileIdAsync(ct);
        if (profileId is null) return Forbid();
        if (durationMinutes is < 30 or > 240 || durationMinutes % 30 != 0) return BadRequest(new { message = "Ders süresi 30-240 dakika ve 30 dakikanın katı olmalıdır." });
        var profile = await db.StudentDrivingProfiles.AsNoTracking().SingleAsync(x => x.Id == profileId, ct);
        if (!await CanStudentScheduleAsync(profile, ct))
            return Conflict(new { message = "Dosyanız eğitim/randevu için henüz uygun değil. Kurs personelinizle görüşün." });
        var instructors = await db.DrivingInstructorProfiles.AsNoTracking().Where(x => x.IsActive)
            .Join(db.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (p, s) => new { p, s.FullName })
            .Where(x => x.p.LicenseClasses.Contains(profile.LicenseClass) && (profile.TransmissionType == TransmissionType.Manual ? x.p.CanTeachManual : x.p.CanTeachAutomatic))
            .Select(x => new { x.p.Id, x.FullName, preferred = x.p.Id == profile.PreferredInstructorProfileId }).OrderByDescending(x => x.preferred).ThenBy(x => x.FullName).ToListAsync(ct);
        var vehicles = await db.DrivingVehicles.AsNoTracking().Where(x => x.IsActive && !x.IsInMaintenance && x.LicenseClass == profile.LicenseClass && x.TransmissionType == profile.TransmissionType)
            .Select(x => new { x.Id, x.PlateNumber, x.Brand, x.Model, preferred = x.Id == profile.PreferredVehicleId }).OrderByDescending(x => x.preferred).ThenBy(x => x.PlateNumber).ToListAsync(ct);
        var startDate = (from ?? DateTime.UtcNow).ToUniversalTime();
        if (startDate < DateTime.UtcNow) startDate = DateTime.UtcNow;
        var endDate = startDate.Date.AddDays(15);
        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var busy = await db.DrivingAppointments.AsNoTracking().Where(x => blocking.Contains(x.Status) && x.StartsAtUtc < endDate && x.EndsAtUtc > startDate)
            .Select(x => new { x.StudentDrivingProfileId, x.InstructorProfileId, x.VehicleId, x.StartsAtUtc, x.EndsAtUtc }).ToListAsync(ct);
        var slots = new List<object>();
        for (var day = startDate.Date; day < endDate && slots.Count < 60; day = day.AddDays(1))
        {
            for (var at = day.AddHours(8); at.AddMinutes(durationMinutes) <= day.AddHours(20) && slots.Count < 60; at = at.AddMinutes(30))
            {
                if (at < startDate) continue;
                var end = at.AddMinutes(durationMinutes);
                if (busy.Any(x => x.StudentDrivingProfileId == profileId && x.StartsAtUtc < end && x.EndsAtUtc > at)) continue;
                var freeInstructors = instructors.Where(i => !busy.Any(x => x.InstructorProfileId == i.Id && x.StartsAtUtc < end && x.EndsAtUtc > at)).Select(x => x.Id).ToList();
                var freeVehicles = vehicles.Where(v => !busy.Any(x => x.VehicleId == v.Id && x.StartsAtUtc < end && x.EndsAtUtc > at)).Select(x => x.Id).ToList();
                if (freeInstructors.Count > 0 && freeVehicles.Count > 0) slots.Add(new { startsAtUtc = at, endsAtUtc = end, availableInstructorIds = freeInstructors, availableVehicleIds = freeVehicles });
            }
        }
        return Ok(new { durationMinutes, instructors, vehicles, slots });
    }

    [HttpGet("student/appointment-requests")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> MyRequests(CancellationToken ct)
    {
        var profileId = await CurrentStudentProfileIdAsync(ct);
        if (profileId is null) return Forbid();
        var studentProfile = await db.StudentDrivingProfiles.AsNoTracking().SingleAsync(x => x.Id == profileId, ct);
        if (!await CanStudentScheduleAsync(studentProfile, ct))
            return Conflict(new { message = "Dosyanız eğitim/randevu için henüz uygun değil. Kurs personelinizle görüşün." });
        return Ok(await BuildRequestRowsAsync(db.DrivingAppointmentRequests.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId), ct));
    }

    [HttpPost("student/appointment-requests")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCreate, DrivingPermissions.AppointmentReschedule)]
    public async Task<IActionResult> CreateRequest([FromBody] SaveAppointmentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profileId = await CurrentStudentProfileIdAsync(ct);
        if (profileId is null) return Forbid();
        if (!Enum.TryParse<DrivingAppointmentRequestType>(request.RequestType, true, out var type) || !Enum.IsDefined(type)) return BadRequest(new { message = "Talep türü geçersiz." });
        var duration = request.EndsAtUtc - request.StartsAtUtc;
        if (request.StartsAtUtc < DateTime.UtcNow.AddMinutes(30) || duration < TimeSpan.FromMinutes(30) || duration > TimeSpan.FromHours(4)) return BadRequest(new { message = "Talep en az 30 dakika sonrası için ve 30-240 dakika aralığında olmalıdır." });
        if ((request.Note?.Trim().Length ?? 0) > 500 || (request.MeetingPoint?.Trim().Length ?? 0) > 300) return BadRequest(new { message = "Not veya buluşma noktası çok uzun." });
        if (await db.DrivingAppointmentRequests.AnyAsync(x => x.StudentDrivingProfileId == profileId && x.Status == DrivingAppointmentRequestStatus.Pending, ct)) return Conflict(new { message = "Önce mevcut bekleyen talebinizin sonuçlanmasını bekleyin." });
        if (type == DrivingAppointmentRequestType.Reschedule)
        {
            if (request.SourceAppointmentId is not Guid sourceId) return BadRequest(new { message = "Yeniden planlama için kaynak randevu zorunludur." });
            var source = await db.DrivingAppointments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == sourceId && x.StudentDrivingProfileId == profileId, ct);
            if (source is null || !DrivingAppointmentStatuses.CanCancel(source.Status)) return Conflict(new { message = "Kaynak randevu yeniden planlanabilir durumda değil." });
            var settings = await db.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();
            if (source.StartsAtUtc - DateTime.UtcNow < TimeSpan.FromHours(settings.MinRescheduleHours)) return BadRequest(new { message = $"Randevuya {settings.MinRescheduleHours} saatten az kaldığı için yeniden planlanamaz." });
        }
        var entity = new DrivingAppointmentRequest
        {
            StudentDrivingProfileId = profileId.Value, RequestType = type, SourceAppointmentId = request.SourceAppointmentId,
            PreferredInstructorProfileId = request.PreferredInstructorProfileId, PreferredVehicleId = request.PreferredVehicleId,
            RequestedStartsAtUtc = request.StartsAtUtc, RequestedEndsAtUtc = request.EndsAtUtc,
            MeetingPoint = request.MeetingPoint?.Trim() ?? string.Empty, StudentNote = request.Note?.Trim() ?? string.Empty,
        };
        db.DrivingAppointmentRequests.Add(entity);
        await db.SaveChangesAsync(ct);
        return Ok(new { entity.Id, status = entity.Status.ToString(), type = entity.RequestType.ToString() });
    }

    [HttpPost("student/appointment-requests/{id:guid}/cancel")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCancel)]
    public async Task<IActionResult> CancelRequest(Guid id, CancellationToken ct)
    {
        var profileId = await CurrentStudentProfileIdAsync(ct);
        var entity = await db.DrivingAppointmentRequests.SingleOrDefaultAsync(x => x.Id == id && x.StudentDrivingProfileId == profileId, ct);
        if (entity is null) return NotFound();
        if (entity.Status != DrivingAppointmentRequestStatus.Pending) return Conflict(new { message = "Yalnızca bekleyen talep iptal edilebilir." });
        entity.Status = DrivingAppointmentRequestStatus.Cancelled; entity.DecidedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return Ok(new { status = entity.Status.ToString() });
    }

    [HttpGet("appointment-requests")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> Requests([FromQuery] string? status, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var query = db.DrivingAppointmentRequests.AsNoTracking();
        if (Enum.TryParse<DrivingAppointmentRequestStatus>(status, true, out var parsed)) query = query.Where(x => x.Status == parsed);
        return Ok(await BuildRequestRowsAsync(query, ct));
    }

    [HttpPut("appointment-requests/{id:guid}/decision")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentApprove)]
    public async Task<IActionResult> Decide(Guid id, [FromBody] DecideAppointmentRequest request, CancellationToken ct)
    {
        if (request.Approved == false && (request.Note?.Trim().Length ?? 0) < 5) return BadRequest(new { message = "Ret nedeni en az 5 karakter olmalıdır." });
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var entity = await db.DrivingAppointmentRequests.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound();
        if (entity.Status != DrivingAppointmentRequestStatus.Pending) return Conflict(new { message = "Talep daha önce sonuçlandırılmış." });
        if (!request.Approved)
        {
            entity.Status = DrivingAppointmentRequestStatus.Rejected; entity.DecisionNote = request.Note!.Trim(); entity.DecidedAtUtc = DateTime.UtcNow; entity.DecidedByUserId = CurrentUserId();
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            await notifier.NotifyStudentAsync(entity.StudentDrivingProfileId, "Randevu talebiniz reddedildi", entity.DecisionNote, DrivingNotificationCategories.Appointment, dedupeKey: $"appointment-request-rejected:{entity.Id}", relatedEntityType: nameof(DrivingAppointmentRequest), relatedEntityId: entity.Id.ToString(), cancellationToken: ct);
            return Ok(new { status = entity.Status.ToString() });
        }

        var studentProfile = await db.StudentDrivingProfiles.AsNoTracking().SingleAsync(x => x.Id == entity.StudentDrivingProfileId, ct);
        if (!await CanStudentScheduleAsync(studentProfile, ct))
            return Conflict(new { message = "Kursiyerin durumu veya evrak uygunluğu değişti; talep onaylanamaz." });

        var assignment = await ResolveAssignmentAsync(entity, request.InstructorProfileId, request.VehicleId, ct);
        if (assignment.Error is not null) return BadRequest(new { message = assignment.Error });
        var newMinutes = (int)(entity.RequestedEndsAtUtc - entity.RequestedStartsAtUtc).TotalMinutes;
        DrivingAppointment? source = null;
        if (entity.RequestType == DrivingAppointmentRequestType.Reschedule)
        {
            source = await db.DrivingAppointments.SingleOrDefaultAsync(x => x.Id == entity.SourceAppointmentId && x.StudentDrivingProfileId == entity.StudentDrivingProfileId, ct);
            if (source is null || !DrivingAppointmentStatuses.CanCancel(source.Status)) return Conflict(new { message = "Kaynak randevu artık yeniden planlanabilir durumda değil." });
            var oldMinutes = (int)(source.EndsAtUtc - source.StartsAtUtc).TotalMinutes;
            var balance = await ledger.GetBalanceAsync(entity.StudentDrivingProfileId, ct);
            if (balance.AvailableMinutes + oldMinutes < newMinutes)
                return Conflict(new { message = $"Yeni ders süresi için hak yetersiz (kullanılabilir: {balance.AvailableMinutes + oldMinutes} dk)." });
        }
        else
        {
            var balance = await ledger.GetBalanceAsync(entity.StudentDrivingProfileId, ct);
            if (balance.AvailableMinutes < newMinutes) return Conflict(new { message = $"Serbest ders hakkı yetersiz ({balance.AvailableMinutes} dk)." });
        }
        var appointment = new DrivingAppointment
        {
            StudentDrivingProfileId = entity.StudentDrivingProfileId, InstructorProfileId = assignment.InstructorId!.Value, VehicleId = assignment.VehicleId!.Value,
            StartsAtUtc = entity.RequestedStartsAtUtc, EndsAtUtc = entity.RequestedEndsAtUtc, MeetingPoint = entity.MeetingPoint, Notes = entity.StudentNote,
            Status = DrivingAppointmentStatus.Approved, RescheduledFromAppointmentId = source?.Id, CreatedByUserId = CurrentUserId(),
        };
        db.DrivingAppointments.Add(appointment);
        if (source is not null)
        {
            var oldMinutes = (int)(source.EndsAtUtc - source.StartsAtUtc).TotalMinutes;
            source.Status = DrivingAppointmentStatus.Rescheduled; source.RescheduledToAppointmentId = appointment.Id; source.CancellationReason = "Öğrenci yeniden planlama talebi onaylandı";
            await ledger.AddAsync(entity.StudentDrivingProfileId, DrivingLedgerEntryType.ReservationReleased, oldMinutes, "Yeniden planlanan randevu rezervasyonu çözüldü", appointmentId: source.Id, cancellationToken: ct);
        }
        await ledger.AddAsync(entity.StudentDrivingProfileId, DrivingLedgerEntryType.PlannedMinutes, -newMinutes, "Öğrenci talebiyle planlanan ders", appointmentId: appointment.Id, cancellationToken: ct);
        entity.Status = DrivingAppointmentRequestStatus.Approved; entity.DecisionNote = request.Note?.Trim() ?? string.Empty; entity.DecidedAtUtc = DateTime.UtcNow; entity.DecidedByUserId = CurrentUserId(); entity.ResultAppointmentId = appointment.Id;
        await db.SaveChangesAsync(ct); await ledger.SyncProfileCacheAsync(entity.StudentDrivingProfileId, ct); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        await notifier.NotifyStudentAsync(entity.StudentDrivingProfileId, "Randevu talebiniz onaylandı", $"{DrivingAvailability.ToLocal(appointment.StartsAtUtc):dd.MM.yyyy HH:mm} tarihli dersiniz planlandı.", DrivingNotificationCategories.Appointment, dedupeKey: $"appointment-request-approved:{entity.Id}", relatedEntityType: nameof(DrivingAppointment), relatedEntityId: appointment.Id.ToString(), cancellationToken: ct);
        await audit.LogChangeAsync("Mobil randevu talebi onaylandı", AuditCategory, nameof(DrivingAppointmentRequest), entity.Id.ToString(), entity.DecisionNote, null, new { appointment.Id, appointment.StartsAtUtc }, ct);
        return Ok(new { status = entity.Status.ToString(), appointmentId = appointment.Id });
    }

    [HttpGet("mobile/planning-reference")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> PlanningReference(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        // Grup (dönem) bilgisi de döner: mobilde randevu planlarken öğrenciyi grupla filtrele/göster.
        var students = await db.StudentDrivingProfiles.AsNoTracking()
            .Join(db.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (p, s) => new { p, s.FullName })
            .GroupJoin(db.DrivingStudentGroups.AsNoTracking(), x => x.p.StudentGroupId, g => (Guid?)g.Id, (x, gs) => new { x.p, x.FullName, gs })
            .SelectMany(x => x.gs.DefaultIfEmpty(), (x, g) => new { x.p.Id, x.p.StudentId, x.FullName, x.p.LicenseClass, transmissionType = x.p.TransmissionType.ToString(), status = x.p.Status.ToString(), groupId = x.p.StudentGroupId, groupName = g != null ? g.Name : null })
            .OrderBy(x => x.FullName).ToListAsync(ct);
        var instructorRows = await db.DrivingInstructorProfiles.AsNoTracking()
            .Join(db.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (p, s) => new
            {
                p.Id, p.StaffId, s.FullName, p.LicenseClasses, p.CanTeachManual,
                p.CanTeachAutomatic, p.IsActive, p.WorkingPermitNo,
                p.WorkingPermitExpiresAtUtc, p.AutomaticStatusEnabled,
                p.ComplianceOverrideActive, p.ComplianceOverrideReason,
                p.StatusChangeSource, p.StatusChangeReason,
            })
            .OrderBy(x => x.FullName)
            .ToListAsync(ct);
        var permitCheckAtUtc = DateTime.UtcNow;
        var instructors = instructorRows.Select(p => new
        {
            p.Id, p.StaffId, p.FullName, p.LicenseClasses, p.CanTeachManual,
            p.CanTeachAutomatic, p.IsActive, p.WorkingPermitNo,
            p.WorkingPermitExpiresAtUtc,
            complianceReady = DrivingAvailability.IsWorkingPermitConfigurationReady(
                p.WorkingPermitNo, p.WorkingPermitExpiresAtUtc, permitCheckAtUtc),
            p.AutomaticStatusEnabled, p.ComplianceOverrideActive,
            p.ComplianceOverrideReason, p.StatusChangeSource, p.StatusChangeReason,
        }).ToList();
        var vehicles = await db.DrivingVehicles.AsNoTracking().Where(x => x.IsActive).Select(x => new { x.Id, x.PlateNumber, x.LicenseClass, transmissionType = x.TransmissionType.ToString(), x.IsInMaintenance }).OrderBy(x => x.PlateNumber).ToListAsync(ct);
        var packages = await db.DrivingPackages.AsNoTracking().Where(x => x.IsActive).Select(x => new { x.Id, x.Name, x.LicenseClass, transmissionType = x.TransmissionType.ToString() }).ToListAsync(ct);
        var baseStudents = await db.Students.AsNoTracking().Where(s => !db.StudentDrivingProfiles.Any(p => p.StudentId == s.Id)).Select(x => new { x.Id, x.FullName }).OrderBy(x => x.FullName).Take(500).ToListAsync(ct);
        var staff = await db.Staff.AsNoTracking().Where(s => !db.DrivingInstructorProfiles.Any(p => p.StaffId == s.Id)).Select(x => new { x.Id, x.FullName }).OrderBy(x => x.FullName).Take(500).ToListAsync(ct);
        return Ok(new { students, instructors, vehicles, packages, baseStudents, staff });
    }

    private async Task<object> BuildRequestRowsAsync(IQueryable<DrivingAppointmentRequest> query, CancellationToken ct) =>
        await query
            .Join(db.StudentDrivingProfiles.AsNoTracking(), x => x.StudentDrivingProfileId, x => x.Id, (r, p) => new { r, p.StudentId })
            .Join(db.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (x, student) => new
            {
                x.r.Id, x.r.StudentDrivingProfileId, student.FullName,
                requestType = x.r.RequestType.ToString(), status = x.r.Status.ToString(),
                x.r.SourceAppointmentId, x.r.PreferredInstructorProfileId, x.r.PreferredVehicleId,
                x.r.RequestedStartsAtUtc, x.r.RequestedEndsAtUtc, x.r.MeetingPoint,
                x.r.StudentNote, x.r.DecisionNote, x.r.DecidedAtUtc, x.r.ResultAppointmentId, x.r.CreatedAtUtc,
            }).OrderByDescending(x => x.CreatedAtUtc).Take(500).ToListAsync(ct);

    private Task<bool> CanStudentScheduleAsync(StudentDrivingProfile profile, CancellationToken ct)
        // EVRAK ESNEK (kullanıcı kararı): randevu uygunluğu yalnız duruma bağlıdır;
        // eksik evrak öğrencinin randevu talebini ENGELLEMEZ (yalnız bilgi/uyarı).
        => Task.FromResult(DrivingStudentStatuses.Schedulable.Contains(profile.Status));

    private async Task<(Guid? InstructorId, Guid? VehicleId, string? Error)> ResolveAssignmentAsync(DrivingAppointmentRequest request, Guid? decidedInstructor, Guid? decidedVehicle, CancellationToken ct)
    {
        var profile = await db.StudentDrivingProfiles.AsNoTracking().SingleAsync(x => x.Id == request.StudentDrivingProfileId, ct);
        var instructors = await db.DrivingInstructorProfiles.AsNoTracking().Where(x => x.IsActive && x.LicenseClasses.Contains(profile.LicenseClass) && (profile.TransmissionType == TransmissionType.Manual ? x.CanTeachManual : x.CanTeachAutomatic)).ToListAsync(ct);
        var vehicles = await db.DrivingVehicles.AsNoTracking().Where(x => x.IsActive && !x.IsInMaintenance && x.LicenseClass == profile.LicenseClass && x.TransmissionType == profile.TransmissionType).ToListAsync(ct);
        var instructorIds = new[] { decidedInstructor, request.PreferredInstructorProfileId, profile.PreferredInstructorProfileId }.Where(x => x.HasValue).Select(x => x!.Value).Concat(instructors.Select(x => x.Id)).Distinct();
        var vehicleIds = new[] { decidedVehicle, request.PreferredVehicleId, profile.PreferredVehicleId }.Where(x => x.HasValue).Select(x => x!.Value).Concat(vehicles.Select(x => x.Id)).Distinct();
        foreach (var instructorId in instructorIds.Where(id => instructors.Any(x => x.Id == id)))
            foreach (var vehicleId in vehicleIds.Where(id => vehicles.Any(x => x.Id == id)))
            {
                var errors = await availability.CheckAsync(new AppointmentCandidate(profile.Id, instructorId, vehicleId, request.RequestedStartsAtUtc, request.RequestedEndsAtUtc, request.SourceAppointmentId), ct);
                if (errors.Count == 0) return (instructorId, vehicleId, null);
            }
        return (null, null, "Seçilen zamanda uygun öğretmen ve araç bulunamadı.");
    }

    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private async Task<Guid?> CurrentStudentProfileIdAsync(CancellationToken ct) { var id = CurrentUserId(); return id is null ? null : await db.StudentDrivingProfiles.Join(db.Students.Where(x => x.UserId == id), x => x.StudentId, x => x.Id, (profile, _) => (Guid?)profile.Id).SingleOrDefaultAsync(ct); }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }
}

public sealed record SaveAppointmentRequest(string RequestType, Guid? SourceAppointmentId, DateTime StartsAtUtc, DateTime EndsAtUtc, Guid? PreferredInstructorProfileId, Guid? PreferredVehicleId, string? MeetingPoint, string? Note);
public sealed record DecideAppointmentRequest(bool Approved, Guid? InstructorProfileId, Guid? VehicleId, string? Note);
