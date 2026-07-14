using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Öğretmen-araç ataması, çalışma saatleri, izinler ve uygunluk öneri motoru.
///
/// <para>Atama girildiği andan itibaren ZORUNLU hâle gelir: bir öğretmene hiç araç
/// atanmamışsa kısıt yoktur (kurum henüz tanımlamamıştır), ama bir kez atama
/// girildiyse o öğretmen atanmamış araçla randevuya çıkamaz.</para>
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school")]
public sealed class DrivingAssignmentsController(
    CourseIntellectDbContext dbContext,
    IDrivingAvailabilityService availabilityService,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    // ─── Öğretmen-araç ataması ────────────────────────────────────────────────

    [HttpGet("instructor-vehicle-assignments")]
    [RequireDrivingPermission(DrivingPermissions.InstructorView)]
    public async Task<IActionResult> GetAssignments([FromQuery] Guid? instructorProfileId, [FromQuery] bool includeInactive, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var query = dbContext.DrivingInstructorVehicleAssignments.AsNoTracking();
        if (instructorProfileId is Guid id) query = query.Where(x => x.InstructorProfileId == id);
        if (!includeInactive) query = query.Where(x => x.IsActive);

        var rows = await query
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.InstructorProfileId, x => x.Id, (assignment, profile) => new { assignment, profile.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (x, staff) => new { x.assignment, InstructorName = staff.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.assignment.VehicleId, x => x.Id, (x, vehicle) => new
            {
                x.assignment.Id,
                x.assignment.InstructorProfileId,
                x.InstructorName,
                x.assignment.VehicleId,
                VehiclePlate = vehicle.PlateNumber,
                assignmentType = x.assignment.AssignmentType.ToString(),
                x.assignment.StartsOnUtc,
                x.assignment.EndsOnUtc,
                x.assignment.DaysOfWeekMask,
                x.assignment.Priority,
                x.assignment.IsActive,
                x.assignment.Note,
                x.assignment.CreatedAtUtc,
            })
            .OrderBy(x => x.InstructorName).ThenBy(x => x.Priority)
            .ToListAsync(ct);

        return Ok(rows);
    }

    [HttpPost("instructor-vehicle-assignments")]
    [RequireDrivingPermission(DrivingPermissions.InstructorAssignmentManage)]
    public async Task<IActionResult> CreateAssignment([FromBody] SaveVehicleAssignmentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.ParsedType is not { } assignmentType) return BadRequest(new { message = $"Atama türü geçersiz: {request.AssignmentType}." });
        if (request.Priority is < 0 or > 1000) return BadRequest(new { message = "Öncelik 0-1000 arasında olmalıdır." });
        if (request.StartsOnUtc is { } starts && request.EndsOnUtc is { } ends && ends <= starts)
            return BadRequest(new { message = "Atama bitiş tarihi başlangıçtan sonra olmalıdır." });
        if (assignmentType == VehicleAssignmentType.Temporary && (request.StartsOnUtc is null || request.EndsOnUtc is null))
            return BadRequest(new { message = "Geçici atamada başlangıç ve bitiş tarihi zorunludur." });
        if (assignmentType == VehicleAssignmentType.SpecificDays && request.DaysOfWeekMask is <= 0 or > 127)
            return BadRequest(new { message = "Belirli günler ataması için en az bir gün seçilmelidir." });

        var instructor = await dbContext.DrivingInstructorProfiles.AsNoTracking()
            .Where(x => x.Id == request.InstructorProfileId)
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (profile, staff) => new { profile.Id, profile.LicenseClasses, profile.CanTeachManual, profile.CanTeachAutomatic, staff.FullName })
            .SingleOrDefaultAsync(ct);
        if (instructor is null) return BadRequest(new { message = "Öğretmen bulunamadı." });

        var vehicle = await dbContext.DrivingVehicles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.VehicleId, ct);
        if (vehicle is null) return BadRequest(new { message = "Araç bulunamadı." });

        // Öğretmenin kullanamayacağı bir aracı ona atamak, randevu anında hataya
        // dönüşecek sessiz bir yanlıştır — daha atama anında engelliyoruz.
        var transmissionOk = vehicle.TransmissionType == TransmissionType.Manual ? instructor.CanTeachManual : instructor.CanTeachAutomatic;
        var classes = instructor.LicenseClasses.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!transmissionOk || !classes.Contains(vehicle.LicenseClass, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = $"{instructor.FullName}, {vehicle.PlateNumber} aracının sınıf/vites yetkinliğine sahip değil." });

        if (await dbContext.DrivingInstructorVehicleAssignments
                .AnyAsync(x => x.InstructorProfileId == request.InstructorProfileId && x.VehicleId == request.VehicleId && x.IsActive, ct))
            return Conflict(new { message = "Bu öğretmen-araç ataması zaten aktif." });

        var entity = new DrivingInstructorVehicleAssignment
        {
            InstructorProfileId = request.InstructorProfileId,
            VehicleId = request.VehicleId,
            AssignmentType = assignmentType,
            StartsOnUtc = request.StartsOnUtc,
            EndsOnUtc = request.EndsOnUtc,
            DaysOfWeekMask = assignmentType == VehicleAssignmentType.SpecificDays ? request.DaysOfWeekMask : 0,
            Priority = request.Priority,
            Note = request.Note?.Trim() ?? string.Empty,
            CreatedByUserId = CurrentUserId(),
        };
        dbContext.DrivingInstructorVehicleAssignments.Add(entity);
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Öğretmen-araç ataması yapıldı", AuditCategory, "DrivingInstructorVehicleAssignment", entity.Id.ToString(),
            $"{instructor.FullName} → {vehicle.PlateNumber} ({assignmentType}).",
            null,
            new { entity.InstructorProfileId, entity.VehicleId, assignmentType = assignmentType.ToString(), entity.StartsOnUtc, entity.EndsOnUtc, entity.Priority },
            ct);
        return Ok(new { entity.Id });
    }

    /// <summary>Atamayı pasife alır — silmez, çünkü geçmiş randevuların dayanağıdır.</summary>
    [HttpDelete("instructor-vehicle-assignments/{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.InstructorAssignmentManage)]
    public async Task<IActionResult> DeactivateAssignment(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var assignment = await dbContext.DrivingInstructorVehicleAssignments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (assignment is null) return NotFound(new { message = "Atama bulunamadı." });
        if (!assignment.IsActive) return Ok(new { assignment.Id, assignment.IsActive });

        assignment.IsActive = false;
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Öğretmen-araç ataması kaldırıldı", AuditCategory, "DrivingInstructorVehicleAssignment", assignment.Id.ToString(),
            "Atama pasife alındı.",
            new { isActive = true }, new { isActive = false }, ct);
        return Ok(new { assignment.Id, assignment.IsActive });
    }

    // ─── Çalışma saatleri ─────────────────────────────────────────────────────

    [HttpGet("instructors/{instructorProfileId:guid}/working-hours")]
    [RequireDrivingPermission(DrivingPermissions.InstructorView)]
    public async Task<IActionResult> GetWorkingHours(Guid instructorProfileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var rows = await dbContext.DrivingInstructorWorkingHours.AsNoTracking()
            .Where(x => x.InstructorProfileId == instructorProfileId)
            .OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartMinute)
            .Select(x => new { x.Id, dayOfWeek = x.DayOfWeek.ToString(), x.StartMinute, x.EndMinute })
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>Haftalık çalışma programını topluca değiştirir (eskisini siler, yenisini yazar).</summary>
    [HttpPut("instructors/{instructorProfileId:guid}/working-hours")]
    [RequireDrivingPermission(DrivingPermissions.InstructorUpdate)]
    public async Task<IActionResult> SetWorkingHours(Guid instructorProfileId, [FromBody] SetWorkingHoursRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await dbContext.DrivingInstructorProfiles.AnyAsync(x => x.Id == instructorProfileId, ct))
            return NotFound(new { message = "Öğretmen bulunamadı." });

        var windows = new List<DrivingInstructorWorkingHour>();
        foreach (var item in request.Windows ?? [])
        {
            if (!Enum.TryParse<DayOfWeek>(item.DayOfWeek, ignoreCase: true, out var day))
                return BadRequest(new { message = $"Gün geçersiz: {item.DayOfWeek}." });
            if (item.StartMinute is < 0 or > 1440 || item.EndMinute is < 0 or > 1440 || item.EndMinute <= item.StartMinute)
                return BadRequest(new { message = "Çalışma saati aralığı geçersiz (0-1440 dakika, bitiş > başlangıç)." });

            windows.Add(new DrivingInstructorWorkingHour
            {
                InstructorProfileId = instructorProfileId,
                DayOfWeek = day,
                StartMinute = item.StartMinute,
                EndMinute = item.EndMinute,
            });
        }

        var existing = await dbContext.DrivingInstructorWorkingHours
            .Where(x => x.InstructorProfileId == instructorProfileId)
            .ToListAsync(ct);
        dbContext.DrivingInstructorWorkingHours.RemoveRange(existing);
        dbContext.DrivingInstructorWorkingHours.AddRange(windows);
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Öğretmen çalışma saatleri güncellendi", AuditCategory, "DrivingInstructorProfile", instructorProfileId.ToString(),
            $"{windows.Count} çalışma penceresi tanımlandı.",
            new { windows = existing.Select(x => new { day = x.DayOfWeek.ToString(), x.StartMinute, x.EndMinute }) },
            new { windows = windows.Select(x => new { day = x.DayOfWeek.ToString(), x.StartMinute, x.EndMinute }) },
            ct);
        return Ok(new { count = windows.Count });
    }

    // ─── İzinler ──────────────────────────────────────────────────────────────

    [HttpGet("instructor-leaves")]
    [RequireDrivingPermission(DrivingPermissions.InstructorView)]
    public async Task<IActionResult> GetLeaves([FromQuery] Guid? instructorProfileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var query = dbContext.DrivingInstructorLeaves.AsNoTracking()
            .Where(x => x.EndsAtUtc >= DateTime.UtcNow.AddMonths(-3));
        if (instructorProfileId is Guid id) query = query.Where(x => x.InstructorProfileId == id);

        var rows = await query
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.InstructorProfileId, x => x.Id, (leave, profile) => new { leave, profile.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (x, staff) => new
            {
                x.leave.Id,
                x.leave.InstructorProfileId,
                InstructorName = staff.FullName,
                x.leave.StartsAtUtc,
                x.leave.EndsAtUtc,
                x.leave.LeaveType,
                x.leave.Reason,
            })
            .OrderByDescending(x => x.StartsAtUtc)
            .Take(500)
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("instructor-leaves")]
    [RequireDrivingPermission(DrivingPermissions.InstructorUpdate)]
    public async Task<IActionResult> CreateLeave([FromBody] SaveInstructorLeaveRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.EndsAtUtc <= request.StartsAtUtc) return BadRequest(new { message = "İzin bitişi başlangıçtan sonra olmalıdır." });
        if (request.EndsAtUtc - request.StartsAtUtc > TimeSpan.FromDays(365)) return BadRequest(new { message = "İzin en fazla 1 yıl olabilir." });

        var instructor = await dbContext.DrivingInstructorProfiles.AsNoTracking()
            .Where(x => x.Id == request.InstructorProfileId)
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (_, staff) => staff.FullName)
            .SingleOrDefaultAsync(ct);
        if (instructor is null) return BadRequest(new { message = "Öğretmen bulunamadı." });

        // İzin, o aralıktaki açık randevuların üstüne yazılamaz — önce onlar taşınmalı.
        var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
        var affected = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.InstructorProfileId == request.InstructorProfileId
                && blocking.Contains(x.Status)
                && x.StartsAtUtc < request.EndsAtUtc && x.EndsAtUtc > request.StartsAtUtc)
            .Select(x => new { x.Id, x.StartsAtUtc, x.EndsAtUtc })
            .OrderBy(x => x.StartsAtUtc)
            .ToListAsync(ct);

        if (affected.Count > 0 && !request.ForceWithExistingAppointments)
            return Conflict(new
            {
                message = $"Bu izin aralığında öğretmenin {affected.Count} açık randevusu var. Önce bunları yeniden planlayın veya iptal edin.",
                affectedAppointments = affected,
            });

        var entity = new DrivingInstructorLeave
        {
            InstructorProfileId = request.InstructorProfileId,
            StartsAtUtc = request.StartsAtUtc,
            EndsAtUtc = request.EndsAtUtc,
            LeaveType = string.IsNullOrWhiteSpace(request.LeaveType) ? "Annual" : request.LeaveType.Trim(),
            Reason = request.Reason?.Trim() ?? string.Empty,
            CreatedByUserId = CurrentUserId(),
        };
        dbContext.DrivingInstructorLeaves.Add(entity);
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Öğretmen izni tanımlandı", AuditCategory, "DrivingInstructorLeave", entity.Id.ToString(),
            $"{instructor} — {entity.StartsAtUtc:dd.MM.yyyy} / {entity.EndsAtUtc:dd.MM.yyyy} ({entity.LeaveType})."
                + (affected.Count > 0 ? $" {affected.Count} açık randevunun üstüne yazıldı." : string.Empty),
            null,
            new { entity.InstructorProfileId, entity.StartsAtUtc, entity.EndsAtUtc, entity.LeaveType, affectedAppointments = affected.Count },
            ct);
        return Ok(new { entity.Id, affectedAppointments = affected.Count });
    }

    [HttpDelete("instructor-leaves/{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.InstructorUpdate)]
    public async Task<IActionResult> DeleteLeave(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var leave = await dbContext.DrivingInstructorLeaves.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (leave is null) return NotFound();
        dbContext.DrivingInstructorLeaves.Remove(leave);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogAsync("Öğretmen izni kaldırıldı", AuditCategory, "DrivingInstructorLeave", id.ToString(),
            $"{leave.StartsAtUtc:dd.MM.yyyy}-{leave.EndsAtUtc:dd.MM.yyyy} izni silindi.", ct);
        return NoContent();
    }

    // ─── Öneri motoru ─────────────────────────────────────────────────────────

    /// <summary>
    /// Verilen zaman aralığı için gerçekten randevuya çıkabilecek öğretmenler.
    /// Sınıf/vites uyumsuzları, izinliler, çalışma saati dışındakiler ve günlük
    /// limiti dolular listeye girmez.
    /// </summary>
    [HttpGet("availability/instructors")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCreate)]
    public async Task<IActionResult> SuggestInstructors(
        [FromQuery] Guid studentDrivingProfileId,
        [FromQuery] DateTime startsAtUtc,
        [FromQuery] DateTime endsAtUtc,
        CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (endsAtUtc <= startsAtUtc) return BadRequest(new { message = "Zaman aralığı geçersiz." });

        var rows = await availabilityService.SuggestInstructorsAsync(studentDrivingProfileId, startsAtUtc, endsAtUtc, ct);
        return Ok(rows);
    }

    /// <summary>Seçilen öğretmenin o saatte kullanabileceği uygun araçlar (atama önceliğiyle).</summary>
    [HttpGet("availability/vehicles")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCreate)]
    public async Task<IActionResult> SuggestVehicles(
        [FromQuery] Guid studentDrivingProfileId,
        [FromQuery] Guid instructorProfileId,
        [FromQuery] DateTime startsAtUtc,
        [FromQuery] DateTime endsAtUtc,
        CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (endsAtUtc <= startsAtUtc) return BadRequest(new { message = "Zaman aralığı geçersiz." });

        var rows = await availabilityService.SuggestVehiclesAsync(studentDrivingProfileId, instructorProfileId, startsAtUtc, endsAtUtc, ct);
        return Ok(rows);
    }

    /// <summary>
    /// Randevu kurulmadan önce kuralları önizler. Desktop, kullanıcı formu
    /// doldururken bunu çağırıp "bu saatte öğretmen izinli" uyarısını anında gösterir.
    /// </summary>
    [HttpPost("availability/check")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCreate)]
    public async Task<IActionResult> CheckAvailability([FromBody] AvailabilityCheckRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.EndsAtUtc <= request.StartsAtUtc) return BadRequest(new { message = "Zaman aralığı geçersiz." });

        var violations = await availabilityService.CheckAsync(
            new AppointmentCandidate(
                request.StudentDrivingProfileId,
                request.InstructorProfileId,
                request.VehicleId,
                request.StartsAtUtc,
                request.EndsAtUtc,
                request.ExcludeAppointmentId),
            ct);

        return Ok(new
        {
            available = violations.Count == 0,
            violations = violations.Select(x => new { x.Code, x.Message, x.OverridableWith }),
        });
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
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

public sealed record SaveVehicleAssignmentRequest(
    Guid InstructorProfileId,
    Guid VehicleId,
    string AssignmentType,
    DateTime? StartsOnUtc,
    DateTime? EndsOnUtc,
    int DaysOfWeekMask,
    int Priority,
    string? Note)
{
    public VehicleAssignmentType? ParsedType =>
        Enum.TryParse<VehicleAssignmentType>(AssignmentType, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}

public sealed record WorkingHourWindow(string DayOfWeek, int StartMinute, int EndMinute);

public sealed record SetWorkingHoursRequest(IReadOnlyList<WorkingHourWindow>? Windows);

public sealed record SaveInstructorLeaveRequest(
    Guid InstructorProfileId,
    DateTime StartsAtUtc,
    DateTime EndsAtUtc,
    string? LeaveType,
    string? Reason,
    bool ForceWithExistingAppointments);

public sealed record AvailabilityCheckRequest(
    Guid StudentDrivingProfileId,
    Guid InstructorProfileId,
    Guid VehicleId,
    DateTime StartsAtUtc,
    DateTime EndsAtUtc,
    Guid? ExcludeAppointmentId);
