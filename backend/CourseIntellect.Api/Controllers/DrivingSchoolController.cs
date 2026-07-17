using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Sürücü kursu operasyonu. Yetki iki katmanlıdır: <c>[Authorize]</c> paneli,
/// <c>[RequireDrivingPermission]</c> işlemi belirler. İş kuralını bilerek ezen her
/// işlem (uygunsuz araç, vites uyumsuzluğu, evrak süresi) ayrı bir override izni,
/// zorunlu gerekçe ve audit kaydı ister.
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school")]
public sealed class DrivingSchoolController(
    CourseIntellectDbContext dbContext,
    IDrivingPermissionService permissionService,
    IDrivingLedgerService ledgerService,
    IDrivingAvailabilityService availabilityService,
    IDrivingNotifier notifier,
    IDrivingReportPdfService reportPdf,
    IAuditLogService auditLogService) : ControllerBase
{
    /// <summary>Her durum değişikliği ayrı satır olarak saklanır — "neden iptal oldu" tek yerden okunur.</summary>
    private void AddStatusHistory(
        Guid appointmentId,
        DrivingAppointmentStatus? from,
        DrivingAppointmentStatus to,
        string reason,
        string note = "")
        => dbContext.DrivingAppointmentStatusHistory.Add(new CourseIntellect.Domain.Entities.DrivingAppointmentStatusHistory
        {
            AppointmentId = appointmentId,
            FromStatus = from,
            ToStatus = to,
            ChangedByUserId = CurrentUserId(),
            ChangedByName = User.FindFirstValue("name") ?? User.FindFirstValue("unique_name") ?? "Sistem",
            Reason = reason,
            Note = note,
        });

    private const string AuditCategory = "DrivingSchool";
    private const int MinOverrideReasonLength = 10;

    private static readonly HashSet<string> LicenseClasses = new(StringComparer.OrdinalIgnoreCase)
        { "A", "A1", "A2", "B", "BE", "C", "C1", "CE", "C1E", "D", "D1", "DE", "D1E", "F", "M" };
    private static readonly HashSet<string> VehicleDocumentTypes = new(StringComparer.OrdinalIgnoreCase)
        // DualControl: çift kumanda (fren/debriyaj) montaj/ekspertiz belgesi — MTSK'ya özgü.
        { "Registration", "Inspection", "TrafficInsurance", "Casco", "Emission", "Tax", "CourseUsage", "DualControl", "Other" };
    private static readonly HashSet<string> VehicleServiceTypes = new(StringComparer.OrdinalIgnoreCase) { "Maintenance", "Fault", "Damage" };
    private static readonly HashSet<string> ServicePriorities = new(StringComparer.OrdinalIgnoreCase) { "Low", "Normal", "High", "Critical" };

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
    {
        var tenant = await CurrentTenantAsync(cancellationToken);
        if (tenant is null) return Forbid();
        return Ok(new
        {
            institutionType = tenant.InstitutionType.ToString(),
            moduleEnabled = tenant.DrivingSchoolModuleEnabled,
            subscriptionActive = string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase),
            available = IsAvailable(tenant),
        });
    }

    /// <summary>
    /// Oturum açan kullanıcının etkin izinleri. Desktop/mobil menü ve butonlar
    /// bunu okuyarak yalnızca yapılabilecek işlemleri gösterir.
    /// </summary>
    [HttpGet("permissions/me")]
    public async Task<IActionResult> GetMyPermissions(CancellationToken ct)
    {
        var snapshot = await permissionService.GetSnapshotAsync(User, ct);
        return Ok(new
        {
            snapshot.RoleKey,
            snapshot.Permissions,
            snapshot.IsOwner,
            snapshot.IsBranchScoped,
            moduleAvailable = await CanUseModuleAsync(ct),
        });
    }

    /// <summary>Kurum yöneticisinin özel rol tanımlarken seçebileceği izin kataloğu.</summary>
    [HttpGet("permissions/catalog")]
    [RequireDrivingPermission(DrivingPermissions.PermissionManage)]
    public IActionResult GetPermissionCatalog()
        => Ok(new
        {
            permissions = DrivingPermissions.All.OrderBy(x => x, StringComparer.Ordinal),
            overrides = DrivingPermissions.OverrideCodes.OrderBy(x => x, StringComparer.Ordinal),
            defaults = DrivingPermissionCatalog.Defaults.ToDictionary(
                x => x.Key,
                x => x.Value.OrderBy(p => p, StringComparer.Ordinal).ToList()),
            ceilings = DrivingPermissionCatalog.Ceilings.ToDictionary(
                x => x.Key,
                x => x.Value.OrderBy(p => p, StringComparer.Ordinal).ToList()),
        });

    /// <summary>
    /// Kurs paneli. <paramref name="from"/>/<paramref name="to"/> verilirse ders, tahsilat
    /// ve kayıt KPI'ları O ARALIK için hesaplanır (günlük/haftalık/aylık/yıllık/özel filtre);
    /// verilmezse "bugün" davranışı korunur. Aktif kursiyer/araç gibi YAPISAL sayımlar
    /// aralıktan bağımsızdır — onlar "şu an"ın fotoğrafıdır.
    /// </summary>
    [HttpGet("dashboard")]
    [RequireDrivingPermission(DrivingPermissions.DashboardView)]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken cancellationToken)
    {
        if (!await CanUseModuleAsync(cancellationToken)) return Forbid();

        var canSeeFinance = await permissionService.HasAsync(User, DrivingPermissions.FinanceView, cancellationToken);
        var today = from?.ToUniversalTime() ?? DateTime.UtcNow.Date;
        var tomorrow = to?.ToUniversalTime() ?? today.AddDays(1);
        if (tomorrow <= today || tomorrow - today > TimeSpan.FromDays(400))
            return BadRequest(new { message = "Tarih aralığı geçersiz." });
        var openStatuses = DrivingStudentStatuses.Open.ToArray();
        var activeStudents = await dbContext.StudentDrivingProfiles.AsNoTracking().CountAsync(x => openStatuses.Contains(x.Status), cancellationToken);
        var activeInstructors = await dbContext.DrivingInstructorProfiles.AsNoTracking().CountAsync(x => x.IsActive, cancellationToken);
        var activeVehicles = await dbContext.DrivingVehicles.AsNoTracking().CountAsync(x => x.IsActive && !x.IsInMaintenance && x.InspectionExpiresAtUtc > DateTime.UtcNow && x.InsuranceExpiresAtUtc > DateTime.UtcNow, cancellationToken);
        var vehiclesInMaintenance = await dbContext.DrivingVehicles.AsNoTracking().CountAsync(x => x.IsInMaintenance, cancellationToken);
        var todayDrivingLessons = await dbContext.DrivingAppointments.AsNoTracking()
            .CountAsync(x => x.StartsAtUtc >= today && x.StartsAtUtc < tomorrow && x.Status != DrivingAppointmentStatus.Cancelled, cancellationToken);
        var todayTheoryLessons = await dbContext.DrivingTheorySessions.AsNoTracking()
            .CountAsync(x => x.StartsAtUtc >= today && x.StartsAtUtc < tomorrow && x.Status != DrivingTheorySessionStatus.Cancelled, cancellationToken);
        var upcomingExams = await dbContext.DrivingExamSessions.AsNoTracking()
            .CountAsync(x => x.StartsAtUtc >= DateTime.UtcNow && x.StartsAtUtc < DateTime.UtcNow.AddDays(30) && x.Status == DrivingExamSessionStatus.Planned, cancellationToken);
        var missingDocuments = await dbContext.DrivingVehicles.AsNoTracking()
            .CountAsync(x => !x.InspectionExpiresAtUtc.HasValue || !x.InsuranceExpiresAtUtc.HasValue || x.InspectionExpiresAtUtc <= DateTime.UtcNow || x.InsuranceExpiresAtUtc <= DateTime.UtcNow, cancellationToken);
        var expiringDocuments = await dbContext.DrivingVehicles.AsNoTracking()
            .CountAsync(x => (x.InspectionExpiresAtUtc > DateTime.UtcNow && x.InspectionExpiresAtUtc <= DateTime.UtcNow.AddDays(30)) || (x.InsuranceExpiresAtUtc > DateTime.UtcNow && x.InsuranceExpiresAtUtc <= DateTime.UtcNow.AddDays(30)), cancellationToken);
        var vehicleAlerts = await dbContext.DrivingVehicles.AsNoTracking()
            .Where(x => x.IsInMaintenance || !x.InspectionExpiresAtUtc.HasValue || !x.InsuranceExpiresAtUtc.HasValue || x.InspectionExpiresAtUtc <= DateTime.UtcNow.AddDays(30) || x.InsuranceExpiresAtUtc <= DateTime.UtcNow.AddDays(30))
            .OrderBy(x => x.PlateNumber).Take(20)
            .Select(x => new { type = x.IsInMaintenance ? "Maintenance" : "VehicleDocument", severity = x.IsInMaintenance || x.InspectionExpiresAtUtc <= DateTime.UtcNow || x.InsuranceExpiresAtUtc <= DateTime.UtcNow ? "Critical" : "Warning", title = x.PlateNumber, message = x.IsInMaintenance ? "Araç bakım veya arıza nedeniyle kullanım dışı." : "Zorunlu araç evrakı eksik, süresi dolmuş veya 30 gün içinde dolacak." })
            .ToListAsync(cancellationToken);

        // Finans KPI'ları yalnızca finans izni olana gider (sekreterde tahsilat var,
        // filo sorumlusunda hiç yok — panoda tutar sızdırmayalım).
        decimal? todayCollections = canSeeFinance
            ? await dbContext.FinancePayments.AsNoTracking()
                .Where(x => x.PaidAtUtc >= today && x.PaidAtUtc < tomorrow)
                .SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0
            : null;

        var monthlyRegistrations = await dbContext.Students.AsNoTracking()
            .Where(x => x.CreatedAtUtc >= today.AddMonths(-5))
            .GroupBy(x => new { x.CreatedAtUtc.Year, x.CreatedAtUtc.Month })
            .Select(x => new { x.Key.Year, x.Key.Month, Count = x.Count() })
            .ToListAsync(cancellationToken);

        var registrationSeries = Enumerable.Range(0, 6).Select(offset =>
        {
            var month = today.AddMonths(offset - 5);
            var count = monthlyRegistrations.FirstOrDefault(x => x.Year == month.Year && x.Month == month.Month)?.Count ?? 0;
            return new { label = month.ToString("MMM"), value = count };
        });

        return Ok(new
        {
            generatedAtUtc = DateTime.UtcNow,
            rangeFromUtc = today,
            rangeToUtc = tomorrow,
            kpis = new
            {
                activeStudents,
                todayDrivingLessons,
                todayTheoryLessons,
                activeInstructors,
                activeVehicles,
                vehiclesInMaintenance,
                missingDocuments,
                expiringDocuments,
                upcomingExams,
                todayCollections,
            },
            charts = new { monthlyRegistrations = registrationSeries },
            alerts = vehicleAlerts,
        });
    }

    [HttpGet("packages")]
    [RequireDrivingPermission(DrivingPermissions.PackageView)]
    public async Task<IActionResult> GetPackages(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var packages = await dbContext.DrivingPackages.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);
        // Mevzuat asgarisi (bilinen sınıflarda): paketin altında kalması UI'da uyarılır.
        return Ok(packages.Select(x => new
        {
            x.Id, x.Name, x.LicenseClass, x.TransmissionType, x.DrivingLessonMinutes, x.TheoryLessonMinutes,
            x.Price, x.IsActive, x.CreatedAtUtc,
            regulatoryMinimumMinutes = DrivingCurriculum.MinimumPracticeMinutesFor(x.LicenseClass),
            belowRegulatoryMinimum = DrivingCurriculum.MinimumPracticeMinutesFor(x.LicenseClass) > 0
                && x.DrivingLessonMinutes < DrivingCurriculum.MinimumPracticeMinutesFor(x.LicenseClass),
        }));
    }

    [HttpPost("packages")]
    [RequireDrivingPermission(DrivingPermissions.PackageCreate)]
    public async Task<IActionResult> CreatePackage([FromBody] SaveDrivingPackageRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var error = ValidatePackage(request); if (error is not null) return BadRequest(new { message = error });
        var entity = new CourseIntellect.Domain.Entities.DrivingPackage
        {
            Name = request.Name.Trim(), LicenseClass = request.LicenseClass.Trim().ToUpperInvariant(),
            TransmissionType = request.TransmissionType, DrivingLessonMinutes = request.DrivingLessonMinutes,
            TheoryLessonMinutes = request.TheoryLessonMinutes, Price = request.Price, IsActive = true,
        };
        dbContext.DrivingPackages.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Paket oluşturuldu", AuditCategory, "DrivingPackage", entity.Id.ToString(),
            $"\"{entity.Name}\" — {entity.LicenseClass} / {entity.TransmissionType}, {entity.DrivingLessonMinutes} dk, {entity.Price:N2} ₺.",
            null, PackageSnapshot(entity), ct);
        return Ok(entity);
    }

    [HttpGet("vehicles")]
    [RequireDrivingPermission(DrivingPermissions.VehicleView)]
    public async Task<IActionResult> GetVehicles(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        return Ok(await dbContext.DrivingVehicles.AsNoTracking().OrderBy(x => x.PlateNumber).ToListAsync(ct));
    }

    [HttpPost("vehicles")]
    [RequireDrivingPermission(DrivingPermissions.VehicleCreate)]
    public async Task<IActionResult> CreateVehicle([FromBody] SaveDrivingVehicleRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var license = request.LicenseClass.Trim().ToUpperInvariant();
        var plate = Regex.Replace(request.PlateNumber.ToUpperInvariant(), @"\s+", " ").Trim();
        if (!LicenseClasses.Contains(license) || !Enum.IsDefined(request.TransmissionType)) return BadRequest(new { message = "Ehliyet sınıfı veya vites türü geçersiz." });
        if (!Regex.IsMatch(plate, @"^(0[1-9]|[1-7][0-9]|8[01]) [A-ZÇĞİÖŞÜ]{1,3} [0-9]{2,5}$")) return BadRequest(new { message = "Plaka biçimi geçersiz (ör. 34 ABC 123)." });
        if (request.ModelYear < 1980 || request.ModelYear > DateTime.UtcNow.Year + 1 || request.CurrentKilometer < 0) return BadRequest(new { message = "Model yılı veya kilometre geçersiz." });
        var entity = new CourseIntellect.Domain.Entities.DrivingVehicle
        {
            PlateNumber = plate, Brand = request.Brand.Trim(), Model = request.Model.Trim(), ModelYear = request.ModelYear,
            LicenseClass = license, TransmissionType = request.TransmissionType, CurrentKilometer = request.CurrentKilometer,
            InspectionExpiresAtUtc = request.InspectionExpiresAtUtc, InsuranceExpiresAtUtc = request.InsuranceExpiresAtUtc,
        };
        dbContext.DrivingVehicles.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Araç eklendi", AuditCategory, "DrivingVehicle", entity.Id.ToString(),
            $"{entity.PlateNumber} — {entity.Brand} {entity.Model} ({entity.LicenseClass} / {entity.TransmissionType}).",
            null, VehicleSnapshot(entity), ct);
        return Ok(entity);
    }

    [HttpGet("instructors")]
    [RequireDrivingPermission(DrivingPermissions.InstructorView)]
    public async Task<IActionResult> GetInstructors(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var rows = await dbContext.DrivingInstructorProfiles.AsNoTracking()
            .Join(dbContext.Staff.AsNoTracking(), p => p.StaffId, s => s.Id, (p, s) => new { p.Id, p.StaffId, s.FullName, p.LicenseClasses, p.CanTeachManual, p.CanTeachAutomatic, p.WorkingPermitNo, p.WorkingPermitExpiresAtUtc, p.IsActive })
            .OrderBy(x => x.FullName).ToListAsync(ct);
        var now = DateTime.UtcNow;
        return Ok(rows.Select(x => new
        {
            x.Id, x.StaffId, x.FullName, x.LicenseClasses, x.CanTeachManual, x.CanTeachAutomatic,
            x.WorkingPermitNo, x.WorkingPermitExpiresAtUtc, x.IsActive,
            workingPermitExpired = x.WorkingPermitExpiresAtUtc is DateTime expires && expires <= now,
        }));
    }

    [HttpPost("instructors")]
    [RequireDrivingPermission(DrivingPermissions.InstructorCreate)]
    public async Task<IActionResult> CreateInstructor([FromBody] SaveDrivingInstructorRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!request.CanTeachManual && !request.CanTeachAutomatic) return BadRequest(new { message = "En az bir vites yetkinliği seçilmelidir." });
        var classes = request.LicenseClasses.Select(x => x.Trim().ToUpperInvariant()).Distinct().ToArray();
        if (classes.Length == 0 || classes.Any(x => !LicenseClasses.Contains(x))) return BadRequest(new { message = "Ehliyet sınıfı geçersiz." });
        var staff = await dbContext.Staff.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.StaffId, ct);
        if (staff is null) return BadRequest(new { message = "Personel bulunamadı." });
        if ((request.WorkingPermitNo?.Length ?? 0) > 60) return BadRequest(new { message = "Çalışma izni numarası en fazla 60 karakter olabilir." });
        var entity = new CourseIntellect.Domain.Entities.DrivingInstructorProfile
        {
            StaffId = request.StaffId,
            LicenseClasses = string.Join(',', classes),
            CanTeachManual = request.CanTeachManual,
            CanTeachAutomatic = request.CanTeachAutomatic,
            WorkingPermitNo = request.WorkingPermitNo?.Trim() ?? string.Empty,
            WorkingPermitExpiresAtUtc = request.WorkingPermitExpiresAtUtc,
        };
        dbContext.DrivingInstructorProfiles.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Direksiyon öğretmeni tanımlandı", AuditCategory, "DrivingInstructorProfile", entity.Id.ToString(),
            $"{staff.FullName} — sınıflar: {entity.LicenseClasses}, manuel: {entity.CanTeachManual}, otomatik: {entity.CanTeachAutomatic}"
                + (entity.WorkingPermitExpiresAtUtc is { } permit ? $", çalışma izni: {permit:dd.MM.yyyy}." : "."),
            null, new { entity.StaffId, entity.LicenseClasses, entity.CanTeachManual, entity.CanTeachAutomatic, entity.WorkingPermitNo, entity.WorkingPermitExpiresAtUtc }, ct);
        return Ok(entity);
    }

    /// <summary>Usta öğreticinin MEB çalışma izni bilgisini günceller (yenilenen izin işlenir).</summary>
    [HttpPut("instructors/{id:guid}/working-permit")]
    [RequireDrivingPermission(DrivingPermissions.InstructorUpdate)]
    public async Task<IActionResult> UpdateWorkingPermit(Guid id, [FromBody] UpdateWorkingPermitRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.DrivingInstructorProfiles.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (profile is null) return NotFound(new { message = "Öğretmen bulunamadı." });
        if ((request.WorkingPermitNo?.Length ?? 0) > 60) return BadRequest(new { message = "Çalışma izni numarası en fazla 60 karakter olabilir." });

        var before = new { profile.WorkingPermitNo, profile.WorkingPermitExpiresAtUtc };
        profile.WorkingPermitNo = request.WorkingPermitNo?.Trim() ?? string.Empty;
        profile.WorkingPermitExpiresAtUtc = request.WorkingPermitExpiresAtUtc;
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Çalışma izni güncellendi", AuditCategory, "DrivingInstructorProfile", profile.Id.ToString(),
            $"İzin no: {(string.IsNullOrWhiteSpace(profile.WorkingPermitNo) ? "—" : profile.WorkingPermitNo)}, bitiş: {profile.WorkingPermitExpiresAtUtc:dd.MM.yyyy}.",
            before, new { profile.WorkingPermitNo, profile.WorkingPermitExpiresAtUtc }, ct);
        return Ok(new { profile.Id, profile.WorkingPermitNo, profile.WorkingPermitExpiresAtUtc });
    }

    [HttpGet("students")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetStudents([FromQuery] Guid? groupId, [FromQuery] bool? ungrouped, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var query = dbContext.StudentDrivingProfiles.AsNoTracking().AsQueryable();
        // ?ungrouped=true → gruba atanmamış kursiyerler; ?groupId=… → o gruptakiler.
        if (ungrouped == true) query = query.Where(x => x.StudentGroupId == null);
        else if (groupId is Guid gid) query = query.Where(x => x.StudentGroupId == gid);

        var rows = await query
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p, s.FullName })
            .GroupJoin(dbContext.DrivingStudentGroups.AsNoTracking(), x => x.p.StudentGroupId, g => (Guid?)g.Id, (x, gs) => new { x.p, x.FullName, gs })
            .SelectMany(x => x.gs.DefaultIfEmpty(), (x, g) => new
            {
                x.p.Id,
                x.p.StudentId,
                x.p.StudentNumber,
                x.FullName,
                x.p.PackageId,
                x.p.LicenseClass,
                transmissionType = x.p.TransmissionType.ToString(),
                x.p.PurchasedDrivingMinutes,
                x.p.UsedDrivingMinutes,
                remainingDrivingMinutes = x.p.PurchasedDrivingMinutes - x.p.UsedDrivingMinutes,
                status = x.p.Status.ToString(),
                groupId = x.p.StudentGroupId,
                groupName = g != null ? g.Name : null,
            })
            .OrderBy(x => x.FullName).ToListAsync(ct);
        return Ok(rows);
    }

    // ─── Kursiyer grupları (dönemler) ─────────────────────────────────────────

    /// <summary>Kurumun kursiyer gruplarını, her birindeki kursiyer sayısıyla döner.</summary>
    [HttpGet("student-groups")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetStudentGroups([FromQuery] bool includeInactive, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var query = dbContext.DrivingStudentGroups.AsNoTracking().AsQueryable();
        if (!includeInactive) query = query.Where(x => x.IsActive);
        var counts = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.StudentGroupId != null)
            .GroupBy(x => x.StudentGroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId!.Value, x => x.Count, ct);
        var groups = await query.OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Description, x.IsActive, x.CreatedAtUtc, x.TermYear, x.TermNumber, x.MebbisTermCode, x.Quota, x.RegistrationDeadlineUtc })
            .ToListAsync(ct);
        var ungroupedCount = await dbContext.StudentDrivingProfiles.AsNoTracking().CountAsync(x => x.StudentGroupId == null, ct);
        var now = DateTime.UtcNow;
        return Ok(new
        {
            groups = groups.Select(x => new
            {
                x.Id, x.Name, x.Description, x.IsActive, x.CreatedAtUtc,
                x.TermYear, x.TermNumber, x.MebbisTermCode, x.Quota, x.RegistrationDeadlineUtc,
                studentCount = counts.GetValueOrDefault(x.Id),
                quotaFull = x.Quota > 0 && counts.GetValueOrDefault(x.Id) >= x.Quota,
                daysToDeadline = x.RegistrationDeadlineUtc is DateTime deadline ? (int?)Math.Ceiling((deadline - now).TotalDays) : null,
            }),
            ungroupedCount,
        });
    }

    [HttpPost("student-groups")]
    [RequireDrivingPermission(DrivingPermissions.StudentUpdate)]
    public async Task<IActionResult> CreateStudentGroup([FromBody] SaveDrivingStudentGroupRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120) return BadRequest(new { message = "Grup adı 2-120 karakter olmalıdır." });
        if ((request.Description?.Length ?? 0) > 500) return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });
        if (ValidateGroupTerm(request) is { } termError) return BadRequest(new { message = termError });
        var exists = await dbContext.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.Name == name, ct);
        if (exists) return Conflict(new { message = "Bu isimde bir grup zaten var." });

        var entity = new CourseIntellect.Domain.Entities.DrivingStudentGroup
        {
            Name = name,
            Description = request.Description?.Trim() ?? string.Empty,
            TermYear = request.TermYear,
            TermNumber = request.TermNumber,
            MebbisTermCode = request.MebbisTermCode?.Trim() ?? string.Empty,
            Quota = Math.Max(0, request.Quota),
            RegistrationDeadlineUtc = request.RegistrationDeadlineUtc,
            CreatedByUserId = CurrentUserId(),
        };
        dbContext.DrivingStudentGroups.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Kursiyer grubu oluşturuldu", AuditCategory, "DrivingStudentGroup", entity.Id.ToString(),
            $"\"{entity.Name}\" grubu oluşturuldu{TermLabel(entity)}.", null,
            new { entity.Name, entity.Description, entity.TermYear, entity.TermNumber, entity.MebbisTermCode, entity.Quota, entity.RegistrationDeadlineUtc }, ct);
        return Ok(new
        {
            entity.Id, entity.Name, entity.Description, entity.IsActive, entity.CreatedAtUtc,
            entity.TermYear, entity.TermNumber, entity.MebbisTermCode, entity.Quota, entity.RegistrationDeadlineUtc,
            studentCount = 0,
        });
    }

    [HttpPut("student-groups/{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.StudentUpdate)]
    public async Task<IActionResult> UpdateStudentGroup(Guid id, [FromBody] SaveDrivingStudentGroupRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var group = await dbContext.DrivingStudentGroups.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (group is null) return NotFound(new { message = "Grup bulunamadı." });
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120) return BadRequest(new { message = "Grup adı 2-120 karakter olmalıdır." });
        if ((request.Description?.Length ?? 0) > 500) return BadRequest(new { message = "Açıklama en fazla 500 karakter olabilir." });
        if (ValidateGroupTerm(request) is { } termError) return BadRequest(new { message = termError });
        var clash = await dbContext.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.Name == name && x.Id != id, ct);
        if (clash) return Conflict(new { message = "Bu isimde başka bir grup var." });

        var before = new { group.Name, group.Description, group.IsActive, group.TermYear, group.TermNumber, group.MebbisTermCode, group.Quota, group.RegistrationDeadlineUtc };
        group.Name = name;
        group.Description = request.Description?.Trim() ?? string.Empty;
        group.TermYear = request.TermYear;
        group.TermNumber = request.TermNumber;
        group.MebbisTermCode = request.MebbisTermCode?.Trim() ?? string.Empty;
        group.Quota = Math.Max(0, request.Quota);
        group.RegistrationDeadlineUtc = request.RegistrationDeadlineUtc;
        if (request.IsActive is bool active) group.IsActive = active;
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Kursiyer grubu güncellendi", AuditCategory, "DrivingStudentGroup", group.Id.ToString(),
            $"\"{group.Name}\" grubu güncellendi{TermLabel(group)}.", before,
            new { group.Name, group.Description, group.IsActive, group.TermYear, group.TermNumber, group.MebbisTermCode, group.Quota, group.RegistrationDeadlineUtc }, ct);
        return Ok(new
        {
            group.Id, group.Name, group.Description, group.IsActive, group.CreatedAtUtc,
            group.TermYear, group.TermNumber, group.MebbisTermCode, group.Quota, group.RegistrationDeadlineUtc,
        });
    }

    /// <summary>
    /// Dönemin MEBBİS aday listesi: satırlar MEBBİS aday giriş ekranı sırasındadır,
    /// her satırda eksik alan listesi de döner. <c>?format=csv</c> Türkçe Excel
    /// uyumlu (UTF-8 BOM + noktalı virgül) dosya indirir — sekreter MEBBİS'e
    /// bakarak tek tek yazmak yerine bu listeden girer/aktarır.
    /// </summary>
    [HttpGet("student-groups/{id:guid}/mebbis-roster")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetMebbisRoster(Guid id, [FromQuery] string? format, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var group = await dbContext.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (group is null) return NotFound(new { message = "Grup bulunamadı." });

        var profiles = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.StudentGroupId == id)
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id,
                (p, s) => new { Profile = p, s.FullName, s.TcNo, s.BirthDate })
            .OrderBy(x => x.Profile.StudentNumber)
            .ToListAsync(ct);

        var profileIds = profiles.Select(x => x.Profile.Id).ToList();
        var now = DateTime.UtcNow;
        var docs = await dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.IsCurrent)
            .Select(x => new { x.StudentDrivingProfileId, x.DocumentType, x.Status, x.ExpiresAtUtc, x.DocumentNumber, x.IssuedBy, x.IssuedAtUtc })
            .ToListAsync(ct);
        var docsByProfile = docs.ToLookup(x => x.StudentDrivingProfileId);

        var rows = profiles.Select(x =>
        {
            var profileDocs = docsByProfile[x.Profile.Id].ToList();
            bool Approved(StudentDocumentType type) => profileDocs.Any(d =>
                d.DocumentType == type && DrivingStudentRules.CountsAsSatisfied(d.Status, d.ExpiresAtUtc, now));
            var health = profileDocs.FirstOrDefault(d => d.DocumentType == StudentDocumentType.HealthReport);

            var identityNumber = x.Profile.IdentityKind == IdentityKind.TurkishId
                ? (string.IsNullOrWhiteSpace(x.Profile.IdentityNumber) ? x.TcNo : x.Profile.IdentityNumber)
                : x.Profile.IdentityNumber;

            var missing = DrivingStudentRules.MebbisMissingFields(new DrivingStudentRules.MebbisCandidate(
                HasValidNationalId: x.Profile.IdentityKind != IdentityKind.TurkishId || DrivingStudentRules.IsValidTurkishId(identityNumber),
                BirthDate: x.BirthDate,
                FatherName: x.Profile.FatherName,
                MotherName: x.Profile.MotherName,
                BirthPlace: x.Profile.BirthPlace,
                EducationLevel: x.Profile.EducationLevel,
                IdentitySerialNo: x.Profile.IdentitySerialNo,
                Phone: x.Profile.Phone,
                HasPhoto: Approved(StudentDocumentType.BiometricPhoto) || !string.IsNullOrWhiteSpace(x.Profile.PhotoUrl),
                HealthReportApproved: Approved(StudentDocumentType.HealthReport),
                HealthReportDetailsComplete: health is not null
                    && !string.IsNullOrWhiteSpace(health.DocumentNumber)
                    && !string.IsNullOrWhiteSpace(health.IssuedBy)
                    && health.IssuedAtUtc is not null,
                DiplomaApproved: Approved(StudentDocumentType.Diploma),
                CriminalRecordApproved: Approved(StudentDocumentType.CriminalRecord)));

            // MEBBİS ad/soyad ayrı ister; son kelime soyad kabul edilir.
            var fullName = (x.FullName ?? string.Empty).Trim();
            var lastSpace = fullName.LastIndexOf(' ');
            var firstName = lastSpace > 0 ? fullName[..lastSpace] : fullName;
            var lastName = lastSpace > 0 ? fullName[(lastSpace + 1)..] : string.Empty;

            return new
            {
                studentNumber = x.Profile.StudentNumber,
                tcNo = identityNumber,
                firstName,
                lastName,
                fatherName = x.Profile.FatherName,
                motherName = x.Profile.MotherName,
                birthPlace = x.Profile.BirthPlace,
                birthDate = x.BirthDate,
                educationLevel = x.Profile.EducationLevel,
                licenseClass = x.Profile.LicenseClass,
                identitySerialNo = x.Profile.IdentitySerialNo,
                phone = x.Profile.Phone,
                bloodType = x.Profile.BloodType,
                healthReportNumber = health?.DocumentNumber,
                healthReportIssuedBy = health?.IssuedBy,
                healthReportIssuedAt = health?.IssuedAtUtc,
                profileId = x.Profile.Id,
                mebbisEnteredAtUtc = x.Profile.MebbisEnteredAtUtc,
                missing,
            };
        }).ToList();

        if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
        {
            // Noktalı virgül + UTF-8 BOM: Türkçe Excel'in varsayılan biçimi.
            static string Cell(object? value) => $"\"{(value?.ToString() ?? string.Empty).Replace("\"", "\"\"")}\"";
            var csv = new StringBuilder();
            csv.AppendLine(string.Join(';', new[]
            {
                "Kursiyer No", "TC Kimlik No", "Adı", "Soyadı", "Baba Adı", "Anne Adı", "Doğum Yeri", "Doğum Tarihi",
                "Öğrenim Durumu", "Sertifika Sınıfı", "Kimlik Seri No", "Telefon", "Kan Grubu",
                "Sağlık Raporu No", "Sağlık Raporu Tarihi", "Sağlık Raporunu Veren Kurum", "MEBBİS Eksikleri",
            }.Select(Cell)));
            foreach (var row in rows)
            {
                csv.AppendLine(string.Join(';', new object?[]
                {
                    row.studentNumber, row.tcNo, row.firstName, row.lastName, row.fatherName, row.motherName,
                    row.birthPlace, row.birthDate, row.educationLevel, row.licenseClass, row.identitySerialNo,
                    row.phone, row.bloodType, row.healthReportNumber,
                    row.healthReportIssuedAt?.ToString("dd.MM.yyyy"), row.healthReportIssuedBy,
                    string.Join(", ", row.missing),
                }.Select(Cell)));
            }
            var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
            var safeName = Regex.Replace(group.Name, @"[^\wğüşöçıİĞÜŞÖÇ\- ]", string.Empty).Replace(' ', '-');
            return File(bytes, "text/csv; charset=utf-8", $"mebbis-{safeName}.csv");
        }

        return Ok(new
        {
            group = new
            {
                group.Id, group.Name, group.TermYear, group.TermNumber, group.MebbisTermCode,
                group.Quota, group.RegistrationDeadlineUtc,
                daysToDeadline = group.RegistrationDeadlineUtc is DateTime deadline ? (int?)Math.Ceiling((deadline - now).TotalDays) : null,
            },
            studentCount = rows.Count,
            readyCount = rows.Count(x => x.missing.Count == 0),
            enteredCount = rows.Count(x => x.mebbisEnteredAtUtc != null),
            rows,
        });
    }

    /// <summary>
    /// Dönem kapanış raporu: kayıtlı/mezun/dönemi düşen/devam eden dağılımı,
    /// sınav hak durumu ve MEBBİS giriş sayacı — arşiv ve denetim için tek belge.
    /// <c>?format=pdf</c> aynı belgeden PDF üretir.
    /// </summary>
    [HttpGet("student-groups/{id:guid}/term-report")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetTermReport(Guid id, [FromQuery] string? format, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var group = await dbContext.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (group is null) return NotFound(new { message = "Grup bulunamadı." });

        var students = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.StudentGroupId == id)
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id,
                (p, s) => new { p.Id, p.StudentNumber, s.FullName, p.Status, p.MebbisEnteredAtUtc })
            .OrderBy(x => x.StudentNumber)
            .ToListAsync(ct);
        var profileIds = students.Select(x => x.Id).ToList();

        // Sınav hakları: tür bazında tüketilen deneme (iptal hak yakmaz).
        var attempts = await dbContext.DrivingExamCandidates.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(dbContext.DrivingExamSessions.AsNoTracking(), c => c.ExamSessionId, s => s.Id,
                (c, s) => new { c.StudentDrivingProfileId, s.ExamType, c.Status })
            .ToListAsync(ct);
        var attemptsByStudent = attempts.ToLookup(x => x.StudentDrivingProfileId);

        var statusLabels = new Dictionary<DrivingStudentStatus, string>
        {
            [DrivingStudentStatus.PreRegistered] = "Ön kayıt", [DrivingStudentStatus.DocumentsPending] = "Evrak bekliyor",
            [DrivingStudentStatus.Active] = "Aktif", [DrivingStudentStatus.TheoryOngoing] = "Teorik eğitimde",
            [DrivingStudentStatus.PracticeOngoing] = "Direksiyonda", [DrivingStudentStatus.ExamPending] = "Sınav bekliyor",
            [DrivingStudentStatus.GraduationPending] = "Mezuniyet onayı", [DrivingStudentStatus.Graduated] = "Mezun",
            [DrivingStudentStatus.Suspended] = "Askıda", [DrivingStudentStatus.Cancelled] = "İptal",
        };

        var rows = students.Select(student =>
        {
            var own = attemptsByStudent[student.Id].ToList();
            int Used(DrivingExamType type) => own.Count(x => x.ExamType == type);
            bool Passed(DrivingExamType type) => own.Any(x => x.ExamType == type && x.Status == DrivingExamCandidateStatus.Passed);
            var theoryUsed = Used(DrivingExamType.TheoryEExam);
            var practiceUsed = Used(DrivingExamType.DrivingPractice);
            var forfeited = (!Passed(DrivingExamType.TheoryEExam) && DrivingExamRules.IsOutOfAttempts(theoryUsed))
                || (!Passed(DrivingExamType.DrivingPractice) && DrivingExamRules.IsOutOfAttempts(practiceUsed));
            return new
            {
                student.StudentNumber,
                student.FullName,
                status = statusLabels.GetValueOrDefault(student.Status, student.Status.ToString()),
                theoryAttempts = $"{theoryUsed}/{DrivingExamRules.MaxAttempts}",
                practiceAttempts = $"{practiceUsed}/{DrivingExamRules.MaxAttempts}",
                forfeited,
                graduated = student.Status == DrivingStudentStatus.Graduated,
                mebbisEntered = student.MebbisEnteredAtUtc != null,
            };
        }).ToList();

        var institutionName = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == dbContext.CurrentTenantId).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? "Sürücü Kursu";

        var document = new CourseIntellect.Application.Interfaces.DrivingReportDocument(
            institutionName,
            $"{group.Name} — Dönem Kapanış Raporu",
            (group.TermYear is { } year && group.TermNumber is { } number ? $"Resmî dönem {year}/{number}" : "Dönem raporu")
                + (string.IsNullOrWhiteSpace(group.MebbisTermCode) ? "" : $" • MEBBİS kodu: {group.MebbisTermCode}"),
            group.CreatedAtUtc, DateTime.UtcNow,
            [
                new CourseIntellect.Application.Interfaces.DrivingReportColumn("Kursiyer No", Numeric: true),
                new CourseIntellect.Application.Interfaces.DrivingReportColumn("Ad Soyad"),
                new CourseIntellect.Application.Interfaces.DrivingReportColumn("Durum"),
                new CourseIntellect.Application.Interfaces.DrivingReportColumn("E-Sınav Hak"),
                new CourseIntellect.Application.Interfaces.DrivingReportColumn("Direksiyon Hak"),
                new CourseIntellect.Application.Interfaces.DrivingReportColumn("MEBBİS"),
            ],
            rows.Select(x => (IReadOnlyList<string>)
            [
                x.StudentNumber.ToString(), x.FullName, x.status + (x.forfeited ? " (dönem düştü)" : string.Empty),
                x.theoryAttempts, x.practiceAttempts, x.mebbisEntered ? "Girildi" : "Girilmedi",
            ]).ToList(),
            [
                ("Kayıtlı kursiyer", rows.Count.ToString()),
                ("Mezun", rows.Count(x => x.graduated).ToString()),
                ("Dönemi düşen", rows.Count(x => x.forfeited).ToString()),
                ("Devam eden", rows.Count(x => !x.graduated && !x.forfeited).ToString()),
                ("MEBBİS'e girilen", $"{rows.Count(x => x.mebbisEntered)}/{rows.Count}"),
            ]);

        if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            return File(reportPdf.Generate(document), "application/pdf", $"donem-raporu-{group.Name}.pdf");

        return Ok(new
        {
            group = new { group.Id, group.Name, group.TermYear, group.TermNumber, group.MebbisTermCode },
            columns = document.Columns.Select(x => new { header = x.Header, numeric = x.Numeric }),
            rows = document.Rows,
            summary = document.Summary.Select(x => new { label = x.Label, value = x.Value }),
        });
    }

    /// <summary>Bir veya birden çok kursiyeri bir gruba atar; <c>groupId</c> boşsa gruptan çıkarır.</summary>
    [HttpPost("students/assign-group")]
    [RequireDrivingPermission(DrivingPermissions.StudentUpdate)]
    public async Task<IActionResult> AssignStudentsToGroup([FromBody] AssignStudentGroupRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profileIds = (request.ProfileIds ?? []).Distinct().ToList();
        if (profileIds.Count == 0) return BadRequest(new { message = "En az bir kursiyer seçilmelidir." });
        if (profileIds.Count > 500) return BadRequest(new { message = "Tek seferde en fazla 500 kursiyer atanabilir." });

        string? groupName = null;
        if (request.GroupId is Guid gid)
        {
            var group = await dbContext.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == gid, ct);
            if (group is null) return BadRequest(new { message = "Grup bulunamadı." });
            if (!group.IsActive) return BadRequest(new { message = "Pasif gruba kursiyer atanamaz." });

            // Dönem kontenjanı: MEBBİS'e girilebilecek aday sayısı teorik sınıf
            // kapasitesiyle sınırlıdır — kontenjan üstü atama baştan engellenir.
            if (group.Quota > 0)
            {
                var current = await dbContext.StudentDrivingProfiles.AsNoTracking()
                    .CountAsync(x => x.StudentGroupId == gid && !profileIds.Contains(x.Id), ct);
                var toAdd = await dbContext.StudentDrivingProfiles.AsNoTracking()
                    .CountAsync(x => profileIds.Contains(x.Id), ct);
                if (current + toAdd > group.Quota)
                    return Conflict(new
                    {
                        message = $"\"{group.Name}\" dönem kontenjanı {group.Quota}; bu atamayla {current + toAdd} kursiyer olur. Kontenjanı artırın veya farklı dönem seçin.",
                        quota = group.Quota,
                        current,
                    });
            }

            // Kayıt kesim tarihi geçtiyse uyarı amaçlı engelleme: dönem MEBBİS'te kapanmıştır.
            if (group.RegistrationDeadlineUtc is { } deadline && deadline < DateTime.UtcNow)
                return Conflict(new { message = $"\"{group.Name}\" döneminin kayıt kesim tarihi ({deadline:dd.MM.yyyy}) geçti. Sonraki dönemi kullanın." });

            groupName = group.Name;
        }

        var profiles = await dbContext.StudentDrivingProfiles.Where(x => profileIds.Contains(x.Id)).ToListAsync(ct);
        if (profiles.Count == 0) return NotFound(new { message = "Kursiyer bulunamadı." });
        foreach (var profile in profiles) profile.StudentGroupId = request.GroupId;
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync(
            request.GroupId is null ? "Kursiyerler gruptan çıkarıldı" : "Kursiyerler gruba atandı",
            AuditCategory, "DrivingStudentGroup", request.GroupId?.ToString() ?? "-",
            $"{profiles.Count} kursiyer {(request.GroupId is null ? "gruptan çıkarıldı" : $"\"{groupName}\" grubuna atandı")}.",
            null, new { request.GroupId, count = profiles.Count }, ct);
        return Ok(new { assigned = profiles.Count, groupId = request.GroupId, groupName });
    }

    [HttpPost("students")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> CreateStudentProfile([FromBody] SaveStudentDrivingProfileRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var student = await dbContext.Students.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.StudentId, ct);
        if (student is null) return BadRequest(new { message = "Öğrenci bulunamadı." });
        var package = await dbContext.DrivingPackages.SingleOrDefaultAsync(x => x.Id == request.PackageId && x.IsActive, ct);
        if (package is null) return BadRequest(new { message = "Aktif paket bulunamadı." });
        var license = request.LicenseClass.Trim().ToUpperInvariant();
        if (!string.Equals(package.LicenseClass, license, StringComparison.OrdinalIgnoreCase) || package.TransmissionType != request.TransmissionType)
            return BadRequest(new { message = "Öğrencinin ehliyet sınıfı ve vites türü paketle uyumlu olmalıdır." });
        var nextStudentNumber = (await dbContext.StudentDrivingProfiles.MaxAsync(x => (int?)x.StudentNumber, ct) ?? 0) + 1;
        var entity = new CourseIntellect.Domain.Entities.StudentDrivingProfile { StudentId = request.StudentId, PackageId = package.Id, StudentNumber = nextStudentNumber, LicenseClass = license, TransmissionType = request.TransmissionType, PurchasedDrivingMinutes = package.DrivingLessonMinutes };
        dbContext.StudentDrivingProfiles.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Sürücü adayı kaydı oluşturuldu", AuditCategory, "StudentDrivingProfile", entity.Id.ToString(),
            $"{student.FullName} — paket \"{package.Name}\" ({entity.LicenseClass} / {entity.TransmissionType}), {entity.PurchasedDrivingMinutes} dk hak.",
            null, new { entity.StudentId, entity.PackageId, entity.LicenseClass, entity.TransmissionType, entity.PurchasedDrivingMinutes }, ct);
        return Ok(entity);
    }

    /// <summary>
    /// Takvim görünümü: filtrelenebilir, kart için gereken her şeyi tek çağrıda döner
    /// (öğrenci fotoğrafı, kaçıncı ders, buluşma noktası, ehliyet sınıfı/vites).
    /// Takvim ekranı N+1 istek atmasın diye ayrı uç tutulur.
    /// </summary>
    [HttpGet("calendar")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> GetCalendar(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? instructorProfileId,
        [FromQuery] Guid? vehicleId,
        [FromQuery] Guid? studentDrivingProfileId,
        [FromQuery] string? licenseClass,
        [FromQuery] string? transmissionType,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (to <= from || to - from > TimeSpan.FromDays(70))
            return BadRequest(new { message = "Takvim aralığı en fazla 70 gün olabilir." });

        var query = dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.StartsAtUtc < to && x.EndsAtUtc > from);

        if (instructorProfileId is Guid instructor) query = query.Where(x => x.InstructorProfileId == instructor);
        if (vehicleId is Guid vehicle) query = query.Where(x => x.VehicleId == vehicle);
        if (studentDrivingProfileId is Guid student) query = query.Where(x => x.StudentDrivingProfileId == student);

        if (!string.IsNullOrWhiteSpace(status))
        {
            // "open" = takvimde yer tutanlar; tek tek durum da verilebilir.
            if (status.Equals("open", StringComparison.OrdinalIgnoreCase))
            {
                var blocking = DrivingAppointmentStatuses.Blocking.ToArray();
                query = query.Where(x => blocking.Contains(x.Status));
            }
            else if (Enum.TryParse<DrivingAppointmentStatus>(status, ignoreCase: true, out var parsed))
            {
                query = query.Where(x => x.Status == parsed);
            }
        }

        var rows = await query
            .Join(dbContext.StudentDrivingProfiles.AsNoTracking(), a => a.StudentDrivingProfileId, p => p.Id, (a, p) => new { a, p })
            .Join(dbContext.Students.AsNoTracking(), x => x.p.StudentId, s => s.Id, (x, s) => new { x.a, x.p, StudentName = s.FullName })
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.a.InstructorProfileId, i => i.Id, (x, i) => new { x.a, x.p, x.StudentName, i.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, s => s.Id, (x, s) => new { x.a, x.p, x.StudentName, InstructorName = s.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.a.VehicleId, v => v.Id, (x, v) => new
            {
                x.a.Id,
                x.a.StudentDrivingProfileId,
                x.StudentName,
                studentPhotoUrl = x.p.PhotoUrl,
                x.p.LicenseClass,
                transmissionType = x.p.TransmissionType.ToString(),
                x.a.InstructorProfileId,
                x.InstructorName,
                x.a.VehicleId,
                VehiclePlate = v.PlateNumber,
                x.a.StartsAtUtc,
                x.a.EndsAtUtc,
                status = x.a.Status.ToString(),
                x.a.Notes,
                x.a.MeetingPoint,
            })
            .OrderBy(x => x.StartsAtUtc)
            .Take(2000)
            .ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(licenseClass))
            rows = rows.Where(x => string.Equals(x.LicenseClass, licenseClass, StringComparison.OrdinalIgnoreCase)).ToList();
        if (!string.IsNullOrWhiteSpace(transmissionType))
            rows = rows.Where(x => string.Equals(x.transmissionType, transmissionType, StringComparison.OrdinalIgnoreCase)).ToList();

        // "Kaçıncı ders" kartta gösterilir: öğrencinin tamamlanmış ders sayısı + 1.
        var profileIds = rows.Select(x => x.StudentDrivingProfileId).Distinct().ToList();
        var completedCounts = await dbContext.DrivingLessons.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.CompletedAtUtc != null)
            .GroupBy(x => x.StudentDrivingProfileId)
            .Select(x => new { ProfileId = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.ProfileId, x => x.Count, ct);

        return Ok(rows.Select(x => new
        {
            x.Id,
            x.StudentDrivingProfileId,
            x.StudentName,
            x.studentPhotoUrl,
            x.LicenseClass,
            x.transmissionType,
            x.InstructorProfileId,
            x.InstructorName,
            x.VehicleId,
            x.VehiclePlate,
            x.StartsAtUtc,
            x.EndsAtUtc,
            x.status,
            x.Notes,
            x.MeetingPoint,
            lessonNumber = completedCounts.GetValueOrDefault(x.StudentDrivingProfileId) + 1,
        }));
    }

    [HttpGet("appointments")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> GetAppointments([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var start = from ?? DateTime.UtcNow.Date.AddDays(-7); var end = to ?? DateTime.UtcNow.Date.AddDays(31);
        if (end <= start || end - start > TimeSpan.FromDays(370)) return BadRequest(new { message = "Tarih aralığı geçersiz." });
        var rows = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.StartsAtUtc < end && x.EndsAtUtc > start)
            .Join(dbContext.StudentDrivingProfiles.AsNoTracking(), a => a.StudentDrivingProfileId, p => p.Id, (a, p) => new { a, p })
            .Join(dbContext.Students.AsNoTracking(), x => x.p.StudentId, s => s.Id, (x, s) => new { x.a, StudentName = s.FullName })
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.a.InstructorProfileId, i => i.Id, (x, i) => new { x.a, x.StudentName, i.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, s => s.Id, (x, s) => new { x.a.Id, x.a.StudentDrivingProfileId, x.StudentName, x.a.InstructorProfileId, InstructorName = s.FullName, x.a.VehicleId, x.a.StartsAtUtc, x.a.EndsAtUtc, status = x.a.Status.ToString(), x.a.Notes })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.VehicleId, v => v.Id, (x, v) => new { x.Id, x.StudentDrivingProfileId, x.StudentName, x.InstructorProfileId, x.InstructorName, x.VehicleId, VehiclePlate = v.PlateNumber, x.StartsAtUtc, x.EndsAtUtc, x.status, x.Notes })
            .OrderBy(x => x.StartsAtUtc).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("appointments")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentCreate)]
    public async Task<IActionResult> CreateAppointment([FromBody] SaveDrivingAppointmentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var appointmentDuration = request.EndsAtUtc - request.StartsAtUtc;
        if (request.StartsAtUtc < DateTime.UtcNow.AddMinutes(-5) || request.EndsAtUtc <= request.StartsAtUtc || appointmentDuration < TimeSpan.FromMinutes(30) || appointmentDuration > TimeSpan.FromHours(4))
            return BadRequest(new { message = "Randevu zamanı 30 dakika ile 4 saat arasında olmalıdır." });

        var overrides = await ResolveOverridesAsync(request.Overrides, request.OverrideReason, ct);
        if (overrides.Error is not null) return BadRequest(new { message = overrides.Error });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        // Dosyası eksik, askıdaki veya kurstan ayrılmış aday randevuya alınamaz.
        var schedulableStatuses = DrivingStudentStatuses.Schedulable.ToArray();
        var student = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == request.StudentDrivingProfileId && schedulableStatuses.Contains(x.Status), ct);
        var vehicle = await dbContext.DrivingVehicles.SingleOrDefaultAsync(x => x.Id == request.VehicleId && x.IsActive, ct);
        var instructor = await dbContext.DrivingInstructorProfiles.SingleOrDefaultAsync(x => x.Id == request.InstructorProfileId && x.IsActive, ct);
        if (student is null || vehicle is null || instructor is null) return BadRequest(new { message = "Aktif öğrenci, araç veya öğretmen bulunamadı." });

        var vehicleUnfit = vehicle.IsInMaintenance || !vehicle.InspectionExpiresAtUtc.HasValue || !vehicle.InsuranceExpiresAtUtc.HasValue
            || vehicle.InspectionExpiresAtUtc <= request.EndsAtUtc || vehicle.InsuranceExpiresAtUtc <= request.EndsAtUtc;
        if (vehicleUnfit && !overrides.Has(DrivingPermissions.OverrideVehicleCompliance))
            return BadRequest(new { message = "Araç bakımda, zorunlu evrakı eksik veya evrak süresi randevu tarihinde geçersiz.", overridableWith = DrivingPermissions.OverrideVehicleCompliance });

        var licenseMismatch = !string.Equals(student.LicenseClass, vehicle.LicenseClass, StringComparison.OrdinalIgnoreCase);
        if (licenseMismatch) return BadRequest(new { message = "Araç, öğrencinin ehliyet sınıfıyla uyumlu değil." });

        var transmissionMismatch = student.TransmissionType != vehicle.TransmissionType;
        if (transmissionMismatch && !overrides.Has(DrivingPermissions.OverrideTransmission))
            return BadRequest(new { message = "Araç, öğrencinin vites türüyle uyumlu değil.", overridableWith = DrivingPermissions.OverrideTransmission });

        var classSet = instructor.LicenseClasses.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var transmissionOk = student.TransmissionType == TransmissionType.Manual ? instructor.CanTeachManual : instructor.CanTeachAutomatic;
        if (!transmissionOk || !classSet.Contains(student.LicenseClass, StringComparer.OrdinalIgnoreCase)) return BadRequest(new { message = "Öğretmenin sınıf veya vites yetkinliği uygun değil." });

        var duration = (int)(request.EndsAtUtc - request.StartsAtUtc).TotalMinutes;

        // Bakiye kontrolü PLANLANMIŞ dakikaları da hesaba katar: aksi hâlde öğrenci
        // 60 dakikalık hakkıyla üç ayrı randevu alabilirdi.
        var balance = await ledgerService.GetBalanceAsync(student.Id, ct);
        if (balance.AvailableMinutes < duration)
            return BadRequest(new
            {
                message = $"Öğrencinin planlanabilir direksiyon süresi yetersiz (serbest: {balance.AvailableMinutes} dk, gereken: {duration} dk).",
                availableMinutes = balance.AvailableMinutes,
                plannedMinutes = balance.PlannedMinutes,
            });

        // Çakışma yalnızca takvimde YER TUTAN randevular için geçerlidir; iptal
        // edilmiş veya devamsızlık yazılmış randevu slotu boşaltır.
        var blockingStatuses = DrivingAppointmentStatuses.Blocking.ToArray();
        var conflict = await dbContext.DrivingAppointments.AnyAsync(x => blockingStatuses.Contains(x.Status) && x.StartsAtUtc < request.EndsAtUtc && x.EndsAtUtc > request.StartsAtUtc && (x.VehicleId == request.VehicleId || x.InstructorProfileId == request.InstructorProfileId || x.StudentDrivingProfileId == request.StudentDrivingProfileId), ct);
        if (conflict && !overrides.Has(DrivingPermissions.OverrideAppointmentRule))
            return Conflict(new { message = "Öğrenci, öğretmen veya araç için çakışan randevu var.", overridableWith = DrivingPermissions.OverrideAppointmentRule });

        // Uygunluk kuralları (izin, çalışma saati, araç ataması, günlük limitler,
        // hazırlık payı, finansal bloke) tek serviste toplanır — kural kopyalanmaz.
        var violations = await availabilityService.CheckAsync(
            new AppointmentCandidate(student.Id, instructor.Id, vehicle.Id, request.StartsAtUtc, request.EndsAtUtc), ct);
        var blockingViolations = violations
            .Where(x => x.OverridableWith is null || !overrides.Has(x.OverridableWith))
            .ToList();
        if (blockingViolations.Count > 0)
            return BadRequest(new
            {
                message = string.Join(" ", blockingViolations.Select(x => x.Message)),
                violations = blockingViolations.Select(x => new { x.Code, x.Message, x.OverridableWith }),
                overridableWith = blockingViolations.Select(x => x.OverridableWith).FirstOrDefault(x => x is not null),
            });

        var entity = new CourseIntellect.Domain.Entities.DrivingAppointment
        {
            StudentDrivingProfileId = student.Id, VehicleId = vehicle.Id, InstructorProfileId = instructor.Id,
            StartsAtUtc = request.StartsAtUtc, EndsAtUtc = request.EndsAtUtc,
            Notes = request.Notes?.Trim() ?? string.Empty,
            MeetingPoint = request.MeetingPoint?.Trim() ?? string.Empty,
            Status = DrivingAppointmentStatus.Planned,
            CreatedByUserId = CurrentUserId(),
        };
        dbContext.DrivingAppointments.Add(entity);

        // Dakikalar hemen bloke edilir: randevu duran hak, harcanmamış ama bağlanmış haktır.
        await ledgerService.AddAsync(student.Id, DrivingLedgerEntryType.PlannedMinutes, -duration,
            $"{entity.StartsAtUtc:dd.MM.yyyy HH:mm} randevusu için ayrılan süre", appointmentId: entity.Id, cancellationToken: ct);
        AddStatusHistory(entity.Id, null, DrivingAppointmentStatus.Planned, "Randevu oluşturuldu", entity.Notes);

        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(student.Id, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var usedOverrides = overrides.Applied(vehicleUnfit, transmissionMismatch, conflict);
        // Uygunluk kurallarından bilerek ezilenler de aynı gerekçeyle audit'e düşer.
        var overriddenRules = violations
            .Where(x => x.OverridableWith is not null && overrides.Has(x.OverridableWith))
            .Select(x => x.Code)
            .ToList();

        await auditLogService.LogChangeAsync("Randevu oluşturuldu", AuditCategory, "DrivingAppointment", entity.Id.ToString(),
            $"{vehicle.PlateNumber} — {entity.StartsAtUtc:dd.MM.yyyy HH:mm}-{entity.EndsAtUtc:HH:mm} ({duration} dk)."
                + (usedOverrides.Count > 0 || overriddenRules.Count > 0
                    ? $" Kural ezildi: {string.Join(", ", usedOverrides.Concat(overriddenRules))}. Gerekçe: {overrides.Reason}"
                    : string.Empty),
            null,
            new { entity.StudentDrivingProfileId, entity.InstructorProfileId, entity.VehicleId, entity.StartsAtUtc, entity.EndsAtUtc, overrides = usedOverrides, overriddenRules, reason = overrides.Reason }, ct);

        var whenLocal = $"{DrivingAvailability.ToLocal(entity.StartsAtUtc):dd.MM.yyyy HH:mm}";
        await notifier.NotifyStudentAsync(student.Id,
            "Yeni direksiyon randevunuz var",
            $"{whenLocal} — {vehicle.PlateNumber} aracıyla {duration} dakikalık dersiniz planlandı."
                + (string.IsNullOrWhiteSpace(entity.MeetingPoint) ? string.Empty : $" Buluşma: {entity.MeetingPoint}."),
            DrivingNotificationCategories.Appointment,
            dedupeKey: $"appointment-created-student:{entity.Id}",
            relatedEntityType: "DrivingAppointment", relatedEntityId: entity.Id.ToString(), cancellationToken: ct);
        await notifier.NotifyInstructorAsync(instructor.Id,
            "Yeni ders atandı",
            $"{whenLocal} — {vehicle.PlateNumber} aracıyla {duration} dakikalık ders atandı.",
            DrivingNotificationCategories.Appointment,
            dedupeKey: $"appointment-created-instructor:{entity.Id}",
            relatedEntityType: "DrivingAppointment", relatedEntityId: entity.Id.ToString(), cancellationToken: ct);

        return Ok(entity);
    }

    [HttpGet("me")]
    [Authorize(Roles = "Teacher,Student")]
    public async Task<IActionResult> GetMyDrivingIdentity(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        if (User.IsInRole("Teacher"))
        {
            var instructor = await dbContext.DrivingInstructorProfiles.AsNoTracking()
                .Join(dbContext.Staff.AsNoTracking().Where(x => x.UserId == userId), x => x.StaffId, x => x.Id,
                    (profile, staff) => new { profile.Id, staff.FullName, profile.LicenseClasses, profile.CanTeachManual, profile.CanTeachAutomatic, profile.IsActive })
                .SingleOrDefaultAsync(ct);
            if (instructor is not null) return Ok(new { kind = "Instructor", profile = instructor });
        }

        if (User.IsInRole("Student"))
        {
            var student = await dbContext.StudentDrivingProfiles.AsNoTracking()
                .Join(dbContext.Students.AsNoTracking().Where(x => x.UserId == userId), x => x.StudentId, x => x.Id,
                    (profile, student) => new { profile.Id, student.FullName, profile.LicenseClass, transmissionType = profile.TransmissionType.ToString(), status = profile.Status.ToString() })
                .SingleOrDefaultAsync(ct);
            if (student is not null) return Ok(new { kind = "Student", profile = student });
        }

        return Ok(new { kind = "None" });
    }

    [HttpGet("instructor/my-appointments")]
    [Authorize(Roles = "Teacher")]
    [RequireDrivingPermission(DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> GetMyInstructorAppointments([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profileId = await CurrentInstructorProfileIdAsync(ct);
        if (profileId is null) return Forbid();
        var start = from ?? DateTime.UtcNow.Date.AddDays(-7);
        var end = to ?? DateTime.UtcNow.Date.AddDays(31);
        if (end <= start || end - start > TimeSpan.FromDays(120)) return BadRequest(new { message = "Tarih aralığı geçersiz." });

        var rows = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.InstructorProfileId == profileId && x.StartsAtUtc < end && x.EndsAtUtc > start)
            .Join(dbContext.StudentDrivingProfiles.AsNoTracking(), a => a.StudentDrivingProfileId, p => p.Id, (a, p) => new { a, p.StudentId, p.TransmissionType })
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { x.a, x.TransmissionType, StudentName = s.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.a.VehicleId, v => v.Id,
                (x, v) => new { x.a.Id, x.StudentName, transmissionType = x.TransmissionType.ToString(), VehiclePlate = v.PlateNumber, v.CurrentKilometer, x.a.StartsAtUtc, x.a.EndsAtUtc, status = x.a.Status.ToString(), x.a.Notes })
            .GroupJoin(dbContext.DrivingLessons.AsNoTracking(), x => x.Id, x => x.AppointmentId, (appointment, lessons) => new { appointment, lesson = lessons.FirstOrDefault() })
            .Select(x => new { x.appointment.Id, x.appointment.StudentName, x.appointment.transmissionType, x.appointment.VehiclePlate, x.appointment.CurrentKilometer, x.appointment.StartsAtUtc, x.appointment.EndsAtUtc, x.appointment.status, x.appointment.Notes, lessonId = x.lesson == null ? (Guid?)null : x.lesson.Id, startedAtUtc = x.lesson == null ? (DateTime?)null : x.lesson.StartedAtUtc, completedAtUtc = x.lesson == null ? null : x.lesson.CompletedAtUtc })
            .OrderBy(x => x.StartsAtUtc).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("student/my-overview")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMyStudentOverview(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profileId = await CurrentStudentDrivingProfileIdAsync(ct);
        if (profileId is null) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (p, s) => new { p, s.FullName })
            .Join(dbContext.DrivingPackages.AsNoTracking(), x => x.p.PackageId, x => x.Id,
                (x, package) => new { x.p.Id, x.FullName, PackageName = package.Name, x.p.LicenseClass, transmissionType = x.p.TransmissionType.ToString(), x.p.PurchasedDrivingMinutes, x.p.UsedDrivingMinutes, remainingDrivingMinutes = x.p.PurchasedDrivingMinutes - x.p.UsedDrivingMinutes, status = x.p.Status.ToString() })
            .SingleAsync(ct);
        var appointments = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.StartsAtUtc >= DateTime.UtcNow.Date.AddDays(-370))
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.InstructorProfileId, x => x.Id, (a, i) => new { a, i.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (x, staff) => new { x.a, InstructorName = staff.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.a.VehicleId, x => x.Id,
                (x, vehicle) => new { x.a.Id, x.InstructorName, VehiclePlate = vehicle.PlateNumber, x.a.StartsAtUtc, x.a.EndsAtUtc, status = x.a.Status.ToString(), x.a.Notes })
            .GroupJoin(dbContext.DrivingLessons.AsNoTracking(), x => x.Id, x => x.AppointmentId, (appointment, lessons) => new { appointment, lesson = lessons.FirstOrDefault() })
            .Select(x => new { x.appointment.Id, x.appointment.InstructorName, x.appointment.VehiclePlate, x.appointment.StartsAtUtc, x.appointment.EndsAtUtc, x.appointment.status, x.appointment.Notes, trafficRulesScore = x.lesson == null ? null : x.lesson.TrafficRulesScore, vehicleControlScore = x.lesson == null ? null : x.lesson.VehicleControlScore, maneuversScore = x.lesson == null ? null : x.lesson.ManeuversScore, safetyScore = x.lesson == null ? null : x.lesson.SafetyScore, evaluationScoresJson = x.lesson == null ? null : x.lesson.EvaluationScoresJson, evaluationVersion = x.lesson == null ? 0 : x.lesson.EvaluationVersion, instructorNote = x.lesson == null ? null : x.lesson.InstructorNote })
            .OrderBy(x => x.StartsAtUtc).Take(100).ToListAsync(ct);
        return Ok(new { profile, appointments });
    }

    [HttpPost("lessons/{appointmentId:guid}/start")]
    [Authorize(Roles = "Teacher")]
    [RequireDrivingPermission(DrivingPermissions.LessonStart)]
    public async Task<IActionResult> StartLesson(Guid appointmentId, [FromBody] StartDrivingLessonRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var instructorProfileId = await CurrentInstructorProfileIdAsync(ct);
        if (instructorProfileId is null) return Forbid();
        if (!request.BrakesOk || !request.TiresOk || !request.LightsOk || !request.FluidsOk)
            return BadRequest(new { message = "Ders başlamadan tüm araç ön kontrol maddeleri olumlu olmalıdır." });
        if ((request.PreCheckNote?.Length ?? 0) > 1000) return BadRequest(new { message = "Ön kontrol notu en fazla 1000 karakter olabilir." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var appointment = await dbContext.DrivingAppointments.SingleOrDefaultAsync(x => x.Id == appointmentId && x.InstructorProfileId == instructorProfileId, ct);
        if (appointment is null) return NotFound(new { message = "Atanmış ders bulunamadı." });
        if (!DrivingAppointmentStatuses.Startable.Contains(appointment.Status))
            return Conflict(new { message = $"Bu ders başlatılabilir durumda değil ({DrivingAppointmentStatuses.Label(appointment.Status)})." });
        var now = DateTime.UtcNow;
        if (now < appointment.StartsAtUtc.AddMinutes(-30) || now > appointment.EndsAtUtc.AddHours(2))
            return BadRequest(new { message = "Ders yalnızca planlanan başlangıçtan 30 dakika önce ve bitişten 2 saat sonrasına kadar başlatılabilir." });
        var vehicle = await dbContext.DrivingVehicles.SingleAsync(x => x.Id == appointment.VehicleId, ct);
        if (!vehicle.IsActive || vehicle.IsInMaintenance || !vehicle.InspectionExpiresAtUtc.HasValue || !vehicle.InsuranceExpiresAtUtc.HasValue || vehicle.InspectionExpiresAtUtc <= now || vehicle.InsuranceExpiresAtUtc <= now)
            return BadRequest(new { message = "Araç aktif değil, bakımda veya zorunlu evrakı geçersiz." });
        if (request.StartKilometer < vehicle.CurrentKilometer || request.StartKilometer > vehicle.CurrentKilometer + 20)
            return BadRequest(new { message = $"Başlangıç kilometresi araç kaydıyla uyumsuz. Beklenen değer: {vehicle.CurrentKilometer}." });
        if (await dbContext.DrivingLessons.AnyAsync(x => x.AppointmentId == appointmentId, ct))
            return Conflict(new { message = "Bu randevu için ders daha önce başlatılmış." });

        var lesson = new CourseIntellect.Domain.Entities.DrivingLesson
        {
            AppointmentId = appointment.Id, StudentDrivingProfileId = appointment.StudentDrivingProfileId,
            InstructorProfileId = appointment.InstructorProfileId, VehicleId = appointment.VehicleId,
            StartedAtUtc = now, StartKilometer = request.StartKilometer,
            BrakesOk = request.BrakesOk, TiresOk = request.TiresOk, LightsOk = request.LightsOk, FluidsOk = request.FluidsOk,
            PreCheckNote = request.PreCheckNote?.Trim() ?? string.Empty,
        };
        var previousStatus = appointment.Status;
        appointment.Status = DrivingAppointmentStatus.InProgress;
        dbContext.DrivingLessons.Add(lesson);
        AddStatusHistory(appointment.Id, previousStatus, DrivingAppointmentStatus.InProgress, "Ders başlatıldı", lesson.PreCheckNote);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync("Ders başlatıldı", AuditCategory, "DrivingLesson", lesson.Id.ToString(),
            $"{vehicle.PlateNumber} — başlangıç km {lesson.StartKilometer}.",
            new { status = DrivingAppointmentStatus.Planned.ToString() },
            new { status = DrivingAppointmentStatus.InProgress.ToString(), lesson.StartKilometer, lesson.StartedAtUtc }, ct);

        await notifier.NotifyStudentAsync(appointment.StudentDrivingProfileId,
            "Dersiniz başladı",
            $"{vehicle.PlateNumber} aracıyla direksiyon dersiniz başladı.",
            DrivingNotificationCategories.Lesson,
            dedupeKey: $"lesson-started:{lesson.Id}",
            relatedEntityType: "DrivingLesson", relatedEntityId: lesson.Id.ToString(), cancellationToken: ct);

        return Ok(new { lesson.Id, lesson.StartedAtUtc, status = appointment.Status.ToString() });
    }

    [HttpPost("lessons/{appointmentId:guid}/complete")]
    [Authorize(Roles = "Teacher")]
    [RequireDrivingPermission(DrivingPermissions.LessonComplete)]
    public async Task<IActionResult> CompleteLesson(Guid appointmentId, [FromBody] CompleteDrivingLessonRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var instructorProfileId = await CurrentInstructorProfileIdAsync(ct);
        if (instructorProfileId is null) return Forbid();
        if ((request.InstructorNote?.Length ?? 0) > 2000) return BadRequest(new { message = "Ders notu en fazla 2000 karakter olabilir." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var appointment = await dbContext.DrivingAppointments.SingleOrDefaultAsync(x => x.Id == appointmentId && x.InstructorProfileId == instructorProfileId, ct);
        if (appointment is null) return NotFound(new { message = "Atanmış ders bulunamadı." });
        if (appointment.Status != DrivingAppointmentStatus.InProgress) return Conflict(new { message = "Ders devam ediyor durumda değil." });
        var lesson = await dbContext.DrivingLessons.SingleOrDefaultAsync(x => x.AppointmentId == appointmentId && x.InstructorProfileId == instructorProfileId, ct);
        if (lesson is null || lesson.CompletedAtUtc.HasValue) return Conflict(new { message = "Ders kaydı bulunamadı veya daha önce tamamlandı." });
        if (request.EndKilometer < lesson.StartKilometer || request.EndKilometer > lesson.StartKilometer + 500)
            return BadRequest(new { message = "Bitiş kilometresi başlangıçtan küçük veya olağan sınırın üzerinde olamaz." });

        var student = await dbContext.StudentDrivingProfiles.SingleAsync(x => x.Id == appointment.StudentDrivingProfileId, ct);
        var vehicle = await dbContext.DrivingVehicles.SingleAsync(x => x.Id == appointment.VehicleId, ct);
        var evaluationError = DrivingEvaluation.Validate(request.Criteria, student.TransmissionType);
        if (evaluationError is not null) return BadRequest(new { message = evaluationError });
        var criteria = request.Criteria!;
        var scheduledMinutes = Math.Max(1, (int)Math.Ceiling((appointment.EndsAtUtc - appointment.StartsAtUtc).TotalMinutes));
        var elapsedMinutes = Math.Max(1, (int)Math.Ceiling((DateTime.UtcNow - lesson.StartedAtUtc).TotalMinutes));
        var chargedMinutes = Math.Min(scheduledMinutes, elapsedMinutes);

        var balanceBefore = await ledgerService.GetBalanceAsync(student.Id, ct);
        lesson.CompletedAtUtc = DateTime.UtcNow;
        lesson.EndKilometer = request.EndKilometer;
        lesson.TrafficRulesScore = DrivingEvaluation.CategoryScore(criteria, "trafficRules", student.TransmissionType);
        lesson.VehicleControlScore = DrivingEvaluation.CategoryScore(criteria, "vehicleControl", student.TransmissionType);
        lesson.ManeuversScore = DrivingEvaluation.CategoryScore(criteria, "maneuvers", student.TransmissionType);
        lesson.SafetyScore = DrivingEvaluation.CategoryScore(criteria, "safety", student.TransmissionType);
        lesson.EvaluationVersion = DrivingEvaluation.Version;
        lesson.EvaluationScoresJson = JsonSerializer.Serialize(criteria);
        lesson.InstructorNote = request.InstructorNote?.Trim() ?? string.Empty;
        lesson.ChargedMinutes = chargedMinutes;
        appointment.Status = DrivingAppointmentStatus.Completed;
        vehicle.CurrentKilometer = request.EndKilometer;

        // Rezervasyon kullanıma dönüşür: önce bloke edilen süre serbest bırakılır,
        // sonra gerçekten geçen süre harcanmış olarak işlenir. Ders planlanandan
        // kısa sürdüyse aradaki fark öğrenciye geri kalır.
        await ledgerService.AddAsync(student.Id, DrivingLedgerEntryType.ReservationReleased, scheduledMinutes,
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} dersi yapıldı, rezervasyon çözüldü", appointmentId: appointment.Id, cancellationToken: ct);
        await ledgerService.AddAsync(student.Id, DrivingLedgerEntryType.LessonUsage, -chargedMinutes,
            $"{appointment.StartsAtUtc:dd.MM.yyyy HH:mm} tarihli direksiyon dersi", appointmentId: appointment.Id, drivingLessonId: lesson.Id, cancellationToken: ct);

        AddStatusHistory(appointment.Id, DrivingAppointmentStatus.InProgress, DrivingAppointmentStatus.Completed,
            "Ders tamamlandı", $"{chargedMinutes} dk işlendi.");

        await dbContext.SaveChangesAsync(ct);
        await ledgerService.SyncProfileCacheAsync(student.Id, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var balanceAfter = await ledgerService.GetBalanceAsync(student.Id, ct);
        await auditLogService.LogChangeAsync("Ders tamamlandı", AuditCategory, "DrivingLesson", lesson.Id.ToString(),
            $"{vehicle.PlateNumber} — {chargedMinutes} dk işlendi, bitiş km {request.EndKilometer}.",
            new { usedMinutes = balanceBefore.UsedMinutes, remainingMinutes = balanceBefore.RemainingMinutes },
            new { usedMinutes = balanceAfter.UsedMinutes, remainingMinutes = balanceAfter.RemainingMinutes, lesson.ChargedMinutes, lesson.EndKilometer, scores = new { lesson.TrafficRulesScore, lesson.VehicleControlScore, lesson.ManeuversScore, lesson.SafetyScore }, criteria }, ct);
        await notifier.NotifyStudentAsync(student.Id,
            "Dersiniz tamamlandı",
            $"{chargedMinutes} dakikalık dersiniz işlendi. Kalan direksiyon hakkınız: {balanceAfter.RemainingMinutes} dk.",
            DrivingNotificationCategories.Lesson,
            dedupeKey: $"lesson-completed:{lesson.Id}",
            relatedEntityType: "DrivingLesson", relatedEntityId: lesson.Id.ToString(), cancellationToken: ct);

        // Ders hakkı bitmek üzereyse öğrenciyi ve kurumu uyar: ek ders satışı buradan doğar.
        if (balanceAfter.RemainingMinutes is > 0 and <= 60)
        {
            await notifier.NotifyStudentAsync(student.Id,
                "Ders hakkınız azalıyor",
                $"Kalan direksiyon hakkınız {balanceAfter.RemainingMinutes} dakika. Ek ders için kursunuzla görüşebilirsiniz.",
                DrivingNotificationCategories.Finance,
                dedupeKey: $"balance-low:{student.Id}:{balanceAfter.RemainingMinutes}",
                relatedEntityType: "StudentDrivingProfile", relatedEntityId: student.Id.ToString(), cancellationToken: ct);
        }

        return Ok(new
        {
            lesson.Id,
            lesson.CompletedAtUtc,
            lesson.ChargedMinutes,
            remainingDrivingMinutes = balanceAfter.RemainingMinutes,
            availableDrivingMinutes = balanceAfter.AvailableMinutes,
            status = appointment.Status.ToString(),
        });
    }

    [HttpGet("lessons")]
    [RequireDrivingPermission(DrivingPermissions.LessonViewAll)]
    public async Task<IActionResult> GetLessons([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var start = from ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = to ?? DateTime.UtcNow.Date.AddDays(1);
        if (end <= start || end - start > TimeSpan.FromDays(370)) return BadRequest(new { message = "Tarih aralığı geçersiz." });
        var rows = await dbContext.DrivingLessons.AsNoTracking()
            .Where(x => x.StartedAtUtc >= start && x.StartedAtUtc < end)
            .Join(dbContext.StudentDrivingProfiles.AsNoTracking(), lesson => lesson.StudentDrivingProfileId, profile => profile.Id, (lesson, profile) => new { lesson, profile.StudentId })
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, student => student.Id, (x, student) => new { x.lesson, StudentName = student.FullName })
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.lesson.InstructorProfileId, profile => profile.Id, (x, profile) => new { x.lesson, x.StudentName, profile.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, staff => staff.Id, (x, staff) => new { x.lesson, x.StudentName, InstructorName = staff.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.lesson.VehicleId, vehicle => vehicle.Id,
                (x, vehicle) => new
                {
                    x.lesson.Id, x.lesson.AppointmentId, x.StudentName, x.InstructorName, VehiclePlate = vehicle.PlateNumber,
                    x.lesson.StartedAtUtc, x.lesson.CompletedAtUtc, x.lesson.StartKilometer, x.lesson.EndKilometer,
                    x.lesson.BrakesOk, x.lesson.TiresOk, x.lesson.LightsOk, x.lesson.FluidsOk, x.lesson.PreCheckNote,
                    x.lesson.TrafficRulesScore, x.lesson.VehicleControlScore, x.lesson.ManeuversScore, x.lesson.SafetyScore,
                    x.lesson.EvaluationVersion, x.lesson.EvaluationScoresJson, x.lesson.InstructorNote, x.lesson.ChargedMinutes,
                })
            .OrderByDescending(x => x.StartedAtUtc)
            .Take(1000)
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("vehicle-documents")]
    [RequireDrivingPermission(DrivingPermissions.VehicleDocumentView)]
    public async Task<IActionResult> GetVehicleDocuments([FromQuery] Guid? vehicleId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var now = DateTime.UtcNow;
        var query = dbContext.DrivingVehicleDocuments.AsNoTracking();
        if (vehicleId.HasValue) query = query.Where(x => x.VehicleId == vehicleId);
        var rows = await query.Join(dbContext.DrivingVehicles.AsNoTracking(), document => document.VehicleId, vehicle => vehicle.Id,
            (document, vehicle) => new { document, vehicle.PlateNumber })
            .OrderBy(x => x.document.ExpiresAtUtc).Take(2000).ToListAsync(ct);
        return Ok(rows.Select(x => new
        {
            x.document.Id, x.document.VehicleId, x.PlateNumber, x.document.DocumentType, x.document.DocumentNumber,
            x.document.StartsAtUtc, x.document.ExpiresAtUtc, x.document.FileUrl, x.document.ReminderDays,
            x.document.Description, x.document.ApprovedAtUtc,
            status = x.document.ExpiresAtUtc <= now ? "Expired" : x.document.ExpiresAtUtc <= now.AddDays(x.document.ReminderDays) ? "ExpiringSoon" : "Valid",
        }));
    }

    [HttpPost("vehicle-documents")]
    [RequireDrivingPermission(DrivingPermissions.VehicleDocumentUpload)]
    public async Task<IActionResult> CreateVehicleDocument([FromBody] SaveDrivingVehicleDocumentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();
        if (!VehicleDocumentTypes.Contains(request.DocumentType)) return BadRequest(new { message = "Belge türü geçersiz." });
        if (request.DocumentNumber.Trim().Length is < 2 or > 100) return BadRequest(new { message = "Belge numarası 2-100 karakter olmalıdır." });
        if (request.ExpiresAtUtc <= request.StartsAtUtc || request.ExpiresAtUtc > DateTime.UtcNow.AddYears(20)) return BadRequest(new { message = "Belge tarih aralığı geçersiz." });
        if (request.ReminderDays is < 1 or > 365) return BadRequest(new { message = "Hatırlatma günü 1-365 arasında olmalıdır." });
        if ((request.Description?.Length ?? 0) > 1000) return BadRequest(new { message = "Açıklama en fazla 1000 karakter olabilir." });
        if (!IsSafeUploadUrl(request.FileUrl)) return BadRequest(new { message = "Belge dosyası mevcut güvenli yükleme alanından seçilmelidir." });
        var vehicle = await dbContext.DrivingVehicles.SingleOrDefaultAsync(x => x.Id == request.VehicleId, ct);
        if (vehicle is null) return BadRequest(new { message = "Araç bulunamadı." });

        var previousInspection = vehicle.InspectionExpiresAtUtc;
        var previousInsurance = vehicle.InsuranceExpiresAtUtc;
        var entity = new CourseIntellect.Domain.Entities.DrivingVehicleDocument
        {
            VehicleId = vehicle.Id, DocumentType = request.DocumentType.Trim(), DocumentNumber = request.DocumentNumber.Trim(),
            StartsAtUtc = request.StartsAtUtc, ExpiresAtUtc = request.ExpiresAtUtc, FileUrl = request.FileUrl.Trim(),
            ReminderDays = request.ReminderDays, Description = request.Description?.Trim() ?? string.Empty,
            ApprovedByUserId = actorId.Value,
        };
        if (request.DocumentType.Equals("Inspection", StringComparison.OrdinalIgnoreCase)) vehicle.InspectionExpiresAtUtc = request.ExpiresAtUtc;
        if (request.DocumentType.Equals("TrafficInsurance", StringComparison.OrdinalIgnoreCase)) vehicle.InsuranceExpiresAtUtc = request.ExpiresAtUtc;
        dbContext.DrivingVehicleDocuments.Add(entity);
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Araç evrakı eklendi", AuditCategory, "DrivingVehicleDocument", entity.Id.ToString(),
            $"{vehicle.PlateNumber} — {entity.DocumentType} no {entity.DocumentNumber}, geçerlilik {entity.ExpiresAtUtc:dd.MM.yyyy}.",
            new { inspectionExpiresAtUtc = previousInspection, insuranceExpiresAtUtc = previousInsurance },
            new { entity.DocumentType, entity.DocumentNumber, entity.ExpiresAtUtc, inspectionExpiresAtUtc = vehicle.InspectionExpiresAtUtc, insuranceExpiresAtUtc = vehicle.InsuranceExpiresAtUtc }, ct);
        return Ok(entity);
    }

    [HttpGet("vehicle-service-records")]
    [RequireDrivingPermission(DrivingPermissions.VehicleServiceView)]
    public async Task<IActionResult> GetVehicleServiceRecords([FromQuery] Guid? vehicleId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var query = dbContext.DrivingVehicleServiceRecords.AsNoTracking();
        if (vehicleId.HasValue) query = query.Where(x => x.VehicleId == vehicleId);
        var rows = await query.Join(dbContext.DrivingVehicles.AsNoTracking(), record => record.VehicleId, vehicle => vehicle.Id,
            (record, vehicle) => new { record.Id, record.VehicleId, vehicle.PlateNumber, record.RecordType, record.Title, record.ServiceProvider, record.Description, record.Priority, record.ReportedAtUtc, record.Kilometer, record.VehicleUsable, record.LaborCost, record.PartsCost, totalCost = record.LaborCost + record.PartsCost, record.NextServiceAtUtc, record.NextServiceKilometer, record.Status, record.Resolution, record.CompletedAtUtc })
            .OrderByDescending(x => x.ReportedAtUtc).Take(2000).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("vehicle-service-records")]
    [RequireDrivingPermission(DrivingPermissions.VehicleServiceManage, DrivingPermissions.VehicleServiceReport)]
    public async Task<IActionResult> CreateVehicleServiceRecord([FromBody] SaveDrivingVehicleServiceRecordRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();
        if (!VehicleServiceTypes.Contains(request.RecordType) || !ServicePriorities.Contains(request.Priority)) return BadRequest(new { message = "Kayıt türü veya öncelik geçersiz." });
        if (request.Title.Trim().Length is < 3 or > 180 || (request.Description?.Length ?? 0) > 2000) return BadRequest(new { message = "Başlık veya açıklama uzunluğu geçersiz." });
        if (request.LaborCost < 0 || request.PartsCost < 0 || request.Kilometer < 0) return BadRequest(new { message = "Kilometre ve maliyetler negatif olamaz." });

        // Yalnızca bildirim yetkisi olan (öğretmen) maliyet giremez, bakım kaydı açamaz;
        // sadece arıza/hasar bildirir.
        var canManage = await permissionService.HasAsync(User, DrivingPermissions.VehicleServiceManage, ct);
        if (!canManage)
        {
            if (request.RecordType.Equals("Maintenance", StringComparison.OrdinalIgnoreCase))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bakım kaydını yalnızca filo sorumlusu veya yönetici açabilir." });
            if (request.LaborCost > 0 || request.PartsCost > 0)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Maliyet girmek için bakım yönetim yetkisi gerekir." });
        }

        var vehicle = await dbContext.DrivingVehicles.SingleOrDefaultAsync(x => x.Id == request.VehicleId, ct);
        if (vehicle is null) return BadRequest(new { message = "Araç bulunamadı." });
        if (request.Kilometer < vehicle.CurrentKilometer - 1000 || request.Kilometer > vehicle.CurrentKilometer + 1000) return BadRequest(new { message = "Servis kilometresi güncel araç kilometresiyle uyumsuz." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var wasInMaintenance = vehicle.IsInMaintenance;
        var entity = new CourseIntellect.Domain.Entities.DrivingVehicleServiceRecord
        {
            VehicleId = vehicle.Id, RecordType = request.RecordType.Trim(), Title = request.Title.Trim(),
            ServiceProvider = request.ServiceProvider?.Trim() ?? string.Empty, Description = request.Description?.Trim() ?? string.Empty,
            Priority = request.Priority.Trim(), ReportedAtUtc = request.ReportedAtUtc ?? DateTime.UtcNow,
            Kilometer = request.Kilometer, VehicleUsable = request.VehicleUsable, LaborCost = request.LaborCost,
            PartsCost = request.PartsCost, NextServiceAtUtc = request.NextServiceAtUtc, NextServiceKilometer = request.NextServiceKilometer,
            ReportedByUserId = actorId.Value,
        };
        if (!request.VehicleUsable) vehicle.IsInMaintenance = true;
        dbContext.DrivingVehicleServiceRecords.Add(entity);
        await dbContext.SaveChangesAsync(ct);
        var affectedAppointments = !request.VehicleUsable
            ? await dbContext.DrivingAppointments.AsNoTracking().Where(x => x.VehicleId == vehicle.Id && x.StartsAtUtc > DateTime.UtcNow && x.Status != DrivingAppointmentStatus.Cancelled && x.Status != DrivingAppointmentStatus.Completed).Select(x => new { x.Id, x.StartsAtUtc, x.EndsAtUtc }).OrderBy(x => x.StartsAtUtc).Take(200).ToListAsync(ct)
            : [];
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync($"{ServiceRecordLabel(entity.RecordType)} kaydı açıldı", AuditCategory, "DrivingVehicleServiceRecord", entity.Id.ToString(),
            $"{vehicle.PlateNumber} — \"{entity.Title}\" ({entity.Priority}). Araç kullanılabilir: {entity.VehicleUsable}. Etkilenen randevu: {affectedAppointments.Count}.",
            new { isInMaintenance = wasInMaintenance },
            new { isInMaintenance = vehicle.IsInMaintenance, entity.RecordType, entity.Title, entity.Priority, entity.Kilometer, entity.LaborCost, entity.PartsCost, affectedAppointments = affectedAppointments.Count }, ct);

        if (!entity.VehicleUsable)
        {
            await notifier.NotifyManagersAsync(
                $"{vehicle.PlateNumber} kullanım dışı",
                $"{ServiceRecordLabel(entity.RecordType)}: {entity.Title}. Etkilenen randevu: {affectedAppointments.Count}. Araçların yeniden planlanması gerekiyor.",
                DrivingNotificationCategories.Fleet,
                dedupeKey: $"vehicle-out-of-service:{entity.Id}",
                relatedEntityType: "DrivingVehicle", relatedEntityId: vehicle.Id.ToString(), cancellationToken: ct);
        }

        return Ok(new { record = entity, affectedAppointments });
    }

    [HttpPost("vehicle-service-records/{id:guid}/complete")]
    [RequireDrivingPermission(DrivingPermissions.VehicleServiceManage)]
    public async Task<IActionResult> CompleteVehicleServiceRecord(Guid id, [FromBody] CompleteVehicleServiceRecordRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.Resolution.Trim().Length is < 3 or > 2000) return BadRequest(new { message = "Çözüm açıklaması 3-2000 karakter olmalıdır." });
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var record = await dbContext.DrivingVehicleServiceRecords.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (record is null) return NotFound(new { message = "Servis kaydı bulunamadı." });
        if (record.Status == "Completed") return Conflict(new { message = "Kayıt daha önce kapatılmış." });
        record.Status = "Completed"; record.Resolution = request.Resolution.Trim(); record.CompletedAtUtc = DateTime.UtcNow;
        var vehicle = await dbContext.DrivingVehicles.SingleAsync(x => x.Id == record.VehicleId, ct);
        var wasInMaintenance = vehicle.IsInMaintenance;
        var hasOtherBlockingRecord = await dbContext.DrivingVehicleServiceRecords.AnyAsync(x => x.VehicleId == record.VehicleId && x.Id != record.Id && x.Status == "Open" && !x.VehicleUsable, ct);
        vehicle.IsInMaintenance = hasOtherBlockingRecord;
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync($"{ServiceRecordLabel(record.RecordType)} kaydı kapatıldı", AuditCategory, "DrivingVehicleServiceRecord", record.Id.ToString(),
            $"{vehicle.PlateNumber} — \"{record.Title}\" kapatıldı. Araç bakımda: {vehicle.IsInMaintenance}.",
            new { status = "Open", isInMaintenance = wasInMaintenance },
            new { status = record.Status, isInMaintenance = vehicle.IsInMaintenance, record.Resolution }, ct);
        return Ok(new { record.Id, record.Status, record.CompletedAtUtc, vehicle.IsInMaintenance });
    }

    // ─── Override çözümü ──────────────────────────────────────────────────────
    // Bir iş kuralını ezmek üç şartı birden ister: istek override'ı açıkça talep
    // etmeli, kullanıcının o override izni olmalı, ve gerekçe yazılmalı.
    private async Task<OverrideContext> ResolveOverridesAsync(IReadOnlyList<string>? requested, string? reason, CancellationToken ct)
    {
        var codes = (requested ?? [])
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (codes.Count == 0) return new OverrideContext([], string.Empty, null);

        var unknown = codes.Where(x => !DrivingPermissions.OverrideCodes.Contains(x)).ToList();
        if (unknown.Count > 0) return new OverrideContext([], string.Empty, $"Tanımsız override kodu: {string.Join(", ", unknown)}.");

        var trimmedReason = reason?.Trim() ?? string.Empty;
        if (trimmedReason.Length is < MinOverrideReasonLength or > 500)
            return new OverrideContext([], string.Empty, $"Kural ezme gerekçesi {MinOverrideReasonLength}-500 karakter olmalıdır.");

        var granted = await permissionService.GetPermissionsAsync(User, ct);
        var missing = codes.Where(x => !granted.Contains(x)).ToList();
        if (missing.Count > 0) return new OverrideContext([], string.Empty, $"Bu kuralı ezme yetkiniz yok: {string.Join(", ", missing)}.");

        return new OverrideContext(codes, trimmedReason, null);
    }

    private sealed record OverrideContext(IReadOnlyList<string> Codes, string Reason, string? Error)
    {
        public bool Has(string code) => Codes.Contains(code, StringComparer.OrdinalIgnoreCase);

        /// <summary>Talep edilenlerden gerçekten bir kuralı ezmek için KULLANILANLAR.</summary>
        public List<string> Applied(bool vehicleUnfit, bool transmissionMismatch, bool conflict)
        {
            var applied = new List<string>();
            if (vehicleUnfit && Has(DrivingPermissions.OverrideVehicleCompliance)) applied.Add(DrivingPermissions.OverrideVehicleCompliance);
            if (transmissionMismatch && Has(DrivingPermissions.OverrideTransmission)) applied.Add(DrivingPermissions.OverrideTransmission);
            if (conflict && Has(DrivingPermissions.OverrideAppointmentRule)) applied.Add(DrivingPermissions.OverrideAppointmentRule);
            return applied;
        }
    }

    private static string ServiceRecordLabel(string recordType) => recordType.ToLowerInvariant() switch
    {
        "maintenance" => "Bakım",
        "fault" => "Arıza",
        "damage" => "Hasar",
        _ => "Servis",
    };

    private static object PackageSnapshot(CourseIntellect.Domain.Entities.DrivingPackage package)
        => new { package.Name, package.LicenseClass, transmissionType = package.TransmissionType.ToString(), package.DrivingLessonMinutes, package.TheoryLessonMinutes, package.Price, package.IsActive };

    private static object VehicleSnapshot(CourseIntellect.Domain.Entities.DrivingVehicle vehicle)
        => new { vehicle.PlateNumber, vehicle.Brand, vehicle.Model, vehicle.ModelYear, vehicle.LicenseClass, transmissionType = vehicle.TransmissionType.ToString(), vehicle.CurrentKilometer, vehicle.InspectionExpiresAtUtc, vehicle.InsuranceExpiresAtUtc, vehicle.IsActive, vehicle.IsInMaintenance };

    private static bool IsSafeUploadUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.RelativeOrAbsolute, out var uri)) return false;
        if (uri.IsAbsoluteUri && uri.Scheme is not ("http" or "https")) return false;
        var path = uri.IsAbsoluteUri ? uri.AbsolutePath : value;
        return path.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
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

    private async Task<Guid?> CurrentStudentDrivingProfileIdAsync(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return null;
        return await dbContext.StudentDrivingProfiles
            .Join(dbContext.Students.Where(x => x.UserId == userId), x => x.StudentId, x => x.Id, (profile, _) => (Guid?)profile.Id)
            .SingleOrDefaultAsync(ct);
    }

    private async Task<CourseIntellect.Domain.Entities.TenantWorkspace?> CurrentTenantAsync(CancellationToken cancellationToken)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId) return null;
        return await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == tenantId, cancellationToken);
    }

    private static bool IsAvailable(CourseIntellect.Domain.Entities.TenantWorkspace tenant) =>
        tenant.InstitutionType == InstitutionType.DrivingSchool
        && tenant.DrivingSchoolModuleEnabled
        && string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase);

    private async Task<bool> CanUseModuleAsync(CancellationToken ct) => IsAvailable(await CurrentTenantAsync(ct) ?? new());

    private static string? ValidateGroupTerm(SaveDrivingStudentGroupRequest request)
    {
        if (request.TermYear is { } year && year is < 2000 or > 2100) return "Dönem yılı geçersiz.";
        if (request.TermNumber is { } number && number is < 1 or > 99) return "Dönem numarası 1-99 arasında olmalıdır.";
        if ((request.MebbisTermCode?.Length ?? 0) > 40) return "MEBBİS dönem kodu en fazla 40 karakter olabilir.";
        if (request.Quota is < 0 or > 10000) return "Kontenjan 0-10000 arasında olmalıdır (0 = sınırsız).";
        return null;
    }

    private static string TermLabel(CourseIntellect.Domain.Entities.DrivingStudentGroup group)
        => group.TermYear is { } year && group.TermNumber is { } number ? $" — resmî dönem {year}/{number}" : string.Empty;

    private static string? ValidatePackage(SaveDrivingPackageRequest request)
    {
        if (request.Name.Trim().Length is < 2 or > 140) return "Paket adı 2-140 karakter olmalıdır.";
        if (!LicenseClasses.Contains(request.LicenseClass.Trim()) || !Enum.IsDefined(request.TransmissionType)) return "Ehliyet sınıfı veya vites türü geçersiz.";
        if (request.DrivingLessonMinutes is < 30 or > 100000 || request.TheoryLessonMinutes is < 0 or > 100000 || request.Price < 0) return "Ders süresi veya fiyat geçersiz.";
        return null;
    }
}

public sealed record SaveDrivingPackageRequest(string Name, string LicenseClass, TransmissionType TransmissionType, int DrivingLessonMinutes, int TheoryLessonMinutes, decimal Price);
public sealed record SaveDrivingVehicleRequest(string PlateNumber, string Brand, string Model, int ModelYear, string LicenseClass, TransmissionType TransmissionType, int CurrentKilometer, DateTime? InspectionExpiresAtUtc, DateTime? InsuranceExpiresAtUtc);
public sealed record SaveDrivingInstructorRequest(Guid StaffId, IReadOnlyList<string> LicenseClasses, bool CanTeachManual, bool CanTeachAutomatic, string? WorkingPermitNo = null, DateTime? WorkingPermitExpiresAtUtc = null);
public sealed record UpdateWorkingPermitRequest(string? WorkingPermitNo, DateTime? WorkingPermitExpiresAtUtc);
public sealed record SaveStudentDrivingProfileRequest(Guid StudentId, Guid PackageId, string LicenseClass, TransmissionType TransmissionType);
public sealed record SaveDrivingStudentGroupRequest(
    string Name,
    string? Description,
    bool? IsActive,
    int? TermYear = null,
    int? TermNumber = null,
    string? MebbisTermCode = null,
    int Quota = 0,
    DateTime? RegistrationDeadlineUtc = null);
public sealed record AssignStudentGroupRequest(IReadOnlyList<Guid> ProfileIds, Guid? GroupId);
public sealed record SaveDrivingAppointmentRequest(Guid StudentDrivingProfileId, Guid InstructorProfileId, Guid VehicleId, DateTime StartsAtUtc, DateTime EndsAtUtc, string? Notes, string? MeetingPoint, IReadOnlyList<string>? Overrides, string? OverrideReason);
public sealed record StartDrivingLessonRequest(int StartKilometer, bool BrakesOk, bool TiresOk, bool LightsOk, bool FluidsOk, string? PreCheckNote);
public sealed record CompleteDrivingLessonRequest(int EndKilometer, Dictionary<string, int>? Criteria, string? InstructorNote);
public sealed record SaveDrivingVehicleDocumentRequest(Guid VehicleId, string DocumentType, string DocumentNumber, DateTime? StartsAtUtc, DateTime ExpiresAtUtc, string FileUrl, int ReminderDays, string? Description);
public sealed record SaveDrivingVehicleServiceRecordRequest(Guid VehicleId, string RecordType, string Title, string? ServiceProvider, string? Description, string Priority, DateTime? ReportedAtUtc, int Kilometer, bool VehicleUsable, decimal LaborCost, decimal PartsCost, DateTime? NextServiceAtUtc, int? NextServiceKilometer);
public sealed record CompleteVehicleServiceRecordRequest(string Resolution);
