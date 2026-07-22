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

/// <summary>Dönem açılışının sekiz adımını sunucuda doğrular ve tek işlemde tamamlar.</summary>
[ApiController]
[Authorize]
[Route("api/driving-school/term-opening-wizard")]
public sealed class DrivingTermOpeningController(
    CourseIntellectDbContext db,
    IDrivingPermissionService permissions,
    IAuditLogService audit) : ControllerBase
{
    // Tek sihirbaz bir teorik sınıf açar; eğitim modülünün sınıf üst sınırı 100'dür.
    private const int MaxStudents = 100;
    private const int MaxSessions = 120;

    [HttpGet("options")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Options(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var candidates = await CandidateRowsAsync(null, ct);
        var instructors = await db.Staff.AsNoTracking().OrderBy(x => x.FullName)
            .Select(x => new { x.Id, x.FullName }).ToListAsync(ct);
        return Ok(new
        {
            students = candidates.Where(x => x.StudentGroupId is null).Select(ToCandidateResponse),
            instructors,
            limits = new { maxStudents = MaxStudents, maxSessions = MaxSessions },
        });
    }

    [HttpPost("validate")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Validate([FromBody] TermOpeningRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await HasAllWritePermissionsAsync(ct)) return Forbid();
        return Ok(await ValidateAsync(request, ct));
    }

    [HttpPost("open")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Open([FromBody] TermOpeningRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await HasAllWritePermissionsAsync(ct)) return Forbid();

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var validation = await ValidateAsync(request, ct);
        if (!validation.Ready)
            return Conflict(new { message = "Dönem, son kontrol hataları giderilmeden açılamaz.", validation });

        var studentIds = request.StudentProfileIds.Distinct().ToList();
        var students = await db.StudentDrivingProfiles.Where(x => studentIds.Contains(x.Id)).ToListAsync(ct);
        if (students.Count != studentIds.Count || students.Any(x => x.StudentGroupId != null))
            return Conflict(new { message = "Kursiyerlerden biri başka bir işlem tarafından döneme atandı. Listeyi yenileyin." });

        var group = new DrivingStudentGroup
        {
            Name = request.Name.Trim(), Description = request.Description?.Trim() ?? string.Empty,
            TermYear = request.TermYear, TermNumber = request.TermNumber,
            MebbisTermCode = request.MebbisTermCode.Trim(), Quota = request.Quota,
            RegistrationDeadlineUtc = request.RegistrationDeadlineUtc,
            CreatedByUserId = CurrentUserId(), IsActive = true,
        };
        var theoryClass = new DrivingTheoryClass
        {
            Name = request.TheoryClassName.Trim(), LicenseClass = request.LicenseClass.Trim().ToUpperInvariant(),
            InstructorStaffId = request.InstructorStaffId, Capacity = request.Quota,
            StartsAtUtc = request.TheoryStartsAtUtc, EndsAtUtc = request.TheoryEndsAtUtc,
            Room = request.Room.Trim(), Status = DrivingTheoryClassStatus.Active,
        };
        db.DrivingStudentGroups.Add(group);
        db.DrivingTheoryClasses.Add(theoryClass);
        foreach (var student in students)
        {
            student.StudentGroupId = group.Id;
            if (student.Status == DrivingStudentStatus.Active) student.Status = DrivingStudentStatus.TheoryOngoing;
            db.DrivingTheoryEnrollments.Add(new DrivingTheoryEnrollment { TheoryClassId = theoryClass.Id, StudentDrivingProfileId = student.Id });
        }
        db.DrivingTheorySessions.AddRange(request.Sessions.Select(x => new DrivingTheorySession
        {
            TheoryClassId = theoryClass.Id, InstructorStaffId = x.InstructorStaffId ?? request.InstructorStaffId,
            Subject = x.Subject.Trim(), Topic = x.Topic.Trim(), StartsAtUtc = x.StartsAtUtc,
            EndsAtUtc = x.EndsAtUtc, Room = string.IsNullOrWhiteSpace(x.Room) ? request.Room.Trim() : x.Room.Trim(),
        }));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await audit.LogChangeAsync("Dönem sihirbazla açıldı", "DrivingSchool", nameof(DrivingStudentGroup), group.Id.ToString(),
            $"{group.Name}: {students.Count} kursiyer, {request.Sessions.Count} teorik ders.", null,
            new { group.Id, theoryClassId = theoryClass.Id, group.TermYear, group.TermNumber, group.MebbisTermCode, group.Quota, studentCount = students.Count, sessionCount = request.Sessions.Count }, ct);
        return Ok(new
        {
            groupId = group.Id, theoryClassId = theoryClass.Id, group.Name,
            studentCount = students.Count, mebbisReadyCount = validation.MebbisReadyCount,
            sessionCount = request.Sessions.Count,
            mebbisRosterUrl = $"/api/driving-school/student-groups/{group.Id}/mebbis-roster?format=csv",
            termReportUrl = $"/api/driving-school/student-groups/{group.Id}/term-report?format=pdf",
            scheduleUrl = $"/api/driving-school/theory/classes/{theoryClass.Id}/schedule?format=pdf",
        });
    }

    private async Task<TermOpeningValidation> ValidateAsync(TermOpeningRequest request, CancellationToken ct)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        var name = request.Name?.Trim() ?? string.Empty;
        var code = request.MebbisTermCode?.Trim() ?? string.Empty;
        var room = request.Room?.Trim() ?? string.Empty;
        var licenseClass = request.LicenseClass?.Trim().ToUpperInvariant() ?? string.Empty;
        var ids = (request.StudentProfileIds ?? []).Distinct().ToList();
        var sessions = request.Sessions ?? [];

        if (name.Length is < 3 or > 120) errors.Add("Dönem adı 3-120 karakter olmalıdır.");
        if ((request.Description?.Length ?? 0) > 500) errors.Add("Açıklama en fazla 500 karakter olabilir.");
        if (request.TermYear is < 2000 or > 2100) errors.Add("Dönem yılı geçersiz.");
        if (request.TermNumber is < 1 or > 99) errors.Add("Dönem numarası 1-99 arasında olmalıdır.");
        if (code.Length is < 1 or > 40) errors.Add("MEBBİS dönem kodu zorunludur ve en fazla 40 karakter olabilir.");
        if (request.Quota is < 1 or > MaxStudents) errors.Add($"Kontenjan 1-{MaxStudents} arasında olmalıdır.");
        if (request.RegistrationDeadlineUtc <= DateTime.UtcNow) errors.Add("Son kayıt tarihi gelecekte olmalıdır.");
        if (ids.Count == 0) errors.Add("En az bir kursiyer seçilmelidir.");
        if (ids.Count > request.Quota) errors.Add("Seçilen kursiyer sayısı kontenjanı aşıyor.");
        if (ids.Count > MaxStudents) errors.Add($"En fazla {MaxStudents} kursiyer seçilebilir.");
        if (request.TheoryClassName?.Trim().Length is < 3 or > 150) errors.Add("Teorik sınıf adı 3-150 karakter olmalıdır.");
        if (licenseClass.Length is < 1 or > 20) errors.Add("Ehliyet sınıfı geçersiz.");
        if (room.Length is < 1 or > 120) errors.Add("Derslik zorunludur ve en fazla 120 karakter olabilir.");
        if (request.TheoryEndsAtUtc <= request.TheoryStartsAtUtc) errors.Add("Teorik eğitim tarih aralığı geçersiz.");
        if (sessions.Count == 0) errors.Add("En az bir teorik ders oturumu eklenmelidir.");
        if (sessions.Count > MaxSessions) errors.Add($"En fazla {MaxSessions} ders oturumu eklenebilir.");

        if (await db.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.Name == name, ct)) errors.Add("Bu isimde bir dönem zaten var.");
        if (await db.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.TermYear == request.TermYear && x.TermNumber == request.TermNumber, ct)) errors.Add("Bu resmî dönem daha önce açılmış.");
        if (await db.DrivingStudentGroups.AsNoTracking().AnyAsync(x => x.MebbisTermCode == code, ct)) errors.Add("Bu MEBBİS dönem kodu daha önce kullanılmış.");
        if (!await db.Staff.AsNoTracking().AnyAsync(x => x.Id == request.InstructorStaffId, ct)) errors.Add("Atanan öğretmen bulunamadı.");

        var candidates = await CandidateRowsAsync(ids, ct);
        if (candidates.Count != ids.Count) errors.Add("Seçilen kursiyerlerden biri bulunamadı veya erişim kapsamınız dışında.");
        foreach (var candidate in candidates)
        {
            if (candidate.StudentGroupId is not null) errors.Add($"{candidate.FullName} zaten başka bir döneme atanmış.");
            if (!candidate.LicenseClass.Equals(licenseClass, StringComparison.OrdinalIgnoreCase)) errors.Add($"{candidate.FullName}: ehliyet sınıfı {licenseClass} ile uyuşmuyor.");
            if (candidate.Status is not (DrivingStudentStatus.Active or DrivingStudentStatus.TheoryOngoing)) errors.Add($"{candidate.FullName}: durumu teorik eğitime uygun değil.");
            if (candidate.Missing.Count > 0) errors.Add($"{candidate.FullName}: MEBBİS/evrak eksiği var ({string.Join(", ", candidate.Missing.Take(3))}).");
        }

        for (var i = 0; i < sessions.Count; i++)
        {
            var item = sessions[i];
            var itemRoom = string.IsNullOrWhiteSpace(item.Room) ? room : item.Room.Trim();
            var instructorId = item.InstructorStaffId ?? request.InstructorStaffId;
            if (item.Subject?.Trim().Length is < 2 or > 120 || item.Topic?.Trim().Length is < 2 or > 250) errors.Add($"{i + 1}. dersin konu/başlık bilgisi geçersiz.");
            if (item.EndsAtUtc <= item.StartsAtUtc || item.StartsAtUtc < request.TheoryStartsAtUtc || item.EndsAtUtc > request.TheoryEndsAtUtc) errors.Add($"{i + 1}. ders sınıf tarih aralığının dışında.");
            if (!await db.Staff.AsNoTracking().AnyAsync(x => x.Id == instructorId, ct)) errors.Add($"{i + 1}. dersin öğretmeni bulunamadı.");
            if (sessions.Where((_, index) => index != i).Any(x => x.StartsAtUtc < item.EndsAtUtc && x.EndsAtUtc > item.StartsAtUtc && ((x.InstructorStaffId ?? request.InstructorStaffId) == instructorId || (string.IsNullOrWhiteSpace(x.Room) ? room : x.Room.Trim()).Equals(itemRoom, StringComparison.OrdinalIgnoreCase)))) errors.Add($"{i + 1}. ders başka bir sihirbaz dersiyle öğretmen/derslik çakışması oluşturuyor.");
            if (await db.DrivingTheorySessions.AsNoTracking().AnyAsync(x => x.Status == DrivingTheorySessionStatus.Planned && x.StartsAtUtc < item.EndsAtUtc && x.EndsAtUtc > item.StartsAtUtc && (x.InstructorStaffId == instructorId || x.Room == itemRoom), ct)) errors.Add($"{i + 1}. ders mevcut programda öğretmen/derslik çakışması oluşturuyor.");
        }
        if (ids.Count < request.Quota) warnings.Add($"Kontenjanın {request.Quota - ids.Count} kişilik bölümü boş.");
        return new TermOpeningValidation(errors.Count == 0, errors.Distinct().ToList(), warnings, ids.Count, candidates.Count(x => x.Missing.Count == 0), sessions.Count);
    }

    private async Task<List<CandidateRow>> CandidateRowsAsync(IReadOnlyList<Guid>? selected, CancellationToken ct)
    {
        var query = db.StudentDrivingProfiles.AsNoTracking().Where(x => DrivingStudentStatuses.Open.Contains(x.Status));
        if (selected is not null) query = query.Where(x => selected.Contains(x.Id));
        var rows = await query.Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { Profile = p, s.FullName, s.TcNo, s.BirthDate }).OrderBy(x => x.FullName).ToListAsync(ct);
        var ids = rows.Select(x => x.Profile.Id).ToList();
        var docs = await db.StudentDrivingDocuments.AsNoTracking().Where(x => ids.Contains(x.StudentDrivingProfileId) && x.IsCurrent).ToListAsync(ct);
        var lookup = docs.ToLookup(x => x.StudentDrivingProfileId);
        var now = DateTime.UtcNow;
        return rows.Select(x =>
        {
            var current = lookup[x.Profile.Id].ToList();
            bool Approved(StudentDocumentType type) => current.Any(d => d.DocumentType == type && DrivingStudentRules.CountsAsSatisfied(d.Status));
            var identity = x.Profile.IdentityKind == IdentityKind.TurkishId && string.IsNullOrWhiteSpace(x.Profile.IdentityNumber) ? x.TcNo : x.Profile.IdentityNumber;
            var missing = DrivingStudentRules.MebbisMissingFields(new(
                x.Profile.IdentityKind != IdentityKind.TurkishId || DrivingStudentRules.IsValidTurkishId(identity), x.BirthDate,
                x.Profile.FatherName, x.Profile.MotherName, x.Profile.BirthPlace, x.Profile.EducationLevel,
                x.Profile.IdentitySerialNo, x.Profile.Phone, Approved(StudentDocumentType.BiometricPhoto) || x.Profile.PhotoUrl != "",
                Approved(StudentDocumentType.HealthReport),
                Approved(StudentDocumentType.Diploma), Approved(StudentDocumentType.CriminalRecord)));
            var required = DrivingStudentRules.RequiredDocumentsFor(x.BirthDate, now);
            missing.AddRange(required.Where(type => !Approved(type)).Select(DrivingStudentRules.DocumentLabel));
            return new CandidateRow(x.Profile.Id, x.FullName, x.Profile.StudentNumber, x.Profile.LicenseClass, x.Profile.Status, x.Profile.StudentGroupId, missing.Distinct().ToList());
        }).ToList();
    }

    private static object ToCandidateResponse(CandidateRow x) => new { id = x.Id, x.FullName, x.StudentNumber, x.LicenseClass, status = x.Status.ToString(), x.StudentGroupId, mebbisReady = x.Missing.Count == 0, x.Missing };
    private async Task<bool> HasAllWritePermissionsAsync(CancellationToken ct) =>
        await permissions.HasAsync(User, DrivingPermissions.StudentUpdate, ct) &&
        await permissions.HasAsync(User, DrivingPermissions.TheoryManage, ct) &&
        await permissions.HasAsync(User, DrivingPermissions.MebbisManage, ct);
    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (db.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record CandidateRow(Guid Id, string FullName, int StudentNumber, string LicenseClass, DrivingStudentStatus Status, Guid? StudentGroupId, List<string> Missing);
}

public sealed record TermOpeningSessionRequest(Guid? InstructorStaffId, string Subject, string Topic, DateTime StartsAtUtc, DateTime EndsAtUtc, string? Room);
public sealed record TermOpeningRequest(
    string Name, string? Description, int TermYear, int TermNumber, string MebbisTermCode,
    int Quota, DateTime RegistrationDeadlineUtc, string LicenseClass, IReadOnlyList<Guid> StudentProfileIds,
    string TheoryClassName, Guid InstructorStaffId, string Room, DateTime TheoryStartsAtUtc,
    DateTime TheoryEndsAtUtc, IReadOnlyList<TermOpeningSessionRequest> Sessions);
public sealed record TermOpeningValidation(bool Ready, IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings, int SelectedCount, int MebbisReadyCount, int SessionCount);
