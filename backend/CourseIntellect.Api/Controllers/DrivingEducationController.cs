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

[ApiController]
[Authorize]
[Route("api/driving-school")]
public sealed class DrivingEducationController(
    CourseIntellectDbContext db,
    IDrivingPermissionService permissions,
    IDrivingNotifier notifier,
    IDrivingLedgerService ledgerService,
    IDrivingReportPdfService pdf,
    IAuditLogService audit) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";
    private const string ManualExamRightNote = "Sınav Hakları sayfasından manuel giriş";

    [HttpGet("education/overview")]
    [RequireDrivingPermission(DrivingPermissions.TheoryView, DrivingPermissions.ExamView)]
    public async Task<IActionResult> Overview([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var start = from ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = to ?? DateTime.UtcNow.Date.AddDays(120);
        if (end <= start || end - start > TimeSpan.FromDays(730)) return BadRequest(new { message = "Tarih aralığı geçersiz." });

        var staffId = await CurrentStaffIdAsync(ct);
        var studentId = await CurrentStudentProfileIdAsync(ct);
        var theoryQuery = db.DrivingTheoryClasses.AsNoTracking();
        if (User.IsInRole("Teacher") && staffId.HasValue) theoryQuery = theoryQuery.Where(x => x.InstructorStaffId == staffId);
        if (studentId.HasValue)
        {
            var classIds = db.DrivingTheoryEnrollments.AsNoTracking().Where(x => x.StudentDrivingProfileId == studentId).Select(x => x.TheoryClassId);
            theoryQuery = theoryQuery.Where(x => classIds.Contains(x.Id));
        }

        var classes = await theoryQuery
            .Join(db.Staff.AsNoTracking(), x => x.InstructorStaffId, x => x.Id, (item, staff) => new
            {
                item.Id, item.Name, item.LicenseClass, item.InstructorStaffId, instructorName = staff.FullName,
                item.Capacity, item.StartsAtUtc, item.EndsAtUtc, item.Room, status = item.Status.ToString(),
                studentCount = db.DrivingTheoryEnrollments.Count(e => e.TheoryClassId == item.Id),
            }).OrderByDescending(x => x.StartsAtUtc).ToListAsync(ct);

        var classIdList = classes.Select(x => x.Id).ToList();
        var sessions = await db.DrivingTheorySessions.AsNoTracking()
            .Where(x => classIdList.Contains(x.TheoryClassId) && x.StartsAtUtc >= start && x.StartsAtUtc < end)
            .Join(db.DrivingTheoryClasses.AsNoTracking(), x => x.TheoryClassId, x => x.Id, (session, group) => new { session, className = group.Name })
            .Join(db.Staff.AsNoTracking(), x => x.session.InstructorStaffId, x => x.Id, (x, staff) => new
            {
                x.session.Id, x.session.TheoryClassId, x.className, x.session.InstructorStaffId, instructorName = staff.FullName,
                x.session.Subject, x.session.Topic, x.session.StartsAtUtc, x.session.EndsAtUtc, x.session.Room,
                status = x.session.Status.ToString(),
                attendanceCount = db.DrivingTheoryAttendances.Count(a => a.TheorySessionId == x.session.Id),
            }).OrderBy(x => x.StartsAtUtc).ToListAsync(ct);

        var examQuery = db.DrivingExamSessions.AsNoTracking().Where(x => x.StartsAtUtc >= start && x.StartsAtUtc < end);
        if (studentId.HasValue)
        {
            var examIds = db.DrivingExamCandidates.AsNoTracking().Where(x => x.StudentDrivingProfileId == studentId).Select(x => x.ExamSessionId);
            examQuery = examQuery.Where(x => examIds.Contains(x.Id));
        }
        var exams = await examQuery.Select(x => new
        {
            x.Id, examType = x.ExamType.ToString(), x.Title, x.StartsAtUtc, x.EndsAtUtc, x.Location, x.Capacity,
            status = x.Status.ToString(), candidateCount = db.DrivingExamCandidates.Count(c => c.ExamSessionId == x.Id),
            commission = db.DrivingExamCommissionMembers.Where(c => c.ExamSessionId == x.Id).Select(c => new { c.Id, c.FullName, c.Role, c.Organization }).ToList(),
        }).OrderBy(x => x.StartsAtUtc).ToListAsync(ct);

        var candidatesQuery = db.DrivingExamCandidates.AsNoTracking().Where(x => exams.Select(e => e.Id).Contains(x.ExamSessionId));
        if (studentId.HasValue) candidatesQuery = candidatesQuery.Where(x => x.StudentDrivingProfileId == studentId);
        var candidates = await candidatesQuery
            .Join(db.StudentDrivingProfiles.AsNoTracking(), x => x.StudentDrivingProfileId, x => x.Id, (candidate, profile) => new { candidate, profile.StudentId })
            .Join(db.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (x, student) => new
            {
                x.candidate.Id, x.candidate.ExamSessionId, x.candidate.StudentDrivingProfileId, studentName = student.FullName,
                x.candidate.AttemptNo, maxAttempts = DrivingExamRules.MaxAttempts,
                status = x.candidate.Status.ToString(), x.candidate.Score, x.candidate.FailureReason,
                x.candidate.ResultNote, x.candidate.ResultEnteredAtUtc, x.candidate.DrivingChargeId,
                x.candidate.AssignedVehicleId, x.candidate.AssignedInstructorProfileId,
            }).OrderBy(x => x.studentName).ToListAsync(ct);

        var canManage = await permissions.HasAsync(User, DrivingPermissions.TheoryManage, ct)
            || await permissions.HasAsync(User, DrivingPermissions.ExamManage, ct);
        object? reference = null;
        if (canManage)
        {
            // IReadOnlySet.Contains doğrudan EF ifadesinde bırakıldığında Npgsql
            // sağlayıcısı bazı sürümlerde sorguyu SQL'e çeviremiyor ve yönetici
            // overview isteği 500 ile sonuçlanıyor. Sabit diziyi parametre olarak
            // geçirerek PostgreSQL'in çevirebildiği IN/ANY sorgusunu üretiriz.
            var openStudentStatuses = DrivingStudentStatuses.Open.ToArray();
            reference = new
            {
                instructors = await db.Staff.AsNoTracking().OrderBy(x => x.FullName).Select(x => new { x.Id, x.FullName }).ToListAsync(ct),
                // Grup (dönem) bilgisi de döner: teorik sınıfa öğrenci atarken/filtrelerken görünür.
                students = await db.StudentDrivingProfiles.AsNoTracking().Where(x => openStudentStatuses.Contains(x.Status))
                    .Join(db.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (profile, student) => new { profile, student.FullName })
                    .GroupJoin(db.DrivingStudentGroups.AsNoTracking(), x => x.profile.StudentGroupId, g => (Guid?)g.Id, (x, gs) => new { x.profile, x.FullName, gs })
                    .SelectMany(x => x.gs.DefaultIfEmpty(), (x, g) => new { id = x.profile.Id, x.FullName, x.profile.LicenseClass, status = x.profile.Status.ToString(), groupId = x.profile.StudentGroupId, groupName = g != null ? g.Name : null })
                    .OrderBy(x => x.FullName).ToListAsync(ct),
            };
        }
        return Ok(new { classes, sessions, exams, candidates, reference });
    }

    [HttpPost("theory/classes")]
    [RequireDrivingPermission(DrivingPermissions.TheoryManage)]
    public async Task<IActionResult> CreateTheoryClass([FromBody] SaveTheoryClassRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        // Her koşula ayrı, anlaşılır mesaj (eski tek "geçersiz" mesajı hangi alanın hatalı
        // olduğunu göstermiyordu); Name/LicenseClass null gelirse .Trim() 500 fırlatıyordu.
        var name = request.Name?.Trim() ?? string.Empty;
        var licenseClass = request.LicenseClass?.Trim().ToUpperInvariant() ?? string.Empty;
        if (name.Length is < 3 or > 150) return BadRequest(new { message = "Sınıf adı 3-150 karakter olmalıdır." });
        if (licenseClass.Length is < 1 or > 20) return BadRequest(new { message = "Ehliyet sınıfı zorunludur." });
        if (request.Capacity is < 1 or > 100) return BadRequest(new { message = "Kapasite 1-100 kişi arasında olmalıdır." });
        if (request.EndsAtUtc <= request.StartsAtUtc) return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden sonra olmalıdır." });
        if (request.InstructorStaffId == Guid.Empty) return BadRequest(new { message = "Lütfen bir öğretmen seçin." });
        if (!await db.Staff.AnyAsync(x => x.Id == request.InstructorStaffId, ct)) return BadRequest(new { message = "Seçilen öğretmen bulunamadı; listeyi yenileyin." });

        var entity = new DrivingTheoryClass
        {
            Name = name, LicenseClass = licenseClass, InstructorStaffId = request.InstructorStaffId,
            Capacity = request.Capacity, StartsAtUtc = request.StartsAtUtc, EndsAtUtc = request.EndsAtUtc, Room = request.Room?.Trim() ?? string.Empty,
        };
        db.DrivingTheoryClasses.Add(entity); await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Teorik sınıf oluşturuldu", AuditCategory, nameof(DrivingTheoryClass), entity.Id.ToString(), entity.Name, null, entity, ct);
        return Ok(new { entity.Id });
    }

    [HttpPost("theory/classes/{id:guid}/students")]
    [RequireDrivingPermission(DrivingPermissions.TheoryManage)]
    public async Task<IActionResult> EnrollStudents(Guid id, [FromBody] EnrollTheoryStudentsRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var group = await db.DrivingTheoryClasses.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (group is null) return NotFound(new { message = "Teorik sınıf bulunamadı." });
        var distinct = request.StudentProfileIds.Distinct().ToList();
        var existing = await db.DrivingTheoryEnrollments.Where(x => x.TheoryClassId == id).Select(x => x.StudentDrivingProfileId).ToListAsync(ct);
        var additions = distinct.Except(existing).ToList();
        if (additions.Count == 0) return BadRequest(new { message = "Eklenecek yeni kursiyer yok; seçilenler zaten bu sınıfta." });
        if (existing.Count + additions.Count > group.Capacity) return Conflict(new { message = $"Sınıf kapasitesi aşılamaz ({group.Capacity} kişilik). Boş kontenjan: {Math.Max(0, group.Capacity - existing.Count)}." });

        var students = await db.StudentDrivingProfiles.Where(x => additions.Contains(x.Id)).ToListAsync(ct);
        var names = await db.Students.AsNoTracking().Where(s => students.Select(p => p.StudentId).Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        string NameOf(StudentDrivingProfile p) => names.TryGetValue(p.StudentId, out var n) && !string.IsNullOrWhiteSpace(n) ? n : "Kursiyer";

        // Her kursiyer için ayrı, anlaşılır gerekçe döneriz; "biri hatalı" gibi genel mesaj vermeyiz.
        var problems = new List<string>();
        var missingIds = additions.Where(pid => students.All(p => p.Id != pid)).ToList();
        if (missingIds.Count > 0) problems.Add($"{missingIds.Count} kursiyer bulunamadı (listeyi yenileyin).");
        foreach (var p in students)
        {
            if (!p.LicenseClass.Equals(group.LicenseClass, StringComparison.OrdinalIgnoreCase))
                problems.Add($"{NameOf(p)}: ehliyet sınıfı ({p.LicenseClass}) sınıfın sınıfı ({group.LicenseClass}) ile uyuşmuyor.");
            else if (!DrivingStudentStatuses.TheoryEnrollable.Contains(p.Status))
                problems.Add($"{NameOf(p)}: durumu ({DrivingStudentStatusLabels.Of(p.Status)}) teorik sınıfa atamaya uygun değil.");
        }
        if (problems.Count > 0) return BadRequest(new { message = string.Join(" ", problems.Distinct().Take(6)) });

        db.DrivingTheoryEnrollments.AddRange(additions.Select(studentId => new DrivingTheoryEnrollment { TheoryClassId = id, StudentDrivingProfileId = studentId }));
        // Teoriye başlamamış (yeni kayıt/evrak bekleyen/aktif) kursiyerler teorik eğitime alınır.
        foreach (var student in students.Where(x => x.Status is DrivingStudentStatus.PreRegistered or DrivingStudentStatus.DocumentsPending or DrivingStudentStatus.Active))
            student.Status = DrivingStudentStatus.TheoryOngoing;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Kursiyerler teorik sınıfa atandı", AuditCategory, nameof(DrivingTheoryClass), id.ToString(),
            $"{group.Name}: {additions.Count} kursiyer eklendi.", null, new { classId = id, enrolled = additions.Count }, ct);
        return Ok(new { enrolled = additions.Count, total = existing.Count + additions.Count });
    }

    [HttpPost("theory/sessions")]
    [RequireDrivingPermission(DrivingPermissions.TheoryManage)]
    public async Task<IActionResult> CreateTheorySession([FromBody] SaveTheorySessionRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var group = await db.DrivingTheoryClasses.SingleOrDefaultAsync(x => x.Id == request.TheoryClassId, ct);
        if (group is null) return BadRequest(new { message = "Teorik sınıf bulunamadı." });
        if (request.EndsAtUtc <= request.StartsAtUtc || request.Subject.Trim().Length < 2 || request.Topic.Trim().Length < 2)
            return BadRequest(new { message = "Ders konusu veya tarih aralığı geçersiz." });
        if (request.StartsAtUtc < group.StartsAtUtc || request.EndsAtUtc > group.EndsAtUtc) return BadRequest(new { message = "Ders, teorik sınıfın tarih aralığı içinde olmalıdır." });
        var instructorId = request.InstructorStaffId ?? group.InstructorStaffId;
        var clash = await db.DrivingTheorySessions.AnyAsync(x => x.InstructorStaffId == instructorId && x.Status == DrivingTheorySessionStatus.Planned && x.StartsAtUtc < request.EndsAtUtc && x.EndsAtUtc > request.StartsAtUtc, ct);
        if (clash) return Conflict(new { message = "Öğretmenin bu saatte başka teorik dersi var." });
        var entity = new DrivingTheorySession { TheoryClassId = group.Id, InstructorStaffId = instructorId, Subject = request.Subject.Trim(), Topic = request.Topic.Trim(), StartsAtUtc = request.StartsAtUtc, EndsAtUtc = request.EndsAtUtc, Room = request.Room?.Trim() ?? group.Room };
        db.DrivingTheorySessions.Add(entity); await db.SaveChangesAsync(ct);
        return Ok(new { entity.Id });
    }

    [HttpGet("theory/sessions/{id:guid}/attendance")]
    [RequireDrivingPermission(DrivingPermissions.TheoryView, DrivingPermissions.TheoryAttendance)]
    public async Task<IActionResult> GetAttendance(Guid id, CancellationToken ct)
    {
        var session = await db.DrivingTheorySessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (session is null) return NotFound();
        if (User.IsInRole("Teacher") && await CurrentStaffIdAsync(ct) != session.InstructorStaffId) return Forbid();
        var rows = await db.DrivingTheoryEnrollments.AsNoTracking().Where(x => x.TheoryClassId == session.TheoryClassId)
            .Join(db.StudentDrivingProfiles.AsNoTracking(), x => x.StudentDrivingProfileId, x => x.Id, (enrollment, profile) => new { enrollment.StudentDrivingProfileId, profile.StudentId })
            .Join(db.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (x, student) => new { x.StudentDrivingProfileId, studentName = student.FullName })
            .GroupJoin(db.DrivingTheoryAttendances.AsNoTracking().Where(x => x.TheorySessionId == id), x => x.StudentDrivingProfileId, x => x.StudentDrivingProfileId, (student, records) => new { student, attendance = records.FirstOrDefault() })
            .Select(x => new { x.student.StudentDrivingProfileId, x.student.studentName, status = x.attendance == null ? "Present" : x.attendance.Status.ToString(), note = x.attendance == null ? "" : x.attendance.Note })
            .OrderBy(x => x.studentName).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPut("theory/sessions/{id:guid}/attendance")]
    [RequireDrivingPermission(DrivingPermissions.TheoryAttendance)]
    public async Task<IActionResult> SaveAttendance(Guid id, [FromBody] SaveTheoryAttendanceRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var session = await db.DrivingTheorySessions.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (session is null) return NotFound(new { message = "Teorik ders bulunamadı." });
        if (User.IsInRole("Teacher") && await CurrentStaffIdAsync(ct) != session.InstructorStaffId) return Forbid();
        var enrolled = (await db.DrivingTheoryEnrollments.Where(x => x.TheoryClassId == session.TheoryClassId).Select(x => x.StudentDrivingProfileId).ToListAsync(ct)).ToHashSet();
        if (request.Items.Any(x => !enrolled.Contains(x.StudentProfileId) || x.ParsedStatus is null)) return BadRequest(new { message = "Yoklama listesinde geçersiz öğrenci veya durum var." });
        var ids = request.Items.Select(x => x.StudentProfileId).ToList();
        var existing = await db.DrivingTheoryAttendances.Where(x => x.TheorySessionId == id && ids.Contains(x.StudentDrivingProfileId)).ToDictionaryAsync(x => x.StudentDrivingProfileId, ct);
        foreach (var item in request.Items)
        {
            if (!existing.TryGetValue(item.StudentProfileId, out var attendance))
            {
                attendance = new DrivingTheoryAttendance { TheorySessionId = id, StudentDrivingProfileId = item.StudentProfileId };
                db.DrivingTheoryAttendances.Add(attendance);
            }
            attendance.Status = item.ParsedStatus!.Value; attendance.Note = item.Note?.Trim() ?? string.Empty; attendance.MarkedByUserId = CurrentUserId(); attendance.MarkedAtUtc = DateTime.UtcNow;
        }
        session.Status = DrivingTheorySessionStatus.Completed;
        await db.SaveChangesAsync(ct);
        return Ok(new { saved = request.Items.Count, status = session.Status.ToString() });
    }

    /// <summary>Resmî MTSK teorik müfredatı — sınıf/plan ekranı bunu referans gösterir.</summary>
    [HttpGet("theory/curriculum")]
    [RequireDrivingPermission(DrivingPermissions.TheoryView)]
    public IActionResult GetCurriculum()
        => Ok(new
        {
            lessonMinutes = DrivingCurriculum.TheoryLessonMinutes,
            totalRequiredHours = DrivingCurriculum.TotalRequiredHours,
            subjects = DrivingCurriculum.TheorySubjects.Select(x => new { x.Key, x.Label, x.RequiredHours }),
        });

    /// <summary>
    /// Sınıfın mevzuat uyumu: konu bazında planlanan ders saati resmî müfredatla
    /// karşılaştırılır; her kursiyer için devam oranı hesaplanır ve asgari devam
    /// oranının altına düşen "dönem yanma riski" olarak işaretlenir.
    /// </summary>
    [HttpGet("theory/classes/{id:guid}/compliance")]
    [RequireDrivingPermission(DrivingPermissions.TheoryView)]
    public async Task<IActionResult> GetClassCompliance(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var theoryClass = await db.DrivingTheoryClasses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (theoryClass is null) return NotFound(new { message = "Sınıf bulunamadı." });

        var settings = await db.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();

        // ─── Konu bazında planlanan saat vs resmî müfredat ────────────────────
        var sessions = await db.DrivingTheorySessions.AsNoTracking()
            .Where(x => x.TheoryClassId == id && x.Status != DrivingTheorySessionStatus.Cancelled)
            .Select(x => new { x.Id, x.Subject, Minutes = (int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes })
            .ToListAsync(ct);

        var plannedBySubject = new Dictionary<string, int>();
        var unmatchedMinutes = 0;
        foreach (var session in sessions)
        {
            var subject = DrivingCurriculum.MatchSubject(session.Subject);
            if (subject is null) { unmatchedMinutes += session.Minutes; continue; }
            plannedBySubject[subject.Key] = plannedBySubject.GetValueOrDefault(subject.Key) + session.Minutes;
        }

        var curriculum = DrivingCurriculum.TheorySubjects.Select(subject =>
        {
            var plannedMinutes = plannedBySubject.GetValueOrDefault(subject.Key);
            var plannedHours = DrivingCurriculum.MinutesToLessonHours(plannedMinutes);
            return new
            {
                subject.Key,
                subject.Label,
                subject.RequiredHours,
                plannedMinutes,
                plannedHours,
                complete = plannedHours >= subject.RequiredHours,
                missingHours = Math.Max(0, subject.RequiredHours - plannedHours),
            };
        }).ToList();

        // ─── Kursiyer bazında devam / dönem yanma riski ───────────────────────
        // Hesap, mezuniyet kontrol listesindekiyle AYNI kuralları kullanır
        // (mazeretli devamsızlık politikası dahil) — iki ekran çelişmesin.
        var students = await db.DrivingTheoryEnrollments.AsNoTracking()
            .Where(x => x.TheoryClassId == id)
            .Join(db.StudentDrivingProfiles.AsNoTracking(), e => e.StudentDrivingProfileId, p => p.Id, (e, p) => new { p.Id, p.StudentId, p.StudentNumber })
            .Join(db.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { x.Id, x.StudentNumber, s.FullName })
            .ToListAsync(ct);

        var sessionIds = sessions.Select(x => x.Id).ToList();
        var attendance = await db.DrivingTheoryAttendances.AsNoTracking()
            .Where(x => sessionIds.Contains(x.TheorySessionId))
            .Join(db.DrivingTheorySessions.AsNoTracking(), a => a.TheorySessionId, s => s.Id,
                (a, s) => new { a.StudentDrivingProfileId, a.Status, Minutes = (int)(s.EndsAtUtc - s.StartsAtUtc).TotalMinutes })
            .ToListAsync(ct);
        var attendanceByStudent = attendance.ToLookup(x => x.StudentDrivingProfileId);

        var studentRows = students.Select(student =>
        {
            var records = attendanceByStudent[student.Id].ToList();
            var scheduled = records.Sum(x => x.Minutes);
            var attended = records.Where(x => x.Status is DrivingTheoryAttendanceStatus.Present or DrivingTheoryAttendanceStatus.Late).Sum(x => x.Minutes);
            var excused = records.Where(x => x.Status == DrivingTheoryAttendanceStatus.Excused).Sum(x => x.Minutes);
            var denominator = settings.ExcusedAbsencePolicy == DrivingExcusedAbsencePolicy.ExcludeFromCalculation ? Math.Max(0, scheduled - excused) : scheduled;
            if (settings.ExcusedAbsencePolicy == DrivingExcusedAbsencePolicy.CountsAsPresent) attended += excused;
            var percent = denominator == 0 ? 100m : Math.Round(attended * 100m / denominator, 2);
            return new
            {
                profileId = student.Id,
                student.StudentNumber,
                student.FullName,
                scheduledMinutes = scheduled,
                attendedMinutes = attended,
                attendancePercent = percent,
                // Asgari devam sağlanamazsa aday dönemi kaybeder (kurs tekrarı).
                atRisk = denominator > 0 && percent < settings.MinimumTheoryAttendancePercent,
            };
        }).OrderBy(x => x.attendancePercent).ToList();

        return Ok(new
        {
            classId = theoryClass.Id,
            className = theoryClass.Name,
            requiredTotalHours = DrivingCurriculum.TotalRequiredHours,
            lessonMinutes = DrivingCurriculum.TheoryLessonMinutes,
            minimumAttendancePercent = settings.MinimumTheoryAttendancePercent,
            excusedAbsencePolicy = settings.ExcusedAbsencePolicy.ToString(),
            curriculum,
            curriculumComplete = curriculum.All(x => x.complete),
            unmatchedMinutes,
            students = studentRows,
            atRiskCount = studentRows.Count(x => x.atRisk),
        });
    }

    /// <summary>
    /// Resmî müfredattan ders programı üretir: konular sırayla (Trafik 16 → İlk
    /// Yardım 8 → Araç Tekniği 6 → Adab 4), seçilen günlerde ve saatte, günde en
    /// fazla verilen ders saati kadar. Var olan oturumların kapattığı saatler
    /// düşülür — ikinci çalıştırma mükerrer ders üretmez.
    /// </summary>
    [HttpPost("theory/classes/{id:guid}/generate-schedule")]
    [RequireDrivingPermission(DrivingPermissions.TheoryManage)]
    public async Task<IActionResult> GenerateSchedule(Guid id, [FromBody] GenerateScheduleRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var theoryClass = await db.DrivingTheoryClasses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (theoryClass is null) return NotFound(new { message = "Sınıf bulunamadı." });
        if (request.DaysOfWeek is not { Count: > 0 } || request.DaysOfWeek.Any(x => x is < 0 or > 6))
            return BadRequest(new { message = "En az bir geçerli gün seçilmelidir (0=Pazar…6=Cumartesi)." });
        if (request.LessonsPerDay is < 1 or > 8) return BadRequest(new { message = "Günlük ders saati 1-8 arasında olmalıdır." });
        if (request.StartHourLocal is < 0 or > 23 || request.StartMinuteLocal is < 0 or > 59)
            return BadRequest(new { message = "Başlangıç saati geçersiz." });
        if (request.StartDate < DateTime.UtcNow.Date.AddDays(-1) || request.StartDate > DateTime.UtcNow.AddYears(1))
            return BadRequest(new { message = "Başlangıç tarihi makul aralıkta olmalıdır." });

        // Var olan oturumların kapattığı ders saatleri konu bazında düşülür.
        var existing = await db.DrivingTheorySessions.AsNoTracking()
            .Where(x => x.TheoryClassId == id && x.Status != DrivingTheorySessionStatus.Cancelled)
            .Select(x => new { x.Subject, Minutes = (int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes })
            .ToListAsync(ct);
        var remaining = DrivingCurriculum.TheorySubjects.ToDictionary(
            x => x.Key,
            x => x.RequiredHours - DrivingCurriculum.MinutesToLessonHours(
                existing.Where(e => DrivingCurriculum.MatchSubject(e.Subject)?.Key == x.Key).Sum(e => e.Minutes)));
        if (remaining.Values.All(x => x <= 0))
            return Conflict(new { message = "Müfredatın tüm konuları zaten planlanmış." });

        var allowedDays = request.DaysOfWeek.Select(x => (DayOfWeek)x).ToHashSet();
        var sessions = new List<DrivingTheorySession>();
        var cursor = request.StartDate.Date;
        var safety = 0;

        foreach (var subject in DrivingCurriculum.TheorySubjects)
        {
            var hoursLeft = Math.Max(0, remaining[subject.Key]);
            while (hoursLeft > 0 && safety < 366)
            {
                while (!allowedDays.Contains(cursor.DayOfWeek) && safety < 366) { cursor = cursor.AddDays(1); safety++; }
                if (safety >= 366) break;

                var hoursToday = Math.Min(hoursLeft, request.LessonsPerDay);
                // Yerel saat → UTC (TR sabit +3).
                var startsAtUtc = new DateTime(cursor.Year, cursor.Month, cursor.Day, request.StartHourLocal, request.StartMinuteLocal, 0, DateTimeKind.Utc).AddHours(-3);
                sessions.Add(new DrivingTheorySession
                {
                    TheoryClassId = theoryClass.Id,
                    InstructorStaffId = theoryClass.InstructorStaffId,
                    Subject = subject.Label,
                    Topic = $"{subject.Label} — {subject.RequiredHours - hoursLeft + 1}-{subject.RequiredHours - hoursLeft + hoursToday}. ders saati",
                    StartsAtUtc = startsAtUtc,
                    EndsAtUtc = startsAtUtc.AddMinutes(hoursToday * DrivingCurriculum.TheoryLessonMinutes),
                    Room = theoryClass.Room,
                });
                hoursLeft -= hoursToday;
                cursor = cursor.AddDays(1);
                safety++;
            }
        }
        if (sessions.Count == 0) return Conflict(new { message = "Program üretilemedi — gün/tarih seçimini kontrol edin." });

        db.DrivingTheorySessions.AddRange(sessions);
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("Ders programı üretildi", AuditCategory, nameof(DrivingTheoryClass), theoryClass.Id.ToString(),
            $"{theoryClass.Name}: müfredattan {sessions.Count} oturum üretildi ({sessions[0].StartsAtUtc.AddHours(3):dd.MM.yyyy} → {sessions[^1].StartsAtUtc.AddHours(3):dd.MM.yyyy}).",
            null, new { sessionCount = sessions.Count }, ct);

        return Ok(new
        {
            created = sessions.Count,
            firstAtUtc = sessions[0].StartsAtUtc,
            lastAtUtc = sessions[^1].StartsAtUtc,
        });
    }

    /// <summary>Sınıfın ders programı çizelgesi — il müdürlüğüne sunulan biçimde PDF.</summary>
    [HttpGet("theory/classes/{id:guid}/schedule")]
    [RequireDrivingPermission(DrivingPermissions.TheoryView)]
    public async Task<IActionResult> GetClassSchedule(Guid id, [FromQuery] string? format, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var theoryClass = await db.DrivingTheoryClasses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (theoryClass is null) return NotFound(new { message = "Sınıf bulunamadı." });

        var sessions = await db.DrivingTheorySessions.AsNoTracking()
            .Where(x => x.TheoryClassId == id && x.Status != DrivingTheorySessionStatus.Cancelled)
            .Join(db.Staff.AsNoTracking(), s => s.InstructorStaffId, st => st.Id, (s, st) => new { s.Subject, s.Topic, s.StartsAtUtc, s.EndsAtUtc, s.Room, InstructorName = st.FullName })
            .OrderBy(x => x.StartsAtUtc)
            .ToListAsync(ct);

        var rows = sessions.Select((x, index) => (IReadOnlyList<string>)
        [
            (index + 1).ToString(),
            x.StartsAtUtc.AddHours(3).ToString("dd.MM.yyyy dddd", new System.Globalization.CultureInfo("tr-TR")),
            $"{x.StartsAtUtc.AddHours(3):HH:mm}-{x.EndsAtUtc.AddHours(3):HH:mm}",
            x.Subject,
            x.Topic,
            DrivingCurriculum.MinutesToLessonHours((int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes).ToString(),
            x.InstructorName,
            x.Room,
        ]).ToList();

        var institutionName = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == db.CurrentTenantId).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? "Sürücü Kursu";
        var totalHours = sessions.Sum(x => DrivingCurriculum.MinutesToLessonHours((int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes));

        var document = new DrivingReportDocument(
            institutionName,
            $"{theoryClass.Name} — Teorik Ders Programı",
            $"Sertifika sınıfı: {theoryClass.LicenseClass} • Resmî müfredat: {DrivingCurriculum.TotalRequiredHours} ders saati × {DrivingCurriculum.TheoryLessonMinutes} dk",
            theoryClass.StartsAtUtc, theoryClass.EndsAtUtc,
            [
                new DrivingReportColumn("Sıra", Numeric: true), new DrivingReportColumn("Tarih"), new DrivingReportColumn("Saat"),
                new DrivingReportColumn("Konu"), new DrivingReportColumn("İşlenecek"), new DrivingReportColumn("Ders Saati", Numeric: true),
                new DrivingReportColumn("Öğretmen"), new DrivingReportColumn("Derslik"),
            ],
            rows,
            [
                ("Toplam oturum", sessions.Count.ToString()),
                ("Toplam ders saati", $"{totalHours}/{DrivingCurriculum.TotalRequiredHours}"),
            ]);

        if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            return File(pdf.Generate(document), "application/pdf", $"ders-programi-{theoryClass.Name}.pdf");

        return Ok(new
        {
            columns = document.Columns.Select(x => new { header = x.Header, numeric = x.Numeric }),
            rows = document.Rows,
            summary = document.Summary.Select(x => new { label = x.Label, value = x.Value }),
        });
    }

    [HttpPost("exams/sessions")]
    [RequireDrivingPermission(DrivingPermissions.ExamManage)]
    public async Task<IActionResult> CreateExamSession([FromBody] SaveExamSessionRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.ParsedType is null || request.EndsAtUtc <= request.StartsAtUtc || request.Capacity is < 1 or > 100 || request.Title.Trim().Length < 3 || request.Location.Trim().Length < 2)
            return BadRequest(new { message = "Sınav türü, tarih, kapasite veya konum geçersiz." });
        if (request.Commission.Count is < 1 or > 10 || request.Commission.Any(x => x.FullName.Trim().Length < 3 || x.Role.Trim().Length < 2))
            return BadRequest(new { message = "En az bir geçerli komisyon üyesi zorunludur." });
        var entity = new DrivingExamSession { ExamType = request.ParsedType.Value, Title = request.Title.Trim(), StartsAtUtc = request.StartsAtUtc, EndsAtUtc = request.EndsAtUtc, Location = request.Location.Trim(), Capacity = request.Capacity };
        db.DrivingExamSessions.Add(entity);
        db.DrivingExamCommissionMembers.AddRange(request.Commission.Select(x => new DrivingExamCommissionMember { ExamSessionId = entity.Id, FullName = x.FullName.Trim(), Role = x.Role.Trim(), Organization = x.Organization?.Trim() ?? string.Empty }));
        await db.SaveChangesAsync(ct);
        return Ok(new { entity.Id });
    }

    /// <summary>
    /// Kursiyerlerin teorik ve direksiyon sınav haklarını, puanlarını ve tarihlerini
    /// tek ekranda gösterir. İptal edilen kayıtlar hak kullanımına dahil edilmez.
    /// </summary>
    [HttpGet("exams/rights")]
    [RequireDrivingPermission(DrivingPermissions.ExamView)]
    public async Task<IActionResult> GetExamRights(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var students = await db.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Status != DrivingStudentStatus.Cancelled)
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (profile, student) => new
            {
                profileId = profile.Id,
                profile.StudentNumber,
                student.FullName,
                profile.LicenseClass,
                photoUrl = profile.LivePhotoUrl != "" ? profile.LivePhotoUrl : profile.PhotoUrl,
                status = profile.Status.ToString(),
            })
            .OrderBy(x => x.FullName)
            .ToListAsync(ct);

        var profileIds = students.Select(x => x.profileId).ToList();
        var attempts = await db.DrivingExamCandidates.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(db.DrivingExamSessions.AsNoTracking(), c => c.ExamSessionId, s => s.Id, (candidate, session) => new
            {
                id = candidate.Id,
                candidate.StudentDrivingProfileId,
                examType = session.ExamType.ToString(),
                candidate.AttemptNo,
                candidate.Score,
                candidate.ResultNote,
                status = candidate.Status.ToString(),
                examDateUtc = session.StartsAtUtc,
                session.Title,
            })
            .OrderByDescending(x => x.examDateUtc)
            .ToListAsync(ct);

        var byStudent = attempts.ToLookup(x => x.StudentDrivingProfileId);
        object Rights(Guid profileId, DrivingExamType type)
        {
            var typeName = type.ToString();
            var own = byStudent[profileId].Where(x => x.examType == typeName).OrderByDescending(x => x.examDateUtc).ToList();
            var manualAttempt = own
                .Where(x => x.ResultNote == ManualExamRightNote)
                .Select(x => x.AttemptNo)
                .DefaultIfEmpty(0)
                .Max();
            var used = Math.Max(own.Count, manualAttempt);
            return new
            {
                used,
                max = DrivingExamRules.MaxAttempts,
                remaining = DrivingExamRules.RemainingAttempts(used),
                lastScore = own.FirstOrDefault()?.Score,
                lastExamDateUtc = own.FirstOrDefault()?.examDateUtc,
            };
        }

        return Ok(new
        {
            students = students.Select(x => new
            {
                x.profileId,
                x.StudentNumber,
                x.FullName,
                x.photoUrl,
                x.LicenseClass,
                x.status,
                theory = Rights(x.profileId, DrivingExamType.TheoryEExam),
                practice = Rights(x.profileId, DrivingExamType.DrivingPractice),
            }),
            attempts,
        });
    }

    /// <summary>
    /// Sınav hakkı ekranından doğrudan sonuç girer veya mevcut kaydı düzenler.
    /// Tarih her kursiyer kaydına özel tutulabilsin diye paylaşılan bir oturum
    /// düzenleniyorsa aday, tek kişilik manuel oturuma güvenle ayrılır.
    /// </summary>
    [HttpPut("exams/rights")]
    [RequireDrivingPermission(DrivingPermissions.ExamResultEnter)]
    public async Task<IActionResult> SaveExamRight([FromBody] SaveExamRightRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.ParsedType is null || request.AttemptNo is < 1 or > DrivingExamRules.MaxAttempts)
            return BadRequest(new { message = $"Sınav türü ve giriş sırası geçerli olmalıdır (1-{DrivingExamRules.MaxAttempts})." });
        if (request.Score is < 0 or > 100)
            return BadRequest(new { message = "Sınav puanı 0-100 arasında olmalıdır." });
        if (request.ExamDateUtc < DateTime.UtcNow.AddYears(-10) || request.ExamDateUtc > DateTime.UtcNow.AddYears(2))
            return BadRequest(new { message = "Sınav tarihi geçersiz." });

        var student = await db.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == request.StudentProfileId, ct);
        if (student is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        var type = request.ParsedType.Value;
        DrivingExamCandidate candidate;
        DrivingExamSession session;
        if (request.CandidateId is Guid candidateId)
        {
            var existingCandidate = await db.DrivingExamCandidates.SingleOrDefaultAsync(x => x.Id == candidateId, ct);
            if (existingCandidate is null) return NotFound(new { message = "Sınav kaydı bulunamadı." });
            candidate = existingCandidate;
            if (candidate.StudentDrivingProfileId != student.Id)
                return BadRequest(new { message = "Sınav kaydı kursiyerle eşleşmiyor." });
            session = await db.DrivingExamSessions.SingleAsync(x => x.Id == candidate.ExamSessionId, ct);

            var duplicate = await db.DrivingExamCandidates.AsNoTracking()
                .Where(x => x.Id != candidate.Id && x.StudentDrivingProfileId == student.Id && x.AttemptNo == request.AttemptNo && x.Status != DrivingExamCandidateStatus.Cancelled)
                .Join(db.DrivingExamSessions.AsNoTracking().Where(x => x.ExamType == type), x => x.ExamSessionId, x => x.Id, (_, _) => true)
                .AnyAsync(ct);
            if (duplicate) return Conflict(new { message = "Bu sınav türü ve giriş sırası için zaten kayıt var." });

            var sharedSession = await db.DrivingExamCandidates.CountAsync(x => x.ExamSessionId == session.Id, ct) > 1;
            if (sharedSession && (session.ExamType != type || session.StartsAtUtc != request.ExamDateUtc))
            {
                session = CreateManualExamSession(type, request.ExamDateUtc, await StudentNameAsync(student.StudentId, ct));
                db.DrivingExamSessions.Add(session);
                candidate.ExamSessionId = session.Id;
            }
            else
            {
                session.ExamType = type;
                session.StartsAtUtc = request.ExamDateUtc;
                session.EndsAtUtc = request.ExamDateUtc.AddHours(1);
            }
        }
        else
        {
            var duplicate = await db.DrivingExamCandidates.AsNoTracking()
                .Where(x => x.StudentDrivingProfileId == student.Id && x.AttemptNo == request.AttemptNo && x.Status != DrivingExamCandidateStatus.Cancelled)
                .Join(db.DrivingExamSessions.AsNoTracking().Where(x => x.ExamType == type), x => x.ExamSessionId, x => x.Id, (_, _) => true)
                .AnyAsync(ct);
            if (duplicate) return Conflict(new { message = "Bu sınav türü ve giriş sırası için zaten kayıt var." });

            session = CreateManualExamSession(type, request.ExamDateUtc, await StudentNameAsync(student.StudentId, ct));
            candidate = new DrivingExamCandidate
            {
                ExamSessionId = session.Id,
                StudentDrivingProfileId = student.Id,
            };
            db.DrivingExamSessions.Add(session);
            db.DrivingExamCandidates.Add(candidate);
        }

        var passed = request.Passed;
        candidate.AttemptNo = request.AttemptNo;
        candidate.Score = request.Score;
        candidate.Status = passed ? DrivingExamCandidateStatus.Passed : DrivingExamCandidateStatus.Failed;
        candidate.FailureReason = passed ? string.Empty : "Sınav puanı geçme sınırının altında";
        candidate.ResultNote = ManualExamRightNote;
        candidate.ResultEnteredAtUtc = DateTime.UtcNow;
        candidate.ResultEnteredByUserId = CurrentUserId();
        student.Status = DrivingExamRules.StudentStatusAfterResult(type, passed);
        await db.SaveChangesAsync(ct);

        await audit.LogChangeAsync(
            request.CandidateId.HasValue ? "Sınav hakkı kaydı güncellendi" : "Sınav hakkı kaydı eklendi",
            AuditCategory, nameof(DrivingExamCandidate), candidate.Id.ToString(),
            $"{session.Title}: {candidate.AttemptNo}. giriş, {candidate.Score} puan, {session.StartsAtUtc:dd.MM.yyyy}.",
            null, new { candidate.Id, candidate.StudentDrivingProfileId, examType = type.ToString(), candidate.AttemptNo, candidate.Score, session.StartsAtUtc }, ct);

        return Ok(new { candidate.Id, examType = type.ToString(), candidate.AttemptNo, candidate.Score, examDateUtc = session.StartsAtUtc, status = candidate.Status.ToString() });
    }

    private static DrivingExamSession CreateManualExamSession(DrivingExamType type, DateTime examDateUtc, string studentName)
        => new()
        {
            ExamType = type,
            Title = $"{(type == DrivingExamType.TheoryEExam ? "Teorik" : "Direksiyon")} Sınavı — {studentName}",
            StartsAtUtc = examDateUtc,
            EndsAtUtc = examDateUtc.AddHours(1),
            Location = "Manuel kayıt",
            Capacity = 1,
            Status = DrivingExamSessionStatus.Completed,
        };

    [HttpPost("exams/sessions/{id:guid}/candidates")]
    [RequireDrivingPermission(DrivingPermissions.ExamManage)]
    public async Task<IActionResult> AddExamCandidates(Guid id, [FromBody] AddExamCandidatesRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.FeeAmount is < 0 or > 1_000_000) return BadRequest(new { message = "Sınav ücreti geçersiz." });
        var exam = await db.DrivingExamSessions.SingleOrDefaultAsync(x => x.Id == id && x.Status == DrivingExamSessionStatus.Planned, ct);
        if (exam is null) return NotFound(new { message = "Planlanmış sınav bulunamadı." });
        var ids = request.StudentProfileIds.Distinct().ToList();
        var existingCount = await db.DrivingExamCandidates.CountAsync(x => x.ExamSessionId == id, ct);
        if (existingCount + ids.Count > exam.Capacity) return Conflict(new { message = "Sınav kapasitesi aşılamaz." });
        var students = await db.StudentDrivingProfiles.Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        if (students.Count != ids.Count) return BadRequest(new { message = "Kursiyerlerden biri bulunamadı." });
        if (request.FeeAmount > 0 && students.Any(x => x.EnrollmentContractId == null)) return BadRequest(new { message = "Sınav ücreti için tüm adayların aktif sözleşmesi olmalıdır." });
        foreach (var student in students)
        {
            if (exam.ExamType == DrivingExamType.TheoryEExam && !await db.DrivingTheoryEnrollments.AnyAsync(x => x.StudentDrivingProfileId == student.Id, ct))
                return BadRequest(new { message = "E-sınava yalnızca teorik sınıfa atanmış öğrenciler eklenebilir." });
            if (exam.ExamType == DrivingExamType.DrivingPractice)
            {
                var theoryPassed = await db.DrivingExamCandidates.AsNoTracking().Where(x => x.StudentDrivingProfileId == student.Id && x.Status == DrivingExamCandidateStatus.Passed)
                    .Join(db.DrivingExamSessions.AsNoTracking().Where(x => x.ExamType == DrivingExamType.TheoryEExam), x => x.ExamSessionId, x => x.Id, (_, _) => true).AnyAsync(ct);
                if (!theoryPassed) return BadRequest(new { message = "Direksiyon sınavı için öğrencinin e-sınavı geçmiş olması gerekir." });
            }

            // Mevzuat: her sınav türünde en fazla 4 hak. İptal edilen deneme hak yakmaz.
            var usedAttempts = await UsedAttemptsAsync(student.Id, exam.ExamType, ct);
            if (DrivingExamRules.IsOutOfAttempts(usedAttempts))
            {
                var studentName = await db.Students.AsNoTracking().Where(x => x.Id == student.StudentId).Select(x => x.FullName).SingleAsync(ct);
                return Conflict(new { message = $"{studentName}: {DrivingExamRules.OutOfAttemptsMessage(exam.ExamType)}" });
            }
        }
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        foreach (var student in students)
        {
            if (await db.DrivingExamCandidates.AnyAsync(x => x.ExamSessionId == id && x.StudentDrivingProfileId == student.Id, ct)) continue;
            var attempt = (await db.DrivingExamCandidates.Where(x => x.StudentDrivingProfileId == student.Id)
                .Join(db.DrivingExamSessions.Where(x => x.ExamType == exam.ExamType), x => x.ExamSessionId, x => x.Id, (candidate, _) => (int?)candidate.AttemptNo).MaxAsync(ct) ?? 0) + 1;
            var candidate = new DrivingExamCandidate { ExamSessionId = id, StudentDrivingProfileId = student.Id, AttemptNo = attempt };
            if (request.FeeAmount > 0) candidate.DrivingChargeId = await CreateExamChargeAsync(student, request.FeeAmount, exam.Title, ct);
            db.DrivingExamCandidates.Add(candidate); student.Status = DrivingStudentStatus.ExamPending;
            await notifier.NotifyStudentAsync(student.Id, "Sınavınız planlandı", $"{exam.Title}: {exam.StartsAtUtc:dd.MM.yyyy HH:mm}, {exam.Location}.", DrivingNotificationCategories.Exam, dedupeKey: $"exam-planned:{candidate.Id}", relatedEntityType: nameof(DrivingExamCandidate), relatedEntityId: candidate.Id.ToString(), cancellationToken: ct);
        }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return Ok(new { added = ids.Count });
    }

    [HttpPost("exams/candidates/{id:guid}/result")]
    [RequireDrivingPermission(DrivingPermissions.ExamResultEnter)]
    public async Task<IActionResult> EnterExamResult(Guid id, [FromBody] EnterExamResultRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var candidate = await db.DrivingExamCandidates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (candidate is null) return NotFound(new { message = "Sınav adayı bulunamadı." });
        if (candidate.Status != DrivingExamCandidateStatus.Planned) return Conflict(new { message = "Bu sınav sonucu daha önce kapatılmış." });
        if (request.Score is < 0 or > 100) return BadRequest(new { message = "Puan 0-100 arasında olmalıdır." });
        if (!request.Passed && (request.FailureReason?.Trim().Length ?? 0) < 3) return BadRequest(new { message = "Başarısızlık nedeni zorunludur." });
        var exam = await db.DrivingExamSessions.SingleAsync(x => x.Id == candidate.ExamSessionId, ct);
        var student = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == candidate.StudentDrivingProfileId, ct);

        var outcome = await ApplyExamResultAsync(candidate, exam, student, request.Passed, request.Score, request.FailureReason, request.Note, ct);
        await CompleteExamIfDoneAsync(exam, ct);

        return Ok(new
        {
            status = candidate.Status.ToString(),
            studentStatus = student.Status.ToString(),
            usedAttempts = outcome.UsedAttempts,
            remainingAttempts = DrivingExamRules.RemainingAttempts(outcome.UsedAttempts),
            outOfAttempts = outcome.OutOfAttempts,
            outOfAttemptsMessage = outcome.OutOfAttempts ? DrivingExamRules.OutOfAttemptsMessage(exam.ExamType) : null,
            extraLessonChargeId = outcome.ExtraLessonChargeId,
        });
    }

    /// <summary>
    /// e-Sınav/MEBBİS'ten indirilen sonuç listesinin toplu işlenmesi. Satırlar TC
    /// kimlik numarasıyla adaya eşlenir; sonuç, tekil giriş ile AYNI çekirdekten
    /// geçer — hak sayacı, dönem düşme ve zorunlu ek ders kuralları otomatik işler.
    /// Eşleşmeyen/sonuçlanmış satırlar sessizce atlanmaz, raporlanır.
    /// </summary>
    [HttpPost("exams/sessions/{id:guid}/results/import")]
    [RequireDrivingPermission(DrivingPermissions.ExamResultEnter)]
    public async Task<IActionResult> ImportExamResults(Guid id, [FromBody] ImportExamResultsRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.Rows is not { Count: > 0 and <= 500 }) return BadRequest(new { message = "1-500 arası satır gönderilmelidir." });

        var exam = await db.DrivingExamSessions.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (exam is null) return NotFound(new { message = "Sınav bulunamadı." });

        // Adayların TC eşlemesi: sürücü dosyasındaki kimlik yoksa öğrenci TC'sine düşülür.
        var candidates = await db.DrivingExamCandidates
            .Where(x => x.ExamSessionId == id)
            .Join(db.StudentDrivingProfiles, c => c.StudentDrivingProfileId, p => p.Id, (c, p) => new { Candidate = c, Profile = p })
            .Join(db.Students, x => x.Profile.StudentId, s => s.Id, (x, s) => new { x.Candidate, x.Profile, s.FullName, s.TcNo })
            .ToListAsync(ct);
        static string Digits(string? value) => new((value ?? string.Empty).Where(char.IsDigit).ToArray());
        var byIdentity = candidates
            .Select(x => new { x.Candidate, x.Profile, x.FullName, Identity = Digits(string.IsNullOrWhiteSpace(x.Profile.IdentityNumber) ? x.TcNo : x.Profile.IdentityNumber) })
            .Where(x => x.Identity.Length >= 5)
            .GroupBy(x => x.Identity)
            .ToDictionary(g => g.Key, g => g.First());

        var processed = new List<object>();
        var errors = new List<object>();
        var passedCount = 0;
        var failedCount = 0;

        foreach (var row in request.Rows)
        {
            var identity = Digits(row.IdentityNumber);
            if (identity.Length < 5) { errors.Add(new { row.IdentityNumber, reason = "Geçersiz kimlik numarası." }); continue; }
            if (!byIdentity.TryGetValue(identity, out var match))
            {
                errors.Add(new { row.IdentityNumber, reason = "Bu sınavda bu TC ile kayıtlı aday yok." });
                continue;
            }
            if (match.Candidate.Status != DrivingExamCandidateStatus.Planned)
            {
                errors.Add(new { row.IdentityNumber, name = match.FullName, reason = $"Sonuç zaten girilmiş ({match.Candidate.Status})." });
                continue;
            }
            if (row.Score is < 0 or > 100) { errors.Add(new { row.IdentityNumber, name = match.FullName, reason = "Puan 0-100 arasında olmalıdır." }); continue; }

            var passed = DrivingExamRules.ParseImportedResult(row.Result, row.Score, exam.ExamType);
            if (passed is null)
            {
                errors.Add(new { row.IdentityNumber, name = match.FullName, reason = "Sonuç çıkarılamadı (geçti/kaldı veya puan gerekli)." });
                continue;
            }

            var outcome = await ApplyExamResultAsync(
                match.Candidate, exam, match.Profile,
                passed.Value, row.Score,
                passed.Value ? null : "Sınav başarısız (toplu sonuç aktarımı)", "Toplu içe aktarma", ct);

            if (passed.Value) passedCount++; else failedCount++;
            processed.Add(new
            {
                row.IdentityNumber,
                name = match.FullName,
                passed = passed.Value,
                row.Score,
                outcome.OutOfAttempts,
                remainingAttempts = DrivingExamRules.RemainingAttempts(outcome.UsedAttempts),
            });
        }

        await CompleteExamIfDoneAsync(exam, ct);

        await audit.LogChangeAsync("Sınav sonuçları toplu aktarıldı", AuditCategory, nameof(DrivingExamSession), exam.Id.ToString(),
            $"{exam.Title}: {processed.Count} sonuç işlendi ({passedCount} geçti, {failedCount} kaldı), {errors.Count} satır atlandı.",
            null, new { processedCount = processed.Count, passedCount, failedCount, errorCount = errors.Count }, ct);

        return Ok(new { processedCount = processed.Count, passedCount, failedCount, processed, errors });
    }

    private sealed record ExamResultOutcome(int UsedAttempts, bool OutOfAttempts, Guid? ExtraLessonChargeId);

    /// <summary>
    /// Sonuç işlemenin TEK çekirdeği: tekil giriş ve toplu içe aktarma aynı yoldan
    /// geçer ki hak sayacı, dönem düşme bildirimi ve zorunlu ek ders asla ayrışmasın.
    /// </summary>
    private async Task<ExamResultOutcome> ApplyExamResultAsync(
        DrivingExamCandidate candidate, DrivingExamSession exam, StudentDrivingProfile student,
        bool passed, decimal? score, string? failureReason, string? note, CancellationToken ct)
    {
        candidate.Status = passed ? DrivingExamCandidateStatus.Passed : DrivingExamCandidateStatus.Failed;
        candidate.Score = score;
        candidate.FailureReason = passed ? string.Empty : (failureReason ?? "Sınav başarısız").Trim();
        candidate.ResultNote = note?.Trim() ?? string.Empty;
        candidate.ResultEnteredAtUtc = DateTime.UtcNow;
        candidate.ResultEnteredByUserId = CurrentUserId();
        student.Status = DrivingExamRules.StudentStatusAfterResult(exam.ExamType, passed);
        await db.SaveChangesAsync(ct);

        // ─── Hak takibi + zorunlu ek ders ─────────────────────────────────────
        var usedAttempts = await UsedAttemptsAsync(student.Id, exam.ExamType, ct);
        var outOfAttempts = !passed && DrivingExamRules.IsOutOfAttempts(usedAttempts);
        Guid? extraLessonChargeId = null;

        if (!passed && outOfAttempts)
        {
            // Dönem düştü → kursiyer OTOMATİK PASİFE alınır (askıya), sebebi yazılır.
            // Böylece 4 sınav hakkını doldurup geçemeyen aday listelerden düşer;
            // "Pasif Kayıtlar"da sebebiyle görünür, gerekirse yeniden kayıtla açılır.
            // AutomaticStatusEnabled=false: otomatik durum makinesi bunu geri açmasın.
            if (student.Status is not (DrivingStudentStatus.Suspended or DrivingStudentStatus.Cancelled))
                student.StatusBeforeSuspension = student.Status;
            student.Status = DrivingStudentStatus.Suspended;
            student.AutomaticStatusEnabled = false;
            student.StatusChangeSource = "ExamRights";
            student.StatusChangeReason = $"{DrivingExamRules.MaxAttempts} sınav hakkı doldu, {DrivingExamRules.ExamTypeLabel(exam.ExamType).ToLowerInvariant()} geçilemedi — dönem düştü.";
            student.StatusChangedByUserId = null;
            student.StatusChangedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            // Personel görsün: dosya yeniden kayıt ister.
            await notifier.NotifyManagersAsync(
                "Sınav hakkı doldu — kursiyer pasife alındı",
                $"{await StudentNameAsync(student.StudentId, ct)}: {DrivingExamRules.OutOfAttemptsMessage(exam.ExamType)}",
                DrivingNotificationCategories.Exam,
                dedupeKey: $"exam-out-of-attempts:{candidate.Id}",
                relatedEntityType: nameof(DrivingExamCandidate), relatedEntityId: candidate.Id.ToString(),
                cancellationToken: ct);
        }
        else if (!passed && exam.ExamType == DrivingExamType.DrivingPractice)
        {
            // Mevzuat: başarısız direksiyon sınavı sonrası zorunlu ek direksiyon eğitimi.
            // Kurum ayarına göre otomatik ücret kalemi + ders hakkı açılır.
            var settings = await db.DrivingSchoolSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new DrivingSchoolSettings();
            if (settings.FailedPracticeExtraLessonMinutes > 0)
            {
                extraLessonChargeId = await CreateMandatoryExtraLessonAsync(student, settings, exam.Title, ct);
            }
        }

        await notifier.NotifyStudentAsync(student.Id, passed ? "Sınavı geçtiniz" : "Sınav sonucu: başarısız", passed ? $"{exam.Title} sınavını başarıyla tamamladınız." : $"{exam.Title}: {candidate.FailureReason}", DrivingNotificationCategories.Exam, dedupeKey: $"exam-result:{candidate.Id}", relatedEntityType: nameof(DrivingExamCandidate), relatedEntityId: candidate.Id.ToString(), cancellationToken: ct);
        await audit.LogChangeAsync("Sınav sonucu girildi", AuditCategory, nameof(DrivingExamCandidate), candidate.Id.ToString(), $"{exam.Title}: {candidate.Status}, puan {candidate.Score}", null, candidate, ct);
        return new ExamResultOutcome(usedAttempts, outOfAttempts, extraLessonChargeId);
    }

    /// <summary>Bekleyen aday kalmadıysa oturumu kapatır.</summary>
    private async Task CompleteExamIfDoneAsync(DrivingExamSession exam, CancellationToken ct)
    {
        var hasPending = await db.DrivingExamCandidates.AnyAsync(
            x => x.ExamSessionId == exam.Id && x.Status == DrivingExamCandidateStatus.Planned, ct);
        if (!hasPending && exam.Status == DrivingExamSessionStatus.Planned)
        {
            exam.Status = DrivingExamSessionStatus.Completed;
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>Adayın bu sınav türünde tükettiği hak sayısı (iptal edilen deneme hak yakmaz).</summary>
    private async Task<int> UsedAttemptsAsync(Guid profileId, DrivingExamType examType, CancellationToken ct)
    {
        var attempts = await db.DrivingExamCandidates.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(db.DrivingExamSessions.AsNoTracking().Where(x => x.ExamType == examType), x => x.ExamSessionId, x => x.Id,
                (candidate, _) => new { candidate.AttemptNo, candidate.ResultNote })
            .ToListAsync(ct);
        var manualAttempt = attempts
            .Where(x => x.ResultNote == ManualExamRightNote)
            .Select(x => x.AttemptNo)
            .DefaultIfEmpty(0)
            .Max();
        return Math.Max(attempts.Count, manualAttempt);
    }

    private async Task<string> StudentNameAsync(Guid studentId, CancellationToken ct)
        => await db.Students.AsNoTracking().Where(x => x.Id == studentId).Select(x => x.FullName).SingleOrDefaultAsync(ct) ?? "Kursiyer";

    /// <summary>
    /// Başarısız direksiyon sınavı sonrası zorunlu ek ders: ücret kalemi (varsa),
    /// taksit ve ders hakkı dakikası tek yerden açılır. Ücret 0 ise yalnızca
    /// dakika eklenir — borç yazılmaz.
    /// </summary>
    private async Task<Guid?> CreateMandatoryExtraLessonAsync(StudentDrivingProfile student, DrivingSchoolSettings settings, string examTitle, CancellationToken ct)
    {
        var minutes = settings.FailedPracticeExtraLessonMinutes;
        var fee = settings.FailedPracticeExtraLessonFee;
        var description = $"Zorunlu ek direksiyon eğitimi — {examTitle} başarısız ({minutes} dk)";

        Guid? chargeId = null;
        if (fee > 0 && student.EnrollmentContractId is Guid contractId)
        {
            var contract = await db.EnrollmentContracts.SingleAsync(x => x.Id == contractId, ct);
            var seq = await db.FinanceInstallments.Where(x => x.EnrollmentContractId == contractId).Select(x => (int?)x.SeqNo).MaxAsync(ct) ?? 0;
            var installment = new FinanceInstallment { EnrollmentContractId = contractId, StudentUserId = contract.StudentUserId, StudentName = contract.StudentName, SeqNo = seq + 1, Label = "Zorunlu ek ders", DueDateUtc = DateTime.UtcNow.Date, Amount = fee, Status = "Pending" };
            var charge = new DrivingCharge { StudentDrivingProfileId = student.Id, ChargeType = DrivingChargeType.ExtraLesson, Description = description, GrossAmount = fee, NetAmount = fee, Minutes = minutes, FinanceInstallmentId = installment.Id, EnrollmentContractId = contractId, CreatedByUserId = CurrentUserId() };
            db.FinanceInstallments.Add(installment); db.DrivingCharges.Add(charge);
            contract.GrossAmount += fee; contract.NetAmount += fee;
            await db.SaveChangesAsync(ct);
            chargeId = charge.Id;
        }

        // Ders hakkı: aday ek dersi alabilsin diye dakika defterine eklenir.
        await ledgerService.AddAsync(student.Id, DrivingLedgerEntryType.ExtraPurchasedMinutes, minutes, description,
            reason: "Başarısız direksiyon sınavı sonrası mevzuat gereği zorunlu ek eğitim", cancellationToken: ct);

        await notifier.NotifyStudentAsync(student.Id,
            "Zorunlu ek direksiyon eğitimi",
            fee > 0
                ? $"Sınav başarısızlığı nedeniyle {minutes} dakikalık zorunlu ek ders tanımlandı ({fee:N2} ₺)."
                : $"Sınav başarısızlığı nedeniyle {minutes} dakikalık zorunlu ek ders tanımlandı.",
            DrivingNotificationCategories.Exam,
            dedupeKey: $"mandatory-extra-lesson:{student.Id}:{DateTime.UtcNow:yyyyMMddHHmm}",
            relatedEntityType: nameof(DrivingCharge), relatedEntityId: chargeId?.ToString() ?? student.Id.ToString(),
            cancellationToken: ct);

        await audit.LogChangeAsync("Zorunlu ek ders tanımlandı", AuditCategory, nameof(DrivingCharge), chargeId?.ToString() ?? "-",
            description + (fee > 0 ? $" — {fee:N2} ₺ borç yazıldı." : " — ücretsiz."), null, new { minutes, fee }, ct);

        return chargeId;
    }

    [HttpPost("exams/candidates/{id:guid}/retry")]
    [RequireDrivingPermission(DrivingPermissions.ExamManage)]
    public async Task<IActionResult> ScheduleRetry(Guid id, [FromBody] ScheduleExamRetryRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var previous = await db.DrivingExamCandidates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (previous is null || !DrivingExamRules.CanScheduleRetry(previous.Status)) return Conflict(new { message = "Yalnızca başarısız sınav için tekrar planlanabilir." });
        if (request.FeeAmount is < 0 or > 1_000_000) return BadRequest(new { message = "Tekrar sınavı ücreti geçersiz." });
        var previousExam = await db.DrivingExamSessions.AsNoTracking().SingleAsync(x => x.Id == previous.ExamSessionId, ct);

        // Mevzuat: 4 hak dolduysa tekrar planlanamaz — aday dönemi düşmüştür.
        var usedAttempts = await UsedAttemptsAsync(previous.StudentDrivingProfileId, previousExam.ExamType, ct);
        if (DrivingExamRules.IsOutOfAttempts(usedAttempts))
            return Conflict(new { message = DrivingExamRules.OutOfAttemptsMessage(previousExam.ExamType) });
        var target = await db.DrivingExamSessions.SingleOrDefaultAsync(x => x.Id == request.ExamSessionId && x.ExamType == previousExam.ExamType && x.Status == DrivingExamSessionStatus.Planned, ct);
        if (target is null) return BadRequest(new { message = "Aynı türde planlanmış hedef sınav bulunamadı." });
        if (await db.DrivingExamCandidates.AnyAsync(x => x.ExamSessionId == target.Id && x.StudentDrivingProfileId == previous.StudentDrivingProfileId, ct)) return Conflict(new { message = "Öğrenci hedef sınava zaten eklenmiş." });
        if (await db.DrivingExamCandidates.CountAsync(x => x.ExamSessionId == target.Id, ct) >= target.Capacity) return Conflict(new { message = "Hedef sınavın kapasitesi dolu." });
        var student = await db.StudentDrivingProfiles.SingleAsync(x => x.Id == previous.StudentDrivingProfileId, ct);
        if (request.FeeAmount > 0 && student.EnrollmentContractId is null) return BadRequest(new { message = "Sınav ücreti için kursiyer sözleşmesi bulunamadı." });
        var candidate = new DrivingExamCandidate { ExamSessionId = target.Id, StudentDrivingProfileId = student.Id, AttemptNo = previous.AttemptNo + 1, PreviousCandidateId = previous.Id };
        if (request.FeeAmount > 0) candidate.DrivingChargeId = await CreateExamChargeAsync(student, request.FeeAmount, $"{target.Title} tekrar", ct);
        db.DrivingExamCandidates.Add(candidate); await db.SaveChangesAsync(ct);
        return Ok(new { candidate.Id, candidate.AttemptNo, candidate.DrivingChargeId });
    }

    /// <summary>Sınav günü eşleşmesi: aday hangi araçla ve hangi usta öğreticiyle sınava girecek.</summary>
    [HttpPut("exams/candidates/{id:guid}/assignment")]
    [RequireDrivingPermission(DrivingPermissions.ExamManage)]
    public async Task<IActionResult> AssignExamCandidate(Guid id, [FromBody] AssignExamCandidateRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var candidate = await db.DrivingExamCandidates.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (candidate is null) return NotFound(new { message = "Sınav adayı bulunamadı." });
        if (request.VehicleId is Guid vehicleId && !await db.DrivingVehicles.AsNoTracking().AnyAsync(x => x.Id == vehicleId, ct))
            return BadRequest(new { message = "Araç bulunamadı." });
        if (request.InstructorProfileId is Guid instructorId && !await db.DrivingInstructorProfiles.AsNoTracking().AnyAsync(x => x.Id == instructorId, ct))
            return BadRequest(new { message = "Usta öğretici bulunamadı." });

        candidate.AssignedVehicleId = request.VehicleId;
        candidate.AssignedInstructorProfileId = request.InstructorProfileId;
        await db.SaveChangesAsync(ct);
        return Ok(new { candidate.Id, candidate.AssignedVehicleId, candidate.AssignedInstructorProfileId });
    }

    /// <summary>
    /// Sınav günü listesi: aday–araç–usta öğretici eşleşmesi. Sınav yerinde
    /// komisyona sunulan liste — <c>?format=pdf</c> tek belge modelinden PDF üretir.
    /// </summary>
    [HttpGet("exams/sessions/{id:guid}/roster")]
    [RequireDrivingPermission(DrivingPermissions.ExamView)]
    public async Task<IActionResult> GetExamRoster(Guid id, [FromQuery] string? format, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var exam = await db.DrivingExamSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (exam is null) return NotFound(new { message = "Sınav bulunamadı." });

        var commission = await db.DrivingExamCommissionMembers.AsNoTracking()
            .Where(x => x.ExamSessionId == id).Select(x => $"{x.FullName} ({x.Role})").ToListAsync(ct);

        var rows = await db.DrivingExamCandidates.AsNoTracking()
            .Where(x => x.ExamSessionId == id && x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => new { c, p })
            .Join(db.Students.AsNoTracking(), x => x.p.StudentId, s => s.Id, (x, s) => new
            {
                x.p.StudentNumber,
                s.FullName,
                Identity = x.p.IdentityNumber == "" ? s.TcNo : x.p.IdentityNumber,
                x.p.LicenseClass,
                x.c.AttemptNo,
                x.c.AssignedVehicleId,
                x.c.AssignedInstructorProfileId,
            })
            .OrderBy(x => x.StudentNumber)
            .ToListAsync(ct);

        var vehicles = await db.DrivingVehicles.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.PlateNumber, ct);
        var instructorNames = await db.DrivingInstructorProfiles.AsNoTracking()
            .Join(db.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (profile, staff) => new { profile.Id, staff.FullName })
            .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);

        var tableRows = rows.Select((x, index) => (IReadOnlyList<string>)
        [
            (index + 1).ToString(),
            x.StudentNumber.ToString(),
            x.FullName,
            x.Identity ?? string.Empty,
            x.LicenseClass,
            $"{x.AttemptNo}/{DrivingExamRules.MaxAttempts}",
            x.AssignedVehicleId is Guid v && vehicles.TryGetValue(v, out var plate) ? plate : "—",
            x.AssignedInstructorProfileId is Guid i && instructorNames.TryGetValue(i, out var name) ? name : "—",
        ]).ToList();

        var institutionName = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == db.CurrentTenantId).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? "Sürücü Kursu";

        var document = new DrivingReportDocument(
            institutionName,
            $"{exam.Title} — Sınav Günü Listesi",
            $"{DrivingExamRules.ExamTypeLabel(exam.ExamType)} • {exam.StartsAtUtc.AddHours(3):dd.MM.yyyy HH:mm} • {exam.Location}",
            exam.StartsAtUtc, exam.EndsAtUtc,
            [
                new DrivingReportColumn("Sıra", Numeric: true), new DrivingReportColumn("Kursiyer No", Numeric: true),
                new DrivingReportColumn("Ad Soyad"), new DrivingReportColumn("TC Kimlik No"),
                new DrivingReportColumn("Sınıf"), new DrivingReportColumn("Deneme"),
                new DrivingReportColumn("Araç"), new DrivingReportColumn("Usta Öğretici"),
            ],
            tableRows,
            [
                ("Aday sayısı", rows.Count.ToString()),
                ("Komisyon", commission.Count > 0 ? string.Join(", ", commission) : "—"),
            ]);

        if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            return File(pdf.Generate(document), "application/pdf", $"sinav-listesi-{exam.StartsAtUtc:yyyyMMdd}.pdf");

        return Ok(new
        {
            exam = new { exam.Id, exam.Title, examType = exam.ExamType.ToString(), exam.StartsAtUtc, exam.Location },
            columns = document.Columns.Select(x => new { header = x.Header, numeric = x.Numeric }),
            rows = document.Rows,
            summary = document.Summary.Select(x => new { label = x.Label, value = x.Value }),
        });
    }

    private async Task<Guid> CreateExamChargeAsync(StudentDrivingProfile profile, decimal amount, string description, CancellationToken ct)
    {
        if (amount is <= 0 or > 1_000_000) throw new InvalidOperationException("Sınav ücreti geçersiz.");
        if (profile.EnrollmentContractId is not Guid contractId) throw new InvalidOperationException("Sınav ücreti için kursiyer sözleşmesi bulunamadı.");
        var contract = await db.EnrollmentContracts.SingleAsync(x => x.Id == contractId, ct);
        var seq = await db.FinanceInstallments.Where(x => x.EnrollmentContractId == contractId).Select(x => (int?)x.SeqNo).MaxAsync(ct) ?? 0;
        var installment = new FinanceInstallment { EnrollmentContractId = contractId, StudentUserId = contract.StudentUserId, StudentName = contract.StudentName, SeqNo = seq + 1, Label = "Sınav ücreti", DueDateUtc = DateTime.UtcNow.Date, Amount = amount, Status = "Pending" };
        var charge = new DrivingCharge { StudentDrivingProfileId = profile.Id, ChargeType = DrivingChargeType.ExamFee, Description = description, GrossAmount = amount, NetAmount = amount, FinanceInstallmentId = installment.Id, EnrollmentContractId = contractId, CreatedByUserId = CurrentUserId() };
        db.FinanceInstallments.Add(installment); db.DrivingCharges.Add(charge); contract.GrossAmount += amount; contract.NetAmount += amount;
        return charge.Id;
    }

    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private async Task<Guid?> CurrentStaffIdAsync(CancellationToken ct) { var id = CurrentUserId(); return id is null ? null : await db.Staff.Where(x => x.UserId == id).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct); }
    private async Task<Guid?> CurrentStudentProfileIdAsync(CancellationToken ct) { var id = CurrentUserId(); return id is null ? null : await db.StudentDrivingProfiles.Join(db.Students.Where(x => x.UserId == id), x => x.StudentId, x => x.Id, (profile, _) => (Guid?)profile.Id).SingleOrDefaultAsync(ct); }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (db.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record SaveTheoryClassRequest(string Name, string LicenseClass, Guid InstructorStaffId, int Capacity, DateTime StartsAtUtc, DateTime EndsAtUtc, string? Room);
public sealed record EnrollTheoryStudentsRequest(IReadOnlyList<Guid> StudentProfileIds);
public sealed record SaveTheorySessionRequest(Guid TheoryClassId, Guid? InstructorStaffId, string Subject, string Topic, DateTime StartsAtUtc, DateTime EndsAtUtc, string? Room);
public sealed record TheoryAttendanceItem(Guid StudentProfileId, string Status, string? Note)
{
    public DrivingTheoryAttendanceStatus? ParsedStatus => Enum.TryParse<DrivingTheoryAttendanceStatus>(Status, true, out var value) && Enum.IsDefined(value) ? value : null;
}
public sealed record SaveTheoryAttendanceRequest(IReadOnlyList<TheoryAttendanceItem> Items);
public sealed record ExamCommissionRequest(string FullName, string Role, string? Organization);
public sealed record SaveExamSessionRequest(string ExamType, string Title, DateTime StartsAtUtc, DateTime EndsAtUtc, string Location, int Capacity, IReadOnlyList<ExamCommissionRequest> Commission)
{
    public DrivingExamType? ParsedType => Enum.TryParse<DrivingExamType>(ExamType, true, out var value) && Enum.IsDefined(value) ? value : null;
}
public sealed record AddExamCandidatesRequest(IReadOnlyList<Guid> StudentProfileIds, decimal FeeAmount);
public sealed record AssignExamCandidateRequest(Guid? VehicleId, Guid? InstructorProfileId);
public sealed record GenerateScheduleRequest(DateTime StartDate, IReadOnlyList<int> DaysOfWeek, int StartHourLocal, int StartMinuteLocal, int LessonsPerDay);
public sealed record ExamResultImportRow(string IdentityNumber, string? Result, decimal? Score);
public sealed record ImportExamResultsRequest(IReadOnlyList<ExamResultImportRow> Rows);
public sealed record EnterExamResultRequest(bool Passed, decimal? Score, string? FailureReason, string? Note);
public sealed record SaveExamRightRequest(Guid? CandidateId, Guid StudentProfileId, string ExamType, int AttemptNo, decimal Score, bool Passed, DateTime ExamDateUtc)
{
    public DrivingExamType? ParsedType => Enum.TryParse<DrivingExamType>(ExamType, true, out var value) && Enum.IsDefined(value) ? value : null;
}
public sealed record ScheduleExamRetryRequest(Guid ExamSessionId, decimal FeeAmount);
