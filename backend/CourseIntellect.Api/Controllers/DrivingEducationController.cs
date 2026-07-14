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
    IAuditLogService audit) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

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
                x.candidate.AttemptNo, status = x.candidate.Status.ToString(), x.candidate.Score, x.candidate.FailureReason,
                x.candidate.ResultNote, x.candidate.ResultEnteredAtUtc, x.candidate.DrivingChargeId,
            }).OrderBy(x => x.studentName).ToListAsync(ct);

        var canManage = await permissions.HasAsync(User, DrivingPermissions.TheoryManage, ct)
            || await permissions.HasAsync(User, DrivingPermissions.ExamManage, ct);
        object? reference = null;
        if (canManage)
        {
            reference = new
            {
                instructors = await db.Staff.AsNoTracking().OrderBy(x => x.FullName).Select(x => new { x.Id, x.FullName }).ToListAsync(ct),
                students = await db.StudentDrivingProfiles.AsNoTracking().Where(x => DrivingStudentStatuses.Open.Contains(x.Status))
                    .Join(db.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (profile, student) => new { id = profile.Id, student.FullName, profile.LicenseClass, status = profile.Status.ToString() })
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
        if (request.Name.Trim().Length is < 3 or > 150 || request.Capacity is < 1 or > 100 || request.EndsAtUtc <= request.StartsAtUtc)
            return BadRequest(new { message = "Sınıf adı, kapasite veya tarih aralığı geçersiz." });
        if (!await db.Staff.AnyAsync(x => x.Id == request.InstructorStaffId, ct)) return BadRequest(new { message = "Öğretmen bulunamadı." });
        var entity = new DrivingTheoryClass
        {
            Name = request.Name.Trim(), LicenseClass = request.LicenseClass.Trim().ToUpperInvariant(), InstructorStaffId = request.InstructorStaffId,
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
        if (existing.Count + additions.Count > group.Capacity) return Conflict(new { message = "Sınıf kapasitesi aşılamaz." });
        var students = await db.StudentDrivingProfiles.Where(x => additions.Contains(x.Id)).ToListAsync(ct);
        if (students.Count != additions.Count || students.Any(x => !x.LicenseClass.Equals(group.LicenseClass, StringComparison.OrdinalIgnoreCase) || x.Status is not (DrivingStudentStatus.Active or DrivingStudentStatus.TheoryOngoing)))
            return BadRequest(new { message = "Öğrencilerden biri bulunamadı, evrakları tamam değil veya ehliyet sınıfı uyuşmuyor." });
        db.DrivingTheoryEnrollments.AddRange(additions.Select(studentId => new DrivingTheoryEnrollment { TheoryClassId = id, StudentDrivingProfileId = studentId }));
        foreach (var student in students.Where(x => x.Status == DrivingStudentStatus.Active)) student.Status = DrivingStudentStatus.TheoryOngoing;
        await db.SaveChangesAsync(ct);
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
        candidate.Status = request.Passed ? DrivingExamCandidateStatus.Passed : DrivingExamCandidateStatus.Failed;
        candidate.Score = request.Score; candidate.FailureReason = request.Passed ? string.Empty : request.FailureReason!.Trim(); candidate.ResultNote = request.Note?.Trim() ?? string.Empty; candidate.ResultEnteredAtUtc = DateTime.UtcNow; candidate.ResultEnteredByUserId = CurrentUserId();
        student.Status = DrivingExamRules.StudentStatusAfterResult(exam.ExamType, request.Passed);
        var hasPendingCandidate = await db.DrivingExamCandidates.AnyAsync(
            x => x.ExamSessionId == exam.Id && x.Id != candidate.Id && x.Status == DrivingExamCandidateStatus.Planned,
            ct);
        if (!hasPendingCandidate) exam.Status = DrivingExamSessionStatus.Completed;
        await db.SaveChangesAsync(ct);
        await notifier.NotifyStudentAsync(student.Id, request.Passed ? "Sınavı geçtiniz" : "Sınav sonucu: başarısız", request.Passed ? $"{exam.Title} sınavını başarıyla tamamladınız." : $"{exam.Title}: {candidate.FailureReason}", DrivingNotificationCategories.Exam, dedupeKey: $"exam-result:{candidate.Id}", relatedEntityType: nameof(DrivingExamCandidate), relatedEntityId: candidate.Id.ToString(), cancellationToken: ct);
        await audit.LogChangeAsync("Sınav sonucu girildi", AuditCategory, nameof(DrivingExamCandidate), candidate.Id.ToString(), $"{exam.Title}: {candidate.Status}, puan {candidate.Score}", null, candidate, ct);
        return Ok(new { status = candidate.Status.ToString(), studentStatus = student.Status.ToString() });
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
public sealed record EnterExamResultRequest(bool Passed, decimal? Score, string? FailureReason, string? Note);
public sealed record ScheduleExamRetryRequest(Guid ExamSessionId, decimal FeeAmount);
