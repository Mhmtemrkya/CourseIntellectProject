using System.Security.Claims;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.DTOs.StudyPlans;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Rehberlik modülü: vaka merkezi (risk motoru), öğrenci rehberlik dosyası,
/// görüşme kayıtları, randevu/müsaitlik, hedef ve envanter yönetimi.
/// Rehber = PrimaryRole Teacher + DepartmentOrBranch "Rehberlik" (Admin her
/// zaman yetkilidir). Görüşme notu içerikleri görünürlük kuralına tabidir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/guidance")]
// Rehberlik modülü kapalı kurumlarda rehber (counselor) uçlara erişemez.
// Admin bu modülü katalogda sahiplenmediğinden kısıtsız geçer.
[RequireEntitlement("guidance")]
public sealed class GuidanceController(
    CourseIntellectDbContext dbContext,
    IStudyPlanService studyPlanService,
    IPushNotificationService pushNotificationService) : ControllerBase
{
    private static string Normalize(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant()
            .Replace("ı", "i").Replace("ğ", "g").Replace("ü", "u")
            .Replace("ş", "s").Replace("ö", "o").Replace("ç", "c");

    private static bool IsCounselorUser(AppUser user)
        => user.PrimaryRole == UserRole.Admin
           || (user.PrimaryRole == UserRole.Teacher && Normalize(user.DepartmentOrBranch).Contains("rehberlik"));

    private async Task<AppUser?> ResolveCallerAsync(CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName)) return null;
        var candidates = await dbContext.Users
            .Where(u => u.FullName == fullName)
            .ToListAsync(cancellationToken);
        if (candidates.Count > 0) return candidates[0];
        var normalized = Normalize(fullName);
        return (await dbContext.Users.ToListAsync(cancellationToken))
            .FirstOrDefault(u => Normalize(u.FullName) == normalized);
    }

    private async Task<AppUser?> ResolveCounselorAsync(CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        return caller is not null && IsCounselorUser(caller) ? caller : null;
    }

    // ─── Rehber listesi (öğrenci/veli randevu isterken seçer) ────────────
    [HttpGet("counselors")]
    public async Task<IActionResult> GetCounselors(CancellationToken cancellationToken)
    {
        var teachers = await dbContext.Users
            .Where(u => u.PrimaryRole == UserRole.Teacher && u.Status == UserStatus.Active)
            .Select(u => new { u.FullName, u.DepartmentOrBranch })
            .ToListAsync(cancellationToken);
        var counselors = teachers
            .Where(t => Normalize(t.DepartmentOrBranch).Contains("rehberlik"))
            .Select(t => new { fullName = t.FullName })
            .OrderBy(t => t.fullName)
            .ToList();
        return Ok(counselors);
    }

    // ─── Vaka merkezi: canlı verilerden risk hesaplı öğrenci listesi ─────
    [HttpGet("overview")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();

        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
        var since = DateTime.UtcNow.AddDays(-60);
        var attendance = await dbContext.AttendanceEntries.AsNoTracking()
            .Where(a => a.LessonDate >= since)
            .ToListAsync(cancellationToken);
        var examResults = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var assignments = await dbContext.HomeworkAssignments.AsNoTracking().ToListAsync(cancellationToken);
        var submissions = await dbContext.HomeworkSubmissions.AsNoTracking().ToListAsync(cancellationToken);
        var sessions = await dbContext.GuidanceSessions.AsNoTracking().ToListAsync(cancellationToken);
        var reviews = await dbContext.GuidanceRiskReviews.AsNoTracking().ToListAsync(cancellationToken);

        var attendanceByStudent = attendance
            .GroupBy(a => Normalize(a.StudentName))
            .ToDictionary(g => g.Key, g => g.ToList());
        var examsByStudent = examResults
            .GroupBy(e => Normalize(e.StudentName))
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.DateLabel).ToList());
        var submissionsByStudent = submissions
            .GroupBy(s => Normalize(s.StudentName))
            .ToDictionary(g => g.Key, g => g.Select(x => x.AssignmentId).ToHashSet());
        var lastSessionByStudent = sessions
            .GroupBy(s => Normalize(s.StudentName))
            .ToDictionary(g => g.Key, g => g.Max(x => x.SessionAtUtc));
        var lastReviewByStudent = reviews
            .GroupBy(r => Normalize(r.StudentName))
            .ToDictionary(g => g.Key, g => g.Max(x => x.ReviewedAtUtc));

        var now = DateTime.UtcNow;
        var result = students.Select(student =>
        {
            var key = Normalize(student.FullName);
            var reasons = new List<string>();
            var score = 0;

            // Devamsızlık: son 30 gün / önceki 30 gün kıyası + mutlak oran
            if (attendanceByStudent.TryGetValue(key, out var entries))
            {
                var recent = entries.Where(a => a.LessonDate >= now.AddDays(-30)).ToList();
                var previous = entries.Where(a => a.LessonDate < now.AddDays(-30)).ToList();
                var recentAbsent = recent.Count(a => Normalize(a.Status).Contains("absent") || Normalize(a.Status).Contains("yok") || Normalize(a.Status).Contains("gelmedi"));
                var previousAbsent = previous.Count(a => Normalize(a.Status).Contains("absent") || Normalize(a.Status).Contains("yok") || Normalize(a.Status).Contains("gelmedi"));
                if (recent.Count > 0 && recentAbsent * 100 / Math.Max(recent.Count, 1) >= 25)
                {
                    score += 2;
                    reasons.Add($"Son 30 günde devamsızlık %{recentAbsent * 100 / Math.Max(recent.Count, 1)}");
                }
                if (recentAbsent > previousAbsent && previous.Count > 0)
                {
                    score += 1;
                    reasons.Add("Devamsızlık artış eğiliminde");
                }
            }

            // Sınav: son 2 sınav ortalaması, önceki ortalamaya göre düşüş
            decimal? lastAvg = null;
            decimal? prevAvg = null;
            if (examsByStudent.TryGetValue(key, out var exams) && exams.Count >= 2)
            {
                var lastTwo = exams.TakeLast(2).ToList();
                var older = exams.SkipLast(2).ToList();
                lastAvg = lastTwo.Average(e => (decimal)e.Score);
                if (older.Count > 0)
                {
                    prevAvg = older.Average(e => (decimal)e.Score);
                    if (lastAvg < prevAvg - 10)
                    {
                        score += 2;
                        reasons.Add($"Sınav ortalaması {prevAvg:0}→{lastAvg:0} düştü");
                    }
                    else if (lastAvg < prevAvg - 5)
                    {
                        score += 1;
                        reasons.Add("Sınav performansında hafif düşüş");
                    }
                }
            }

            // Ödev teslim oranı (sınıfına atanan ödevler üzerinden)
            var classAssignments = assignments.Where(a => Normalize(a.ClassName) == Normalize(student.ClassName)).ToList();
            int? homeworkRate = null;
            if (classAssignments.Count > 0)
            {
                var submitted = submissionsByStudent.TryGetValue(key, out var subs)
                    ? classAssignments.Count(a => subs.Contains(a.Id))
                    : 0;
                homeworkRate = submitted * 100 / classAssignments.Count;
                if (homeworkRate < 50)
                {
                    score += 2;
                    reasons.Add($"Ödev teslimi %{homeworkRate}");
                }
            }

            var level = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
            lastSessionByStudent.TryGetValue(key, out var lastSession);
            lastReviewByStudent.TryGetValue(key, out var lastReview);

            return new
            {
                studentName = student.FullName,
                className = student.ClassName,
                schoolNumber = student.SchoolNumber,
                parentName = student.ParentName,
                riskLevel = level,
                riskScore = score,
                riskReasons = reasons,
                lastExamAverage = lastAvg,
                previousExamAverage = prevAvg,
                homeworkRate,
                lastSessionAtUtc = lastSession == default ? (DateTime?)null : lastSession,
                lastReviewAtUtc = lastReview == default ? (DateTime?)null : lastReview,
                needsAttention = level != "low" && (lastReview == default || lastReview < now.AddDays(-14)),
            };
        })
        .OrderByDescending(s => s.riskScore)
        .ThenBy(s => s.studentName)
        .ToList();

        return Ok(result);
    }

    // ─── Öğrenci rehberlik dosyası (tüm sekmelerin canlı verisi) ─────────
    [HttpGet("student-file")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> GetStudentFile([FromQuery] string student, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        if (string.IsNullOrWhiteSpace(student)) return BadRequest(new { message = "Öğrenci adı gerekli." });

        var normalized = Normalize(student);
        var profile = (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
            .FirstOrDefault(s => Normalize(s.FullName) == normalized);
        if (profile is null) return NotFound(new { message = "Öğrenci bulunamadı." });

        var exams = (await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken))
            .Where(e => Normalize(e.StudentName) == normalized)
            .OrderBy(e => e.DateLabel)
            .Select(e => new { e.ExamTitle, e.Subject, e.DateLabel, e.Score, e.Net, type = e.Type.ToString() })
            .ToList();

        var classExamAverages = (await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken))
            .Where(e => Normalize(e.ClassName) == Normalize(profile.ClassName))
            .GroupBy(e => e.ExamTitle)
            .Select(g => new { examTitle = g.Key, average = Math.Round(g.Average(x => (decimal)x.Score), 1) })
            .ToList();

        var since = DateTime.UtcNow.AddDays(-120);
        var attendance = (await dbContext.AttendanceEntries.AsNoTracking()
                .Where(a => a.LessonDate >= since).ToListAsync(cancellationToken))
            .Where(a => Normalize(a.StudentName) == normalized)
            .OrderBy(a => a.LessonDate)
            .Select(a => new { a.LessonDate, a.Status, a.Lesson })
            .ToList();

        var assignments = (await dbContext.HomeworkAssignments.AsNoTracking().ToListAsync(cancellationToken))
            .Where(a => Normalize(a.ClassName) == Normalize(profile.ClassName)).ToList();
        var submittedIds = (await dbContext.HomeworkSubmissions.AsNoTracking().ToListAsync(cancellationToken))
            .Where(s => Normalize(s.StudentName) == normalized)
            .Select(s => s.AssignmentId).ToHashSet();

        // Görünürlük: private notları yalnızca yazan rehber görür.
        var callerName = Normalize(counselor.FullName);
        var isAdmin = counselor.PrimaryRole == UserRole.Admin;
        var sessions = (await dbContext.GuidanceSessions.AsNoTracking().ToListAsync(cancellationToken))
            .Where(s => Normalize(s.StudentName) == normalized)
            .Where(s => isAdmin
                ? s.Visibility == "admin"
                : s.Visibility != "private" || Normalize(s.CounselorName) == callerName)
            .OrderByDescending(s => s.SessionAtUtc)
            .ToList();

        var goal = (await dbContext.GuidanceGoals.AsNoTracking().ToListAsync(cancellationToken))
            .FirstOrDefault(g => Normalize(g.StudentName) == normalized);

        var inventories = (await dbContext.GuidanceInventories.AsNoTracking().ToListAsync(cancellationToken))
            .Where(i => Normalize(i.StudentName) == normalized)
            .OrderByDescending(i => i.AssignedAtUtc)
            .ToList();

        var appointments = (await dbContext.GuidanceAppointments.AsNoTracking().ToListAsync(cancellationToken))
            .Where(a => Normalize(a.StudentName) == normalized)
            .OrderByDescending(a => a.CreatedAtUtc)
            .ToList();

        var studyPlan = await studyPlanService.GetOrCreateAsync(profile.FullName, cancellationToken);

        return Ok(new
        {
            profile = new
            {
                fullName = profile.FullName,
                className = profile.ClassName,
                schoolNumber = profile.SchoolNumber,
                parentName = profile.ParentName,
                parentPhone = profile.ParentPhone,
                programType = profile.ProgramType,
            },
            exams,
            classExamAverages,
            attendance,
            homework = new
            {
                total = assignments.Count,
                submitted = assignments.Count(a => submittedIds.Contains(a.Id)),
            },
            sessions,
            goal,
            inventories,
            appointments,
            studyPlan,
        });
    }

    // ─── Görüşme kayıtları ───────────────────────────────────────────────
    [HttpPost("sessions")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> CreateSession([FromBody] GuidanceSessionRecord request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.StudentName))
            return BadRequest(new { message = "Öğrenci adı gerekli." });

        var record = new GuidanceSessionRecord
        {
            CounselorName = counselor.FullName,
            StudentName = request.StudentName.Trim(),
            ClassName = request.ClassName?.Trim() ?? string.Empty,
            SessionType = string.IsNullOrWhiteSpace(request.SessionType) ? "bireysel" : request.SessionType,
            Topic = string.IsNullOrWhiteSpace(request.Topic) ? "diger" : request.Topic,
            Note = request.Note ?? string.Empty,
            Visibility = request.Visibility is "private" or "guidance" or "admin" ? request.Visibility : "guidance",
            SessionAtUtc = request.SessionAtUtc == default ? DateTime.UtcNow : request.SessionAtUtc,
            FollowUpAtUtc = request.FollowUpAtUtc,
        };
        dbContext.GuidanceSessions.Add(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(record);
    }

    [HttpPatch("sessions/{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> UpdateSession(Guid id, [FromBody] GuidanceSessionRecord request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var record = await dbContext.GuidanceSessions.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (record is null) return NotFound();
        if (record.Visibility == "private" && Normalize(record.CounselorName) != Normalize(counselor.FullName))
            return Forbid();

        if (!string.IsNullOrWhiteSpace(request.Note)) record.Note = request.Note;
        if (!string.IsNullOrWhiteSpace(request.Topic)) record.Topic = request.Topic;
        if (request.Visibility is "private" or "guidance" or "admin") record.Visibility = request.Visibility;
        if (request.FollowUpAtUtc.HasValue) record.FollowUpAtUtc = request.FollowUpAtUtc;
        record.FollowUpDone = request.FollowUpDone;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(record);
    }

    [HttpDelete("sessions/{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> DeleteSession(Guid id, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var record = await dbContext.GuidanceSessions.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (record is null) return NotFound();
        if (Normalize(record.CounselorName) != Normalize(counselor.FullName) && counselor.PrimaryRole != UserRole.Admin)
            return Forbid();
        dbContext.GuidanceSessions.Remove(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { deleted = true });
    }

    // Takip tarihi gelen görüşmeler (ana sayfa uyarıları)
    [HttpGet("follow-ups")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> GetFollowUps(CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var callerName = Normalize(counselor.FullName);
        var items = (await dbContext.GuidanceSessions.AsNoTracking().ToListAsync(cancellationToken))
            .Where(s => Normalize(s.CounselorName) == callerName
                && s.FollowUpAtUtc.HasValue && !s.FollowUpDone
                && s.FollowUpAtUtc <= DateTime.UtcNow.AddDays(3))
            .OrderBy(s => s.FollowUpAtUtc)
            .ToList();
        return Ok(items);
    }

    // ─── Müsaitlik ───────────────────────────────────────────────────────
    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability([FromQuery] string? counselor, CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        var target = counselor;
        if (string.IsNullOrWhiteSpace(target) && caller is not null && IsCounselorUser(caller))
            target = caller.FullName;
        if (string.IsNullOrWhiteSpace(target)) return BadRequest(new { message = "Rehber adı gerekli." });

        var normalized = Normalize(target);
        var slots = (await dbContext.GuidanceAvailabilitySlots.AsNoTracking().ToListAsync(cancellationToken))
            .Where(s => Normalize(s.CounselorName) == normalized)
            .OrderBy(s => s.Slot)
            .ToList();

        // Onaylı/bekleyen randevuların tuttuğu slotlar düşülerek uygunlar döner.
        var taken = (await dbContext.GuidanceAppointments.AsNoTracking().ToListAsync(cancellationToken))
            .Where(a => Normalize(a.CounselorName) == normalized && a.Status is "Bekliyor" or "Onaylandı")
            .Select(a => a.Slot)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return Ok(new
        {
            counselor = target,
            slots = slots.Select(s => new { s.Id, s.Slot, available = !taken.Contains(s.Slot) }),
        });
    }

    public sealed record SaveAvailabilityRequest(List<string> Slots);

    [HttpPut("availability")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> SaveAvailability([FromBody] SaveAvailabilityRequest request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var callerName = Normalize(counselor.FullName);
        var existing = (await dbContext.GuidanceAvailabilitySlots.ToListAsync(cancellationToken))
            .Where(s => Normalize(s.CounselorName) == callerName)
            .ToList();
        dbContext.GuidanceAvailabilitySlots.RemoveRange(existing);
        var slots = (request.Slots ?? [])
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(s => new GuidanceAvailabilitySlot { CounselorName = counselor.FullName, Slot = s })
            .ToList();
        dbContext.GuidanceAvailabilitySlots.AddRange(slots);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(slots.Select(s => new { s.Id, s.Slot }));
    }

    // ─── Randevular ──────────────────────────────────────────────────────
    [HttpGet("appointments")]
    public async Task<IActionResult> GetAppointments([FromQuery] bool mine = false, CancellationToken cancellationToken = default)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        if (caller is null) return Unauthorized();
        var callerName = Normalize(caller.FullName);
        var all = await dbContext.GuidanceAppointments.AsNoTracking().ToListAsync(cancellationToken);

        List<GuidanceAppointment> items;
        if (!mine && IsCounselorUser(caller))
        {
            items = all.Where(a => Normalize(a.CounselorName) == callerName
                || caller.PrimaryRole == UserRole.Admin).ToList();
        }
        else
        {
            items = all.Where(a => Normalize(a.RequesterName) == callerName
                || Normalize(a.StudentName) == callerName).ToList();
        }
        return Ok(items.OrderByDescending(a => a.CreatedAtUtc));
    }

    [HttpPost("appointments")]
    public async Task<IActionResult> CreateAppointment([FromBody] GuidanceAppointment request, CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        if (caller is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.CounselorName) || string.IsNullOrWhiteSpace(request.Slot))
            return BadRequest(new { message = "Rehber ve saat seçimi gerekli." });

        // Slot çakışma kontrolü
        var normalized = Normalize(request.CounselorName);
        var conflict = (await dbContext.GuidanceAppointments.AsNoTracking().ToListAsync(cancellationToken))
            .Any(a => Normalize(a.CounselorName) == normalized
                && string.Equals(a.Slot, request.Slot, StringComparison.OrdinalIgnoreCase)
                && a.Status is "Bekliyor" or "Onaylandı");
        if (conflict) return Conflict(new { message = "Bu saat dolu, başka bir saat seçin." });

        var isParent = caller.PrimaryRole == UserRole.Parent;
        var appointment = new GuidanceAppointment
        {
            CounselorName = request.CounselorName.Trim(),
            RequesterName = caller.FullName,
            RequesterRole = isParent ? "parent" : "student",
            StudentName = isParent
                ? (request.StudentName ?? string.Empty).Trim()
                : caller.FullName,
            Slot = request.Slot.Trim(),
            Topic = request.Topic ?? string.Empty,
            Note = request.Note ?? string.Empty,
        };
        dbContext.GuidanceAppointments.Add(appointment);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(appointment);
    }

    public sealed record DecideAppointmentRequest(bool Approved, string? Note);

    [HttpPatch("appointments/{id:guid}/decide")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> DecideAppointment(Guid id, [FromBody] DecideAppointmentRequest request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var appointment = await dbContext.GuidanceAppointments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (appointment is null) return NotFound();

        appointment.Status = request.Approved ? "Onaylandı" : "Reddedildi";
        appointment.DecisionNote = request.Note ?? string.Empty;
        appointment.DecidedAtUtc = DateTime.UtcNow;

        // Talep sahibine bildirim düşür (mevcut bildirim altyapısı)
        dbContext.Notifications.Add(new NotificationItem
        {
            Title = request.Approved ? "Rehberlik randevunuz onaylandı" : "Rehberlik randevunuz reddedildi",
            Message = $"{appointment.CounselorName} • {appointment.Slot}" +
                      (string.IsNullOrWhiteSpace(request.Note) ? string.Empty : $" — {request.Note}"),
            TimeLabel = DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm"),
            Audience = appointment.RequesterName,
            TargetRole = appointment.RequesterRole == "parent" ? "Parent" : "Student",
            Category = "guidance",
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        // Talep sahibine telefon push'u.
        await pushNotificationService.SendToUserByNameAsync(
            appointment.RequesterName,
            request.Approved ? "Rehberlik randevunuz onaylandı" : "Rehberlik randevunuz reddedildi",
            $"{appointment.CounselorName} • {appointment.Slot}",
            new Dictionary<string, string> { ["category"] = "guidance" },
            cancellationToken);

        return Ok(appointment);
    }

    [HttpPatch("appointments/{id:guid}/complete")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> CompleteAppointment(Guid id, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var appointment = await dbContext.GuidanceAppointments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (appointment is null) return NotFound();
        appointment.Status = "Tamamlandı";
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(appointment);
    }

    // ─── Hedefler ────────────────────────────────────────────────────────
    [HttpPut("goals/{studentName}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> SaveGoal(string studentName, [FromBody] GuidanceGoal request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        var normalized = Normalize(studentName);
        var goal = (await dbContext.GuidanceGoals.ToListAsync(cancellationToken))
            .FirstOrDefault(g => Normalize(g.StudentName) == normalized);
        if (goal is null)
        {
            goal = new GuidanceGoal { StudentName = studentName.Trim() };
            dbContext.GuidanceGoals.Add(goal);
        }
        goal.CounselorName = counselor.FullName;
        goal.TargetSchool = request.TargetSchool ?? string.Empty;
        goal.TargetField = request.TargetField ?? string.Empty;
        goal.TargetScore = request.TargetScore ?? string.Empty;
        goal.Progress = Math.Clamp(request.Progress, 0, 100);
        goal.Note = request.Note ?? string.Empty;
        goal.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(goal);
    }

    // ─── Risk incelemesi ─────────────────────────────────────────────────
    [HttpPost("risk-reviews")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> CreateRiskReview([FromBody] GuidanceRiskReview request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.StudentName))
            return BadRequest(new { message = "Öğrenci adı gerekli." });
        var review = new GuidanceRiskReview
        {
            CounselorName = counselor.FullName,
            StudentName = request.StudentName.Trim(),
            RiskLevel = request.RiskLevel ?? "low",
            Note = request.Note ?? string.Empty,
        };
        dbContext.GuidanceRiskReviews.Add(review);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(review);
    }

    // ─── Envanterler ─────────────────────────────────────────────────────
    [HttpGet("inventories")]
    public async Task<IActionResult> GetInventories([FromQuery] string? student, CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        if (caller is null) return Unauthorized();
        var items = await dbContext.GuidanceInventories.AsNoTracking().ToListAsync(cancellationToken);
        if (IsCounselorUser(caller))
        {
            if (!string.IsNullOrWhiteSpace(student))
            {
                var normalized = Normalize(student);
                items = items.Where(i => Normalize(i.StudentName) == normalized).ToList();
            }
        }
        else
        {
            var callerName = Normalize(caller.FullName);
            items = items.Where(i => Normalize(i.StudentName) == callerName).ToList();
        }
        return Ok(items.OrderByDescending(i => i.AssignedAtUtc));
    }

    [HttpPost("inventories")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> AssignInventory([FromBody] GuidanceInventoryAssignment request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.StudentName) || string.IsNullOrWhiteSpace(request.InventoryType))
            return BadRequest(new { message = "Öğrenci ve envanter türü gerekli." });
        var item = new GuidanceInventoryAssignment
        {
            CounselorName = counselor.FullName,
            StudentName = request.StudentName.Trim(),
            InventoryType = request.InventoryType.Trim(),
        };
        dbContext.GuidanceInventories.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(item);
    }

    public sealed record CompleteInventoryRequest(string AnswersJson);

    [HttpPatch("inventories/{id:guid}/complete")]
    public async Task<IActionResult> CompleteInventory(Guid id, [FromBody] CompleteInventoryRequest request, CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        if (caller is null) return Unauthorized();
        var item = await dbContext.GuidanceInventories.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item is null) return NotFound();
        // Öğrenci yalnız kendi envanterini tamamlayabilir.
        if (!IsCounselorUser(caller) && Normalize(item.StudentName) != Normalize(caller.FullName))
            return Forbid();
        item.AnswersJson = string.IsNullOrWhiteSpace(request.AnswersJson) ? "[]" : request.AnswersJson;
        item.Status = "Tamamlandı";
        item.CompletedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(item);
    }

    // ─── Rehberin öğrenci adına çalışma programı yönetimi ────────────────
    [HttpGet("study-plan")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> GetStudyPlan([FromQuery] string student, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        if (string.IsNullOrWhiteSpace(student)) return BadRequest(new { message = "Öğrenci adı gerekli." });
        var plan = await studyPlanService.GetOrCreateAsync(student.Trim(), cancellationToken);
        return Ok(plan);
    }

    [HttpPut("study-plan")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> UpdateStudyPlan([FromBody] UpdateStudyPlanStateRequest request, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();
        if (string.IsNullOrWhiteSpace(request.StudentName))
            return BadRequest(new { message = "Öğrenci adı gerekli." });
        var plan = await studyPlanService.UpdateAsync(request, cancellationToken);
        return Ok(plan);
    }

    // ─── Veli: bağlı çocukların program uyumu + hedef + randevu özeti ────
    [HttpGet("parent/child-summary")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> GetParentChildSummary(CancellationToken cancellationToken)
    {
        var caller = await ResolveCallerAsync(cancellationToken);
        if (caller is null) return Unauthorized();
        var callerName = Normalize(caller.FullName);
        var callerUsername = Normalize(caller.Username);

        var children = (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
            .Where(s => (!string.IsNullOrWhiteSpace(s.ParentName) && Normalize(s.ParentName).Contains(callerName))
                || (!string.IsNullOrWhiteSpace(callerUsername) && Normalize(s.ParentEmail).Contains(callerUsername)))
            .ToList();

        var goals = await dbContext.GuidanceGoals.AsNoTracking().ToListAsync(cancellationToken);
        var appointments = await dbContext.GuidanceAppointments.AsNoTracking().ToListAsync(cancellationToken);

        var result = new List<object>();
        foreach (var child in children)
        {
            var plan = await studyPlanService.GetOrCreateAsync(child.FullName, cancellationToken);
            var (total, done) = CountPlanTasks(plan.PlanItemsSerialized);
            var childKey = Normalize(child.FullName);
            var goal = goals.FirstOrDefault(g => Normalize(g.StudentName) == childKey);
            result.Add(new
            {
                studentName = child.FullName,
                className = child.ClassName,
                compliance = new
                {
                    total,
                    done,
                    rate = total > 0 ? done * 100 / total : (int?)null,
                },
                goal = goal is null ? null : new
                {
                    goal.TargetSchool,
                    goal.TargetField,
                    goal.Progress,
                },
                appointments = appointments
                    .Where(a => Normalize(a.StudentName) == childKey && a.Status is "Bekliyor" or "Onaylandı")
                    .OrderByDescending(a => a.CreatedAtUtc)
                    .Select(a => new { a.Slot, a.Status, a.CounselorName })
                    .Take(5),
            });
        }
        return Ok(result);
    }

    private static (int Total, int Done) CountPlanTasks(string planItemsSerialized)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(
                string.IsNullOrWhiteSpace(planItemsSerialized) ? "[]" : planItemsSerialized);
            if (doc.RootElement.ValueKind != System.Text.Json.JsonValueKind.Array) return (0, 0);
            var total = 0;
            var done = 0;
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != System.Text.Json.JsonValueKind.Object) continue;
                var isGoal = item.TryGetProperty("type", out var type) && type.ValueKind == System.Text.Json.JsonValueKind.String && type.GetString() == "goal";
                if (isGoal) continue;
                total += 1;
                var isDone = (item.TryGetProperty("status", out var status) && status.ValueKind == System.Text.Json.JsonValueKind.String && status.GetString() == "done")
                    || (item.TryGetProperty("done", out var doneFlag) && doneFlag.ValueKind == System.Text.Json.JsonValueKind.True);
                if (isDone) done += 1;
            }
            return (total, done);
        }
        catch
        {
            return (0, 0);
        }
    }

    // ─── Sınıf raporu (not içerikleri asla dahil edilmez) ────────────────
    [HttpGet("class-report")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> GetClassReport([FromQuery] string? className, CancellationToken cancellationToken)
    {
        var counselor = await ResolveCounselorAsync(cancellationToken);
        if (counselor is null) return Forbid();

        var sessions = await dbContext.GuidanceSessions.AsNoTracking().ToListAsync(cancellationToken);
        var appointments = await dbContext.GuidanceAppointments.AsNoTracking().ToListAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(className))
        {
            var normalized = Normalize(className);
            sessions = sessions.Where(s => Normalize(s.ClassName) == normalized).ToList();
        }

        return Ok(new
        {
            totalSessions = sessions.Count,
            sessionsByTopic = sessions.GroupBy(s => s.Topic)
                .Select(g => new { topic = g.Key, count = g.Count() }).OrderByDescending(x => x.count),
            sessionsByType = sessions.GroupBy(s => s.SessionType)
                .Select(g => new { type = g.Key, count = g.Count() }).OrderByDescending(x => x.count),
            sessionsByMonth = sessions.GroupBy(s => s.SessionAtUtc.ToString("yyyy-MM"))
                .Select(g => new { month = g.Key, count = g.Count() }).OrderBy(x => x.month),
            appointments = new
            {
                total = appointments.Count,
                pending = appointments.Count(a => a.Status == "Bekliyor"),
                approved = appointments.Count(a => a.Status == "Onaylandı"),
                rejected = appointments.Count(a => a.Status == "Reddedildi"),
                completed = appointments.Count(a => a.Status == "Tamamlandı"),
            },
        });
    }
}
