using System.Text;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CourseIntellect.Infrastructure.Persistence;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reports")]
[Route("reports")]
public sealed class ReportsController(CourseIntellectDbContext dbContext) : ControllerBase
{
    public const string TeacherWeeklyReportsSectionKey = "teacher-weekly-reports";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("exam-analytics")]
    public async Task<IActionResult> GetExamAnalytics([FromQuery] string? studentName, CancellationToken cancellationToken)
    {
        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(studentName))
        {
            var normalizedStudent = CompatibilitySnapshotStore.NormalizeText(studentName);
            exams = exams.Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == normalizedStudent).ToList();
        }

        var grouped = exams
            .GroupBy(item => string.IsNullOrWhiteSpace(item.Subject) ? "Genel" : item.Subject)
            .OrderBy(group => group.Key)
            .Select(group => new
            {
                subject = group.Key,
                averageScore = group.Any() ? (int)Math.Round(group.Average(item => item.Score)) : 0,
                examCount = group.Count(),
            })
            .ToList();

        var averageScore = exams.Any() ? (int)Math.Round(exams.Average(item => item.Score)) : 0;
        var netAverage = exams.Any() ? (int)Math.Round(exams.Average(item => item.Net)) : 0;

        return Ok(new
        {
            studentName = exams.FirstOrDefault()?.StudentName ?? studentName?.Trim() ?? "Öğrenci",
            averageScore,
            netAverage,
            riskScore = Math.Clamp(100 - averageScore, 0, 100),
            examCount = exams.Count,
            strongestSubject = grouped.OrderByDescending(item => item.averageScore).FirstOrDefault()?.subject,
            weakestSubject = grouped.OrderBy(item => item.averageScore).FirstOrDefault()?.subject,
            subjects = grouped,
        });
    }

    [HttpGet("teacher-analytics")]
    public async Task<IActionResult> GetTeacherAnalytics([FromQuery] string? className, CancellationToken cancellationToken)
    {
        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
        var attendance = await dbContext.AttendanceEntries.AsNoTracking().ToListAsync(cancellationToken);
        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var homework = await dbContext.HomeworkAssignments.AsNoTracking().ToListAsync(cancellationToken);
        var submissions = await dbContext.HomeworkSubmissions.AsNoTracking().ToListAsync(cancellationToken);

        var groupedStudents = students
            .Where(item => string.IsNullOrWhiteSpace(className) || CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(className))
            .GroupBy(item => string.IsNullOrWhiteSpace(item.ClassName) ? "Tanımsız" : item.ClassName)
            .OrderBy(group => group.Key)
            .ToList();

        var classReports = groupedStudents.Select(group =>
        {
            var classStudents = group.ToList();
            var classStudentNames = classStudents.Select(item => item.FullName).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var classAttendance = attendance.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(group.Key)).ToList();
            var classExams = exams.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(group.Key)).ToList();
            var classHomework = homework.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(group.Key)).ToList();
            var classHomeworkIds = classHomework.Select(item => item.Id).ToHashSet();
            var classSubmissions = submissions.Where(item => classHomeworkIds.Contains(item.AssignmentId) && classStudentNames.Contains(item.StudentName)).ToList();

            var presentCount = classAttendance.Count(item =>
                item.Status.Contains("Kat", StringComparison.OrdinalIgnoreCase) ||
                item.Status.Contains("Present", StringComparison.OrdinalIgnoreCase));
            var attendanceRate = classAttendance.Count == 0
                ? 0
                : (int)Math.Round((double)presentCount / classAttendance.Count * 100);

            var totalAssignments = classHomework.Count;
            var completionRate = totalAssignments == 0
                ? 0
                : (int)Math.Round((double)classSubmissions.Select(item => item.AssignmentId).Distinct().Count() / totalAssignments * 100);

            var topicPerformance = classExams
                .GroupBy(item => string.IsNullOrWhiteSpace(item.Subject) ? "Genel" : item.Subject)
                .Select(subjectGroup => new
                {
                    Subject = subjectGroup.Key,
                    Average = subjectGroup.Any() ? subjectGroup.Average(item => item.Score) : 0,
                })
                .ToList();

            return new
            {
                className = group.Key,
                studentCount = classStudents.Count,
                average = classExams.Any() ? (int)Math.Round(classExams.Average(item => item.Score)) : 0,
                attendance = attendanceRate,
                completion = completionRate,
                trend = classExams.Count >= 2 ? BuildTrend(classExams) : $"+{Math.Max(1, classStudents.Count % 4)}",
                topTopic = topicPerformance.OrderByDescending(item => item.Average).FirstOrDefault()?.Subject ?? "Veri Yok",
                supportTopic = topicPerformance.OrderBy(item => item.Average).FirstOrDefault()?.Subject ?? "Veri Yok",
            };
        }).ToList();

        var scopedClasses = classReports.Select(item => item.className).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var scopedExams = exams.Where(item => scopedClasses.Count == 0 || scopedClasses.Contains(item.ClassName)).ToList();

        var topics = scopedExams
            .GroupBy(item => string.IsNullOrWhiteSpace(item.Subject) ? "Genel" : item.Subject)
            .Select(group => new
            {
                name = group.Key,
                success = group.Any() ? (int)Math.Round(group.Average(item => item.Score)) : 0,
                questionCount = group.Sum(item => Math.Max(item.Net, 0)),
                riskLevel = group.Any() && group.Average(item => item.Score) >= 80
                    ? "Düşük Risk"
                    : group.Any() && group.Average(item => item.Score) >= 65
                        ? "İzleme"
                        : "Destek Gerekli",
            })
            .OrderBy(item => item.success)
            .ToList();

        return Ok(new
        {
            classReports,
            topics,
        });
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> GetAttendance([FromQuery] string? className, CancellationToken cancellationToken)
    {
        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
        var attendance = await dbContext.AttendanceEntries.AsNoTracking().ToListAsync(cancellationToken);

        var scopedStudents = string.IsNullOrWhiteSpace(className)
            ? students
            : students.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(className)).ToList();

        var classGroups = scopedStudents
            .GroupBy(item => string.IsNullOrWhiteSpace(item.ClassName) ? "Tanımsız" : item.ClassName)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var present = attendance.Count(item =>
                    CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(group.Key) &&
                    item.Status.Contains("Kat", StringComparison.OrdinalIgnoreCase));

                var absent = attendance.Count(item =>
                    CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(group.Key) &&
                    (item.Status.Contains("Devam", StringComparison.OrdinalIgnoreCase) ||
                     item.Status.Contains("Katil", StringComparison.OrdinalIgnoreCase)));

                var totalTracked = Math.Max(group.Count(), present + absent);
                var rate = totalTracked > 0 ? (int)Math.Round((double)present / totalTracked * 100) : 0;

                return new
                {
                    className = group.Key,
                    studentCount = group.Count(),
                    presentCount = present,
                    absentCount = absent,
                    attendanceRate = rate,
                };
            })
            .ToList();

        return Ok(classGroups);
    }

    [HttpGet("performance")]
    public async Task<IActionResult> GetPerformance([FromQuery] string? className, CancellationToken cancellationToken)
    {
        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var scoped = string.IsNullOrWhiteSpace(className)
            ? exams
            : exams.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(className)).ToList();

        var result = scoped
            .GroupBy(item => string.IsNullOrWhiteSpace(item.Subject) ? "Genel" : item.Subject)
            .OrderBy(group => group.Key)
            .Select(group => new
            {
                subject = group.Key,
                examCount = group.Count(),
                averageScore = group.Any() ? Math.Round(group.Average(item => item.Score), 1) : 0,
                highestScore = group.Any() ? group.Max(item => item.Score) : 0,
                lowestScore = group.Any() ? group.Min(item => item.Score) : 0,
            })
            .ToList();

        return Ok(result);
    }

    [HttpGet("students")]
    public async Task<IActionResult> GetStudents([FromQuery] string? className, CancellationToken cancellationToken)
    {
        var students = await dbContext.Students.AsNoTracking().OrderBy(item => item.FullName).ToListAsync(cancellationToken);
        var users = await dbContext.Users.AsNoTracking().ToDictionaryAsync(item => item.Id, cancellationToken);
        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var attendance = await dbContext.AttendanceEntries.AsNoTracking().ToListAsync(cancellationToken);

        var scoped = string.IsNullOrWhiteSpace(className)
            ? students
            : students.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == CompatibilitySnapshotStore.NormalizeText(className)).ToList();

        var result = scoped.Select(student =>
        {
            var studentExams = exams.Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == CompatibilitySnapshotStore.NormalizeText(student.FullName)).ToList();
            var studentAttendance = attendance.Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == CompatibilitySnapshotStore.NormalizeText(student.FullName)).ToList();
            var present = studentAttendance.Count(item => item.Status.Contains("Kat", StringComparison.OrdinalIgnoreCase));
            var total = studentAttendance.Count;
            return new
            {
                id = student.Id,
                fullName = student.FullName,
                username = users.TryGetValue(student.UserId, out var user) ? user.Username : string.Empty,
                className = student.ClassName,
                programType = student.ProgramType,
                parentName = student.ParentName,
                parentEmail = student.ParentEmail,
                averageScore = studentExams.Any() ? Math.Round(studentExams.Average(item => item.Score), 1) : 0,
                attendanceRate = total > 0 ? (int)Math.Round((double)present / total * 100) : 0,
                status = "Aktif",
            };
        }).ToList();

        return Ok(result);
    }

    [HttpGet("teachers")]
    public async Task<IActionResult> GetTeachers(CancellationToken cancellationToken)
    {
        var teachers = await dbContext.Staff
            .AsNoTracking()
            .Where(item => item.Role == CourseIntellect.Domain.Enums.UserRole.Teacher)
            .OrderBy(item => item.FullName)
            .ToListAsync(cancellationToken);

        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);

        var result = teachers.Select(teacher =>
        {
            var classNames = ResolveAssignedClasses(teacher);
            var scopedExams = classNames.Count > 0
                ? exams.Where(item => classNames.Contains(item.ClassName, StringComparer.OrdinalIgnoreCase)).ToList()
                : [];
            var studentCount = students.Count(item => classNames.Contains(item.ClassName, StringComparer.OrdinalIgnoreCase));
            return new
            {
                id = teacher.Id,
                fullName = teacher.FullName,
                branch = teacher.DepartmentOrBranch,
                classCount = classNames.Count,
                studentCount,
                averageScore = scopedExams.Any() ? Math.Round(scopedExams.Average(item => item.Score), 1) : 0,
                status = "Aktif",
            };
        }).ToList();

        return Ok(result);
    }

    [HttpGet("teacher-weekly/bootstrap")]
    public async Task<IActionResult> GetTeacherWeeklyReportBootstrap([FromQuery] string? teacherUsername, CancellationToken cancellationToken)
    {
        var students = await dbContext.Students.AsNoTracking().OrderBy(item => item.FullName).ToListAsync(cancellationToken);
        var staff = await dbContext.Staff.AsNoTracking().ToListAsync(cancellationToken);
        var users = await dbContext.Users.AsNoTracking().ToDictionaryAsync(item => item.Id, cancellationToken);
        var exams = await dbContext.ExamResults.AsNoTracking().ToListAsync(cancellationToken);
        var homework = await dbContext.HomeworkAssignments.AsNoTracking().ToListAsync(cancellationToken);
        var contents = await dbContext.ContentItems.AsNoTracking().ToListAsync(cancellationToken);

        var teacher = staff.FirstOrDefault(item =>
            users.TryGetValue(item.UserId, out var user) &&
            !string.IsNullOrWhiteSpace(teacherUsername) &&
            CompatibilitySnapshotStore.NormalizeText(user.Username) == CompatibilitySnapshotStore.NormalizeText(teacherUsername));

        var assignedClasses = ResolveAssignedClasses(teacher);
        var scopedStudents = assignedClasses.Count == 0
            ? students
            : students.Where(item => assignedClasses.Contains(item.ClassName, StringComparer.OrdinalIgnoreCase)).ToList();

        var classes = scopedStudents
            .Select(item => item.ClassName)
            .Concat(assignedClasses)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item)
            .ToList();

        var subjects = new List<string>();
        if (!string.IsNullOrWhiteSpace(teacher?.DepartmentOrBranch))
        {
            subjects.Add(teacher.DepartmentOrBranch.Trim());
        }

        subjects.AddRange(exams.Where(item => classes.Count == 0 || classes.Contains(item.ClassName)).Select(item => item.Subject));
        subjects.AddRange(homework.Where(item => classes.Count == 0 || classes.Contains(item.ClassName)).Select(item => item.Subject));
        subjects.AddRange(contents.Where(item => classes.Count == 0 || classes.Contains(item.Grade)).Select(item => item.Subject));

        var studentItems = scopedStudents.Select(item => new
        {
            fullName = item.FullName,
            username = users.TryGetValue(item.UserId, out var user) ? user.Username : item.FullName,
            className = item.ClassName,
            parentName = item.ParentName,
            parentEmail = item.ParentEmail,
        });

        return Ok(new
        {
            classes,
            subjects = subjects
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Select(item => item.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(item => item)
                .ToList(),
            students = studentItems,
        });
    }

    [HttpPost("teacher-weekly")]
    public async Task<IActionResult> CreateTeacherWeeklyReport([FromBody] TeacherWeeklyReportCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TeacherName) ||
            string.IsNullOrWhiteSpace(request.StudentName) ||
            string.IsNullOrWhiteSpace(request.ClassName) ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.Summary))
        {
            return BadRequest(new { message = "Öğretmen, öğrenci, sınıf, ders ve rapor özeti zorunludur." });
        }

        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
        var users = await dbContext.Users.AsNoTracking().ToDictionaryAsync(item => item.Id, cancellationToken);
        var student = students.FirstOrDefault(item =>
            (!string.IsNullOrWhiteSpace(request.StudentUsername) &&
             users.TryGetValue(item.UserId, out var userByUsername) &&
             CompatibilitySnapshotStore.NormalizeText(userByUsername.Username) == CompatibilitySnapshotStore.NormalizeText(request.StudentUsername)) ||
            CompatibilitySnapshotStore.NormalizeText(item.FullName) == CompatibilitySnapshotStore.NormalizeText(request.StudentName));

        if (student is null)
        {
            return NotFound(new { message = "Seçilen öğrenci bulunamadı." });
        }

        var reports = await CompatibilitySnapshotStore.LoadListAsync<StoredTeacherWeeklyReport>(dbContext, TeacherWeeklyReportsSectionKey, cancellationToken);
        var report = new StoredTeacherWeeklyReport
        {
            Id = Guid.NewGuid(),
            TeacherUsername = request.TeacherUsername?.Trim() ?? string.Empty,
            TeacherName = request.TeacherName.Trim(),
            StudentUsername = users.TryGetValue(student.UserId, out var studentUser) ? studentUser.Username : request.StudentUsername?.Trim() ?? string.Empty,
            StudentName = student.FullName,
            ParentName = student.ParentName,
            ParentEmail = student.ParentEmail,
            ClassName = string.IsNullOrWhiteSpace(request.ClassName) ? student.ClassName : request.ClassName.Trim(),
            Subject = request.Subject.Trim(),
            Title = string.IsNullOrWhiteSpace(request.Title)
                ? $"{request.Subject.Trim()} Haftalık Gelişim Raporu"
                : request.Title.Trim(),
            Summary = request.Summary.Trim(),
            Highlights = request.Highlights?.Trim() ?? string.Empty,
            SupportNotes = request.SupportNotes?.Trim() ?? string.Empty,
            WeeklyPeriodLabel = string.IsNullOrWhiteSpace(request.WeeklyPeriodLabel) ? "Bu Hafta" : request.WeeklyPeriodLabel.Trim(),
            Attachments = (request.Attachments ?? [])
                .Where(item => !string.IsNullOrWhiteSpace(item.Url))
                .Select(item => new StoredTeacherWeeklyReportAttachment
                {
                    Name = item.Name?.Trim() ?? "Dosya",
                    Url = item.Url!.Trim(),
                    FileType = item.FileType?.Trim() ?? "Dosya",
                })
                .ToList(),
            CreatedAtUtc = DateTime.UtcNow,
        };

        reports.Add(report);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, TeacherWeeklyReportsSectionKey, reports, request.TeacherName.Trim(), cancellationToken);

        await dbContext.Notifications.AddAsync(new NotificationItem
        {
            Id = Guid.NewGuid(),
            Title = "Yeni haftalık rapor",
            Message = $"{student.FullName} için {request.Subject.Trim()} haftalık raporu veli paneline gönderildi.",
            Audience = "Parent",
            TargetRole = "Parent",
            Category = "WeeklyReport",
            TimeLabel = "Şimdi",
            IsRead = false,
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToTeacherWeeklyReportResponse(report));
    }

    [HttpGet("teacher-weekly/teacher")]
    public async Task<IActionResult> GetTeacherWeeklyReportsForTeacher([FromQuery] string? teacherUsername, [FromQuery] string? teacherName, CancellationToken cancellationToken)
    {
        var reports = await CompatibilitySnapshotStore.LoadListAsync<StoredTeacherWeeklyReport>(dbContext, TeacherWeeklyReportsSectionKey, cancellationToken);
        var filtered = reports
            .Where(item =>
                (string.IsNullOrWhiteSpace(teacherUsername) || CompatibilitySnapshotStore.NormalizeText(item.TeacherUsername) == CompatibilitySnapshotStore.NormalizeText(teacherUsername)) &&
                (string.IsNullOrWhiteSpace(teacherName) || CompatibilitySnapshotStore.NormalizeText(item.TeacherName) == CompatibilitySnapshotStore.NormalizeText(teacherName)))
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(ToTeacherWeeklyReportResponse)
            .ToList();

        return Ok(filtered);
    }

    [HttpGet("teacher-weekly/parent")]
    public async Task<IActionResult> GetTeacherWeeklyReportsForParent(
        [FromQuery] string? studentName,
        [FromQuery] string? studentUsername,
        [FromQuery] string? parentName,
        [FromQuery] string? parentEmail,
        CancellationToken cancellationToken)
    {
        var reports = await CompatibilitySnapshotStore.LoadListAsync<StoredTeacherWeeklyReport>(dbContext, TeacherWeeklyReportsSectionKey, cancellationToken);
        var filtered = reports
            .Where(item =>
                (string.IsNullOrWhiteSpace(studentUsername) || CompatibilitySnapshotStore.NormalizeText(item.StudentUsername) == CompatibilitySnapshotStore.NormalizeText(studentUsername)) &&
                (string.IsNullOrWhiteSpace(studentName) || CompatibilitySnapshotStore.NormalizeText(item.StudentName) == CompatibilitySnapshotStore.NormalizeText(studentName)) &&
                (string.IsNullOrWhiteSpace(parentName) || CompatibilitySnapshotStore.NormalizeText(item.ParentName) == CompatibilitySnapshotStore.NormalizeText(parentName)) &&
                (string.IsNullOrWhiteSpace(parentEmail) || CompatibilitySnapshotStore.NormalizeText(item.ParentEmail) == CompatibilitySnapshotStore.NormalizeText(parentEmail)))
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(ToTeacherWeeklyReportResponse)
            .ToList();

        return Ok(filtered);
    }

    [HttpGet("{type}/export")]
    public async Task<IActionResult> Export(string type, [FromQuery] string? className, CancellationToken cancellationToken)
    {
        var normalizedType = type.Trim().ToLowerInvariant();
        var rows = normalizedType switch
        {
            "attendance" => await BuildAttendanceExportRows(className, cancellationToken),
            "performance" => await BuildPerformanceExportRows(className, cancellationToken),
            "students" => await BuildStudentExportRows(className, cancellationToken),
            "teachers" => await BuildTeacherExportRows(cancellationToken),
            _ => null,
        };

        if (rows is null)
        {
            return NotFound();
        }

        var csv = string.Join('\n', rows.Select(row => string.Join(',', row.Select(EscapeCsv))));
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
        return File(bytes, "text/csv", $"reports-{normalizedType}.csv");
    }

    private async Task<List<string[]>> BuildAttendanceExportRows(string? className, CancellationToken cancellationToken)
    {
        var data = await GetAttendance(className, cancellationToken) as OkObjectResult;
        var items = (data?.Value as IEnumerable<object>)?.ToList() ?? [];
        var rows = new List<string[]> { new[] { "Class", "StudentCount", "Present", "Absent", "AttendanceRate" } };
        foreach (var item in items)
        {
            var map = item.GetType().GetProperties().ToDictionary(x => x.Name, x => x.GetValue(item)?.ToString() ?? string.Empty);
            rows.Add(new[]
            {
                map.GetValueOrDefault("className", string.Empty),
                map.GetValueOrDefault("studentCount", "0"),
                map.GetValueOrDefault("presentCount", "0"),
                map.GetValueOrDefault("absentCount", "0"),
                map.GetValueOrDefault("attendanceRate", "0"),
            });
        }

        return rows;
    }

    private async Task<List<string[]>> BuildPerformanceExportRows(string? className, CancellationToken cancellationToken)
    {
        var data = await GetPerformance(className, cancellationToken) as OkObjectResult;
        var items = (data?.Value as IEnumerable<object>)?.ToList() ?? [];
        var rows = new List<string[]> { new[] { "Subject", "ExamCount", "AverageScore", "HighestScore", "LowestScore" } };
        foreach (var item in items)
        {
            var map = item.GetType().GetProperties().ToDictionary(x => x.Name, x => x.GetValue(item)?.ToString() ?? string.Empty);
            rows.Add(new[]
            {
                map.GetValueOrDefault("subject", string.Empty),
                map.GetValueOrDefault("examCount", "0"),
                map.GetValueOrDefault("averageScore", "0"),
                map.GetValueOrDefault("highestScore", "0"),
                map.GetValueOrDefault("lowestScore", "0"),
            });
        }

        return rows;
    }

    private async Task<List<string[]>> BuildStudentExportRows(string? className, CancellationToken cancellationToken)
    {
        var data = await GetStudents(className, cancellationToken) as OkObjectResult;
        var items = (data?.Value as IEnumerable<object>)?.ToList() ?? [];
        var rows = new List<string[]> { new[] { "FullName", "Username", "Class", "ProgramType", "ParentName", "ParentEmail", "AverageScore", "AttendanceRate", "Status" } };
        foreach (var item in items)
        {
            var map = item.GetType().GetProperties().ToDictionary(x => x.Name, x => x.GetValue(item)?.ToString() ?? string.Empty);
            rows.Add(new[]
            {
                map.GetValueOrDefault("fullName", string.Empty),
                map.GetValueOrDefault("username", string.Empty),
                map.GetValueOrDefault("className", string.Empty),
                map.GetValueOrDefault("programType", string.Empty),
                map.GetValueOrDefault("parentName", string.Empty),
                map.GetValueOrDefault("parentEmail", string.Empty),
                map.GetValueOrDefault("averageScore", "0"),
                map.GetValueOrDefault("attendanceRate", "0"),
                map.GetValueOrDefault("status", string.Empty),
            });
        }

        return rows;
    }

    private async Task<List<string[]>> BuildTeacherExportRows(CancellationToken cancellationToken)
    {
        var data = await GetTeachers(cancellationToken) as OkObjectResult;
        var items = (data?.Value as IEnumerable<object>)?.ToList() ?? [];
        var rows = new List<string[]> { new[] { "FullName", "Branch", "ClassCount", "StudentCount", "AverageScore", "Status" } };
        foreach (var item in items)
        {
            var map = item.GetType().GetProperties().ToDictionary(x => x.Name, x => x.GetValue(item)?.ToString() ?? string.Empty);
            rows.Add(new[]
            {
                map.GetValueOrDefault("fullName", string.Empty),
                map.GetValueOrDefault("branch", string.Empty),
                map.GetValueOrDefault("classCount", "0"),
                map.GetValueOrDefault("studentCount", "0"),
                map.GetValueOrDefault("averageScore", "0"),
                map.GetValueOrDefault("status", string.Empty),
            });
        }

        return rows;
    }

    private static string BuildTrend(List<ExamResult> exams)
    {
        if (exams.Count < 2)
        {
            return "+0";
        }

        var ordered = exams
            .OrderBy(item => CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel))
            .ToList();
        var first = ordered.First().Score;
        var last = ordered.Last().Score;
        var diff = last - first;
        return $"{(diff >= 0 ? "+" : string.Empty)}{diff}";
    }

    private static List<string> ResolveAssignedClasses(StaffProfile? teacher)
    {
        if (teacher is null)
        {
            return [];
        }

        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(teacher.HomeroomClass))
        {
            result.Add(teacher.HomeroomClass.Trim());
        }

        foreach (var item in teacher.AssignedClasses.Where(item => !string.IsNullOrWhiteSpace(item)))
        {
            result.Add(item.Trim());
        }

        return result.ToList();
    }

    private static object ToTeacherWeeklyReportResponse(StoredTeacherWeeklyReport report)
    {
        return new
        {
            id = report.Id,
            teacherUsername = report.TeacherUsername,
            teacherName = report.TeacherName,
            studentUsername = report.StudentUsername,
            studentName = report.StudentName,
            parentName = report.ParentName,
            parentEmail = report.ParentEmail,
            className = report.ClassName,
            subject = report.Subject,
            title = report.Title,
            summary = report.Summary,
            highlights = report.Highlights,
            supportNotes = report.SupportNotes,
            weeklyPeriodLabel = report.WeeklyPeriodLabel,
            createdAtUtc = report.CreatedAtUtc,
            attachments = report.Attachments.Select(item => new
            {
                name = item.Name,
                url = item.Url,
                fileType = item.FileType,
            }).ToList(),
        };
    }

    private static string EscapeCsv(string input)
    {
        var value = input.Replace("\"", "\"\"");
        return $"\"{value}\"";
    }

    public sealed class TeacherWeeklyReportCreateRequest
    {
        public string? TeacherUsername { get; set; }
        public string TeacherName { get; set; } = string.Empty;
        public string? StudentUsername { get; set; }
        public string StudentName { get; set; } = string.Empty;
        public string ClassName { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string Summary { get; set; } = string.Empty;
        public string? Highlights { get; set; }
        public string? SupportNotes { get; set; }
        public string? WeeklyPeriodLabel { get; set; }
        public List<TeacherWeeklyReportAttachmentRequest>? Attachments { get; set; }
    }

    public sealed class TeacherWeeklyReportAttachmentRequest
    {
        public string? Name { get; set; }
        public string? Url { get; set; }
        public string? FileType { get; set; }
    }

    public sealed class StoredTeacherWeeklyReport
    {
        public Guid Id { get; set; }
        public string TeacherUsername { get; set; } = string.Empty;
        public string TeacherName { get; set; } = string.Empty;
        public string StudentUsername { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string ParentName { get; set; } = string.Empty;
        public string ParentEmail { get; set; } = string.Empty;
        public string ClassName { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string Highlights { get; set; } = string.Empty;
        public string SupportNotes { get; set; } = string.Empty;
        public string WeeklyPeriodLabel { get; set; } = "Bu Hafta";
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public List<StoredTeacherWeeklyReportAttachment> Attachments { get; set; } = [];
    }

    public sealed class StoredTeacherWeeklyReportAttachment
    {
        public string Name { get; set; } = "Dosya";
        public string Url { get; set; } = string.Empty;
        public string FileType { get; set; } = "Dosya";
    }
}
