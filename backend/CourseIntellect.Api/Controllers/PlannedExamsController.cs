using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Text.Json;
using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/plannedexams")]
public sealed class PlannedExamsController(
    CourseIntellectDbContext dbContext,
    IAttendanceService attendanceService) : ControllerBase
{
    public const string SectionKey = "planned-exams";

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? className = null,
        [FromQuery] string? teacherName = null,
        [FromQuery] string? studentName = null,
        [FromQuery] string? studentUsername = null,
        CancellationToken cancellationToken = default)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        items = items
            .OrderBy(item => CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel))
            .ThenByDescending(item => item.CreatedAtUtc)
            .ToList();

        if (!string.IsNullOrWhiteSpace(teacherName))
        {
            var normalizedTeacher = CompatibilitySnapshotStore.NormalizeText(teacherName);
            items = items.Where(item => CompatibilitySnapshotStore.NormalizeText(item.TeacherName) == normalizedTeacher).ToList();
        }

        var classCandidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(className))
        {
            classCandidates.Add(className);
        }

        if (!string.IsNullOrWhiteSpace(studentName) || !string.IsNullOrWhiteSpace(studentUsername))
        {
            var users = await dbContext.Users.AsNoTracking().ToDictionaryAsync(item => item.Id, cancellationToken);
            var studentProfiles = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
            var students = studentProfiles.Select(item => new
            {
                item.FullName,
                Username = users.TryGetValue(item.UserId, out var user) ? user.Username : string.Empty,
                item.ClassName,
            }).ToList();

            var normalizedStudent = CompatibilitySnapshotStore.NormalizeText(studentName);
            var normalizedUsername = CompatibilitySnapshotStore.NormalizeText(studentUsername);
            var matchedClass = students
                .FirstOrDefault(item =>
                    (!string.IsNullOrWhiteSpace(normalizedStudent) && CompatibilitySnapshotStore.NormalizeText(item.FullName) == normalizedStudent) ||
                    (!string.IsNullOrWhiteSpace(normalizedUsername) && CompatibilitySnapshotStore.NormalizeText(item.Username) == normalizedUsername))
                ?.ClassName;

            if (!string.IsNullOrWhiteSpace(matchedClass))
            {
                classCandidates.Add(matchedClass);
            }
        }

        if (classCandidates.Count > 0)
        {
            items = items
                .Where(item => ClassMatchesAny(item.ClassName, classCandidates))
                .ToList();
        }

        return Ok(items.Select(MapResponse).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PlannedExamCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.Type) ||
            string.IsNullOrWhiteSpace(request.ClassName) ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.DateLabel) ||
            string.IsNullOrWhiteSpace(request.Duration))
        {
            return BadRequest(new { message = "Başlık, tür, sınıf, ders, tarih ve süre zorunludur." });
        }

        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var item = new PlannedExamSnapshot
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Type = request.Type.Trim(),
            ClassName = request.ClassName.Trim(),
            Subject = request.Subject.Trim(),
            DateLabel = request.DateLabel.Trim(),
            StartTime = request.StartTime?.Trim() ?? string.Empty,
            EndTime = request.EndTime?.Trim() ?? string.Empty,
            Duration = request.Duration.Trim(),
            LateEntryLimitMinutes = request.LateEntryLimitMinutes <= 0 ? 5 : request.LateEntryLimitMinutes,
            LiveLinkUrl = request.LiveLinkUrl?.Trim() ?? string.Empty,
            RequireCamera = request.RequireCamera,
            RequireFullscreen = request.RequireFullscreen,
            BlockTabChange = request.BlockTabChange,
            BlockCopyPaste = request.BlockCopyPaste,
            TotalPoint = request.TotalPoint <= 0 ? 100 : request.TotalPoint,
            QuestionCount = request.QuestionCount,
            Status = "Planlandı",
            TeacherName = request.TeacherName?.Trim() ?? "Öğretmen",
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? "Manuel Ekle" : request.SourceType.Trim(),
            Sources = (request.Sources ?? []).Select(item => new PlannedExamSourceSnapshot
            {
                QuestionId = item.QuestionId,
                Title = item.Title?.Trim() ?? string.Empty,
                Type = item.Type?.Trim() ?? string.Empty,
                Subject = item.Subject?.Trim(),
                ImagePath = item.ImagePath?.Trim(),
                ImagePlacement = item.ImagePlacement?.Trim(),
            }).ToList(),
            CreatedAtUtc = DateTime.UtcNow,
        };

        items.Add(item);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, items, item.TeacherName, cancellationToken);
        return Ok(MapResponse(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var removed = items.RemoveAll(item => item.Id == id);
        if (removed == 0)
        {
            return NotFound();
        }

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, items, User.Identity?.Name ?? "system", cancellationToken);
        return NoContent();
    }

    // Öğrenci canlı yayına/kameraya girdiğinde otomatik yoklama check-in'i yapar.
    [HttpPost("{id:guid}/checkin")]
    public async Task<IActionResult> CheckIn(Guid id, [FromBody] PlannedExamCheckInRequest request, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var plannedExam = items.FirstOrDefault(item => item.Id == id);
        if (plannedExam is null)
        {
            return NotFound();
        }

        var username = FirstNonEmpty(request.StudentUsername, CurrentUsername());
        var studentName = request.StudentName?.Trim() ?? string.Empty;

        Guid? userId = null;
        string className = request.ClassName?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(username))
        {
            var user = await dbContext.Users.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Username == username, cancellationToken);
            if (user is not null)
            {
                userId = user.Id;
                var profile = await dbContext.Students.AsNoTracking()
                    .FirstOrDefaultAsync(item => item.UserId == user.Id, cancellationToken);
                if (profile is not null)
                {
                    if (string.IsNullOrWhiteSpace(studentName)) studentName = profile.FullName;
                    if (string.IsNullOrWhiteSpace(className)) className = profile.ClassName;
                }
            }
        }

        var entry = plannedExam.Attendance.FirstOrDefault(item =>
            (userId is not null && item.StudentUserId == userId) ||
            (!string.IsNullOrWhiteSpace(username) &&
                string.Equals(item.StudentUsername, username, StringComparison.OrdinalIgnoreCase)));

        if (entry is null)
        {
            entry = new PlannedExamAttendanceEntry();
            plannedExam.Attendance.Add(entry);
        }

        entry.StudentUserId = userId ?? entry.StudentUserId;
        entry.StudentUsername = FirstNonEmpty(username, entry.StudentUsername);
        entry.StudentName = FirstNonEmpty(studentName, entry.StudentName);
        entry.ClassName = FirstNonEmpty(className, entry.ClassName);
        entry.JoinedLive = entry.JoinedLive || request.JoinedLive;
        entry.CameraReady = entry.CameraReady || request.CameraReady;
        entry.CheckedInAtUtc ??= DateTime.UtcNow;
        entry.UpdatedAtUtc = DateTime.UtcNow;
        if (!entry.ManualOverride)
        {
            entry.Status = ResolveCheckInStatus(plannedExam, entry.CheckedInAtUtc.Value);
        }

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, items, username, cancellationToken);
        return Ok(MapAttendanceEntry(entry));
    }

    // Öğretmen: planlı sınavın yoklama listesi (check-in yapanlar + sınıf öğrencileri).
    [HttpGet("{id:guid}/attendance")]
    [Authorize(Roles = "Teacher,Admin,InstitutionAdmin,Idare,Administrative")]
    public async Task<IActionResult> GetAttendance(Guid id, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var plannedExam = items.FirstOrDefault(item => item.Id == id);
        if (plannedExam is null)
        {
            return NotFound();
        }

        var roster = plannedExam.Attendance
            .Select(MapAttendanceEntry)
            .ToList();

        var seenUsernames = plannedExam.Attendance
            .Select(item => CompatibilitySnapshotStore.NormalizeText(item.StudentUsername))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToHashSet();
        var seenNames = plannedExam.Attendance
            .Select(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToHashSet();

        // Sınıfın henüz giriş yapmamış öğrencilerini "Yok" olarak ekle.
        var users = await dbContext.Users.AsNoTracking().ToDictionaryAsync(item => item.Id, cancellationToken);
        var students = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
        foreach (var profile in students)
        {
            if (!ClassMatchesAny(plannedExam.ClassName, new[] { profile.ClassName }))
            {
                continue;
            }

            var username = users.TryGetValue(profile.UserId, out var user) ? user.Username : string.Empty;
            if (seenUsernames.Contains(CompatibilitySnapshotStore.NormalizeText(username)) ||
                seenNames.Contains(CompatibilitySnapshotStore.NormalizeText(profile.FullName)))
            {
                continue;
            }

            roster.Add(new
            {
                studentUserId = (Guid?)profile.UserId,
                studentUsername = username,
                studentName = profile.FullName,
                className = profile.ClassName,
                joinedLive = false,
                cameraReady = false,
                checkedInAtUtc = (DateTime?)null,
                status = "Absent",
                manualOverride = false,
                updatedAtUtc = (DateTime?)null,
            });
        }

        return Ok(roster
            .OrderByDescending(item => GetCheckedInAtUtc(item) ?? DateTime.MinValue)
            .ToList());
    }

    // Öğretmen yoklama durumunu manuel düzeltir (Var/Yok/Geç).
    [HttpPost("{id:guid}/attendance")]
    [Authorize(Roles = "Teacher,Admin,InstitutionAdmin,Idare,Administrative")]
    public async Task<IActionResult> SaveAttendance(Guid id, [FromBody] SavePlannedExamAttendanceRequest request, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var plannedExam = items.FirstOrDefault(item => item.Id == id);
        if (plannedExam is null)
        {
            return NotFound();
        }

        foreach (var update in request.Entries ?? [])
        {
            var username = update.StudentUsername?.Trim() ?? string.Empty;
            var name = update.StudentName?.Trim() ?? string.Empty;
            var entry = plannedExam.Attendance.FirstOrDefault(item =>
                (update.StudentUserId is not null && item.StudentUserId == update.StudentUserId) ||
                (!string.IsNullOrWhiteSpace(username) && string.Equals(item.StudentUsername, username, StringComparison.OrdinalIgnoreCase)) ||
                (!string.IsNullOrWhiteSpace(name) && string.Equals(item.StudentName, name, StringComparison.OrdinalIgnoreCase)));

            if (entry is null)
            {
                entry = new PlannedExamAttendanceEntry
                {
                    StudentUserId = update.StudentUserId,
                    StudentUsername = username,
                    StudentName = name,
                    ClassName = update.ClassName?.Trim() ?? string.Empty,
                };
                plannedExam.Attendance.Add(entry);
            }

            entry.Status = string.IsNullOrWhiteSpace(update.Status) ? entry.Status : update.Status.Trim();
            entry.ManualOverride = true;
            entry.UpdatedAtUtc = DateTime.UtcNow;
        }

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, items, User.Identity?.Name ?? "system", cancellationToken);

        // Sınav yoklamasını genel devamsızlık modülüne de yaz (sınıf bazında).
        await MirrorAttendanceToGeneralModuleAsync(plannedExam, request.Entries ?? [], cancellationToken);

        return Ok(plannedExam.Attendance.Select(MapAttendanceEntry).ToList());
    }

    private async Task MirrorAttendanceToGeneralModuleAsync(
        PlannedExamSnapshot plannedExam,
        IReadOnlyList<PlannedExamAttendanceUpdate> entries,
        CancellationToken cancellationToken)
    {
        var lessonLabel = $"Sınav: {plannedExam.Title}".Trim();
        var lessonDate = CompatibilitySnapshotStore.ParseDateLabel(plannedExam.DateLabel).Date;

        var byClass = entries
            .Where(entry => !string.IsNullOrWhiteSpace(entry.StudentName) && !string.IsNullOrWhiteSpace(entry.ClassName))
            .GroupBy(entry => entry.ClassName!.Trim());

        foreach (var group in byClass)
        {
            var students = group
                .Select(entry => new SaveAttendanceStudentRequest(
                    entry.StudentName!.Trim(),
                    MapExamStatusToAttendance(entry.Status)))
                .ToList();

            await attendanceService.SaveLessonAttendanceAsync(
                new SaveAttendanceRequest(group.Key, lessonLabel, lessonDate, students),
                cancellationToken);
        }
    }

    private static string MapExamStatusToAttendance(string? status) => (status ?? string.Empty).Trim() switch
    {
        "Present" => "present",
        "Late" => "late",
        _ => "absent",
    };

    [HttpGet("{id:guid}/submissions")]
    public async Task<IActionResult> GetSubmissions(Guid id, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var plannedExam = items.FirstOrDefault(item => item.Id == id);
        if (plannedExam is null)
        {
            return NotFound();
        }

        var normalizedTitle = CompatibilitySnapshotStore.NormalizeText(plannedExam.Title);
        var normalizedClass = CompatibilitySnapshotStore.NormalizeText(plannedExam.ClassName);
        var normalizedSubject = CompatibilitySnapshotStore.NormalizeText(plannedExam.Subject);

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<ExamSessionSnapshot>(dbContext, ExamSessionsController.SectionKey, cancellationToken);
        var response = sessions
            .Where(item =>
                item.Status == "Completed" &&
                (item.PlannedExamId == plannedExam.Id ||
                    (item.PlannedExamId is null &&
                        CompatibilitySnapshotStore.NormalizeText(item.ExamTitle) == normalizedTitle &&
                        CompatibilitySnapshotStore.NormalizeText(item.ClassName) == normalizedClass &&
                        CompatibilitySnapshotStore.NormalizeText(item.Subject) == normalizedSubject)))
            .OrderByDescending(item => item.CompletedAtUtc ?? item.StartedAtUtc)
            .Select(MapSubmission)
            .ToList<object>();

        var solutionSubmissions = await LoadSolutionSubmissionsAsync(plannedExam.Id, cancellationToken);
        response.AddRange(solutionSubmissions);
        response = response
            .OrderByDescending(item => GetSubmittedAtUtc(item) ?? DateTime.MinValue)
            .ToList();

        if (response.Count == 0)
        {
            var results = await dbContext.ExamResults
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            response = results
                .Where(item =>
                    CompatibilitySnapshotStore.NormalizeText(item.ExamTitle) == normalizedTitle &&
                    CompatibilitySnapshotStore.NormalizeText(item.ClassName) == normalizedClass &&
                    CompatibilitySnapshotStore.NormalizeText(item.Subject) == normalizedSubject)
                .OrderByDescending(item => CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel))
                .Select(item => (object)new
                {
                    id = item.Id,
                    sessionId = (Guid?)null,
                    studentName = item.StudentName,
                    studentUsername = string.Empty,
                    score = item.Score,
                    net = item.Net,
                    correct = (int?)null,
                    wrong = 0,
                    blank = 0,
                    total = (int?)null,
                    submittedAtUtc = CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel),
                    status = "Teslim Edildi",
                    answers = Array.Empty<object>(),
                })
                .ToList();
        }

        return Ok(response);
    }

    private async Task<List<object>> LoadSolutionSubmissionsAsync(Guid plannedExamId, CancellationToken cancellationToken)
    {
        var solutionSessions = await dbContext.ExamSessions
            .AsNoTracking()
            .Where(item => item.PlannedExamId == plannedExamId && item.Status == "Completed")
            .OrderByDescending(item => item.CompletedAtUtc ?? item.StartedAtUtc)
            .ToListAsync(cancellationToken);

        if (solutionSessions.Count == 0)
        {
            return [];
        }

        var sessionIds = solutionSessions.Select(item => item.Id).ToHashSet();
        var attempts = await dbContext.QuestionAttempts
            .AsNoTracking()
            .Where(item => sessionIds.Contains(item.ExamSessionId))
            .OrderBy(item => item.SortOrder)
            .ToListAsync(cancellationToken);
        var attemptIds = attempts.Select(item => item.Id).ToHashSet();
        var questionIds = attempts.Select(item => item.QuestionBankItemId).ToHashSet();
        var questions = await dbContext.QuestionBankItems
            .AsNoTracking()
            .Where(item => questionIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);
        var latestAnswers = (await dbContext.AnswerSelections
                .AsNoTracking()
                .Where(item => attemptIds.Contains(item.QuestionAttemptId))
                .ToListAsync(cancellationToken))
            .GroupBy(item => item.QuestionAttemptId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderByDescending(item => item.SavedAtUtc).First());
        var attemptsBySession = attempts
            .GroupBy(item => item.ExamSessionId)
            .ToDictionary(group => group.Key, group => group.ToList());

        return solutionSessions
            .Select(session => MapSolutionSubmission(
                session,
                attemptsBySession.GetValueOrDefault(session.Id) ?? [],
                questions,
                latestAnswers))
            .ToList<object>();
    }

    private static object MapSubmission(ExamSessionSnapshot session)
    {
        var total = session.Questions.Count;
        var answered = session.Questions.Count(item => item.Answer is not null);
        var correct = session.Questions.Count(item => item.Answer?.IsCorrect == true);
        var wrong = answered - correct;
        var blank = total - answered;
        var score = total == 0 ? 0 : (int)Math.Round((double)correct / total * 100, MidpointRounding.AwayFromZero);

        var approvalStatus = string.IsNullOrWhiteSpace(session.ApprovalStatus)
            ? (session.RecordedExamResultId.HasValue ? "Approved" : "Pending")
            : session.ApprovalStatus;

        return new
        {
            id = session.RecordedExamResultId ?? session.Id,
            sessionId = session.Id,
            studentName = session.StudentName,
            studentUsername = session.StudentUsername,
            score,
            net = correct,
            correct,
            wrong,
            blank,
            total,
            submittedAtUtc = session.CompletedAtUtc ?? session.StartedAtUtc,
            status = approvalStatus == "Pending" ? "Onay Bekliyor" : "Teslim Edildi",
            approvalStatus,
            answers = session.Questions
                .OrderBy(item => item.SortOrder)
                .Select(item =>
                {
                    var selectedOptionIndex = item.Answer?.SelectedOptionIndex;
                    var correctOptionIndex = item.CorrectOptionIndex;
                    return new
                    {
                        questionId = item.Id,
                        questionBankItemId = item.QuestionBankItemId,
                        sortOrder = item.SortOrder,
                        subject = item.Subject,
                        topic = item.Topic,
                        questionText = item.QuestionText,
                        options = item.Options,
                        selectedOptionIndex,
                        selectedAnswerText = selectedOptionIndex.HasValue && selectedOptionIndex.Value >= 0 && selectedOptionIndex.Value < item.Options.Count
                            ? item.Options[selectedOptionIndex.Value]
                            : string.Empty,
                        correctOptionIndex,
                        correctAnswerText = correctOptionIndex >= 0 && correctOptionIndex < item.Options.Count
                            ? item.Options[correctOptionIndex]
                            : string.Empty,
                        isCorrect = item.Answer?.IsCorrect,
                        answeredAtUtc = item.Answer?.AnsweredAtUtc,
                    };
                })
                .ToList(),
        };
    }

    private static object MapSolutionSubmission(
        ExamSession session,
        IReadOnlyList<QuestionAttempt> attempts,
        IReadOnlyDictionary<Guid, QuestionBankItem> questions,
        IReadOnlyDictionary<Guid, AnswerSelection> answers)
    {
        var answered = attempts.Count(item => answers.ContainsKey(item.Id));
        var correct = attempts.Count(item => answers.TryGetValue(item.Id, out var answer) && answer.IsCorrect);
        var wrong = answered - correct;
        var blank = attempts.Count - answered;
        var score = attempts.Count == 0 ? 0 : (int)Math.Round((double)correct / attempts.Count * 100, MidpointRounding.AwayFromZero);

        return new
        {
            id = session.Id,
            sessionId = session.Id,
            studentName = session.StudentName,
            studentUsername = session.StudentUsername,
            score,
            net = correct,
            correct,
            wrong,
            blank,
            total = attempts.Count,
            submittedAtUtc = session.CompletedAtUtc ?? session.StartedAtUtc,
            status = "Onay Bekliyor",
            approvalStatus = "Pending",
            answers = attempts
                .OrderBy(item => item.SortOrder)
                .Select(attempt =>
                {
                    questions.TryGetValue(attempt.QuestionBankItemId, out var question);
                    answers.TryGetValue(attempt.Id, out var answer);
                    var options = CompatibilitySnapshotStore.DeserializeStringList(question?.OptionsSerialized);
                    var selectedOptionIndex = answer?.SelectedOptionIndex;
                    var correctOptionIndex = question?.CorrectOptionIndex ?? 0;
                    return new
                    {
                        questionId = attempt.Id,
                        questionBankItemId = attempt.QuestionBankItemId,
                        sortOrder = attempt.SortOrder,
                        subject = question?.Subject ?? session.Subject,
                        topic = question?.Topic ?? string.Empty,
                        questionText = question?.QuestionText ?? string.Empty,
                        options,
                        selectedOptionIndex,
                        selectedAnswerText = selectedOptionIndex.HasValue && selectedOptionIndex.Value >= 0 && selectedOptionIndex.Value < options.Count
                            ? options[selectedOptionIndex.Value]
                            : answer?.OpenAnswer ?? string.Empty,
                        correctOptionIndex,
                        correctAnswerText = correctOptionIndex >= 0 && correctOptionIndex < options.Count
                            ? options[correctOptionIndex]
                            : question?.ExpectedAnswer ?? string.Empty,
                        isCorrect = answer?.IsCorrect,
                        answeredAtUtc = answer?.SavedAtUtc,
                    };
                })
                .ToList(),
        };
    }

    private static DateTime? GetSubmittedAtUtc(object item)
    {
        var property = item.GetType().GetProperty("submittedAtUtc");
        var value = property?.GetValue(item);
        return value is DateTime date ? date : null;
    }

    private string CurrentUsername()
    {
        return User.FindFirstValue("unique_name")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.Identity?.Name
            ?? string.Empty;
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return string.Empty;
    }

    private static string ResolveCheckInStatus(PlannedExamSnapshot plannedExam, DateTime checkedInAtUtc)
    {
        if (TryResolvePlannedStartUtc(plannedExam, out var startsAtUtc) && checkedInAtUtc > startsAtUtc.AddMinutes(1))
        {
            return "Late";
        }

        return "Present";
    }

    private static bool TryResolvePlannedStartUtc(PlannedExamSnapshot plannedExam, out DateTime startsAtUtc)
    {
        var dateLabel = plannedExam.DateLabel ?? string.Empty;
        var hasTimeInDate = Regex.IsMatch(dateLabel, @"\d{1,2}:\d{2}");
        var combined = !hasTimeInDate && !string.IsNullOrWhiteSpace(plannedExam.StartTime)
            ? $"{dateLabel} {plannedExam.StartTime}"
            : dateLabel;
        return ExamSessionsController.TryResolvePlannedStartUtc(combined, out startsAtUtc);
    }

    private static object MapAttendanceEntry(PlannedExamAttendanceEntry entry)
    {
        return new
        {
            studentUserId = entry.StudentUserId,
            studentUsername = entry.StudentUsername,
            studentName = entry.StudentName,
            className = entry.ClassName,
            joinedLive = entry.JoinedLive,
            cameraReady = entry.CameraReady,
            checkedInAtUtc = entry.CheckedInAtUtc,
            status = entry.Status,
            manualOverride = entry.ManualOverride,
            updatedAtUtc = (DateTime?)entry.UpdatedAtUtc,
        };
    }

    private static DateTime? GetCheckedInAtUtc(object item)
    {
        var property = item.GetType().GetProperty("checkedInAtUtc");
        var value = property?.GetValue(item);
        return value is DateTime date ? date : null;
    }

    private static object MapResponse(PlannedExamSnapshot item)
    {
        return new
        {
            id = item.Id,
            title = item.Title,
            type = item.Type,
            className = item.ClassName,
            subject = item.Subject,
            date = item.DateLabel,
            dateLabel = item.DateLabel,
            startTime = item.StartTime,
            endTime = item.EndTime,
            duration = item.Duration,
            lateEntryLimitMinutes = item.LateEntryLimitMinutes,
            liveLinkUrl = item.LiveLinkUrl,
            requireCamera = item.RequireCamera,
            requireFullscreen = item.RequireFullscreen,
            blockTabChange = item.BlockTabChange,
            blockCopyPaste = item.BlockCopyPaste,
            totalPoint = item.TotalPoint,
            questionCount = item.QuestionCount,
            status = item.Status,
            teacherName = item.TeacherName,
            sourceType = item.SourceType,
            sources = item.Sources.Select(source => new
            {
                questionId = source.QuestionId,
                title = source.Title,
                type = source.Type,
                subject = source.Subject,
                imagePath = source.ImagePath,
                imagePlacement = source.ImagePlacement,
            }).ToList(),
        };
    }

    private static bool ClassMatchesAny(string examClassName, IReadOnlyCollection<string> classCandidates)
    {
        if (IsAllClasses(examClassName))
        {
            return true;
        }

        return SplitClassTargets(examClassName).Any(target =>
        {
            var targetKey = NormalizeClassKey(target);
            if (string.IsNullOrWhiteSpace(targetKey))
            {
                return false;
            }

            return classCandidates.Any(candidate =>
                targetKey == NormalizeClassKey(candidate) ||
                CompatibilitySnapshotStore.NormalizeText(target) == CompatibilitySnapshotStore.NormalizeText(candidate));
        });
    }

    private static IEnumerable<string> SplitClassTargets(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            yield break;
        }

        foreach (var target in value.Split(new[] { ',', ';', '|', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            yield return target;
        }
    }

    private static bool IsAllClasses(string value)
    {
        var key = NormalizeClassKey(value);
        return key is "tum" or "hepsi" or "all" or "allsiniflar" or "tumsiniflar" or "tumsinif";
    }

    private static string NormalizeClassKey(string? value)
    {
        var normalized = CompatibilitySnapshotStore.NormalizeText(value);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return string.Empty;
        }

        normalized = normalized
            .Replace(".", string.Empty)
            .Replace("/", string.Empty)
            .Replace("_", string.Empty)
            .Replace("siniflar", string.Empty)
            .Replace("sinifi", string.Empty)
            .Replace("sinif", string.Empty)
            .Replace("subesi", string.Empty)
            .Replace("sube", string.Empty);

        return Regex.Replace(normalized, "[^a-z0-9]", string.Empty);
    }
}

public sealed class PlannedExamCreateRequest
{
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string Duration { get; set; } = string.Empty;
    public int LateEntryLimitMinutes { get; set; } = 5;
    public string? LiveLinkUrl { get; set; }
    public bool RequireCamera { get; set; } = true;
    public bool RequireFullscreen { get; set; } = true;
    public bool BlockTabChange { get; set; } = true;
    public bool BlockCopyPaste { get; set; } = true;
    public int TotalPoint { get; set; } = 100;
    public int QuestionCount { get; set; }
    public string? TeacherName { get; set; }
    public string? SourceType { get; set; }
    public List<PlannedExamSourceRequest>? Sources { get; set; }
}

public sealed class PlannedExamSourceRequest
{
    public Guid? QuestionId { get; set; }
    public string? Title { get; set; }
    public string? Type { get; set; }
    public string? Subject { get; set; }
    public string? ImagePath { get; set; }
    public string? ImagePlacement { get; set; }
}

public sealed class PlannedExamCheckInRequest
{
    public string? StudentUsername { get; set; }
    public string? StudentName { get; set; }
    public string? ClassName { get; set; }
    public bool JoinedLive { get; set; }
    public bool CameraReady { get; set; }
}

public sealed class SavePlannedExamAttendanceRequest
{
    public List<PlannedExamAttendanceUpdate>? Entries { get; set; }
}

public sealed class PlannedExamAttendanceUpdate
{
    public Guid? StudentUserId { get; set; }
    public string? StudentUsername { get; set; }
    public string? StudentName { get; set; }
    public string? ClassName { get; set; }
    public string? Status { get; set; }
}

public sealed class PlannedExamSnapshot
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public int LateEntryLimitMinutes { get; set; } = 5;
    public string LiveLinkUrl { get; set; } = string.Empty;
    public bool RequireCamera { get; set; } = true;
    public bool RequireFullscreen { get; set; } = true;
    public bool BlockTabChange { get; set; } = true;
    public bool BlockCopyPaste { get; set; } = true;
    public int TotalPoint { get; set; } = 100;
    public int QuestionCount { get; set; }
    public string Status { get; set; } = "Planlandı";
    public string TeacherName { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public List<PlannedExamSourceSnapshot> Sources { get; set; } = [];
    public List<PlannedExamAttendanceEntry> Attendance { get; set; } = [];
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class PlannedExamAttendanceEntry
{
    public Guid? StudentUserId { get; set; }
    public string StudentUsername { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public bool JoinedLive { get; set; }
    public bool CameraReady { get; set; }
    public DateTime? CheckedInAtUtc { get; set; }
    public string Status { get; set; } = "Present";
    public bool ManualOverride { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class PlannedExamSourceSnapshot
{
    public Guid? QuestionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? ImagePath { get; set; }
    public string? ImagePlacement { get; set; }
}
