using System.Security.Claims;
using CourseIntellect.Application.DTOs.ExamSolving;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/solution-sessions")]
public sealed class SolutionSessionsController(
    IExamSolvingService examSolvingService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartSolutionSessionRequest request, CancellationToken cancellationToken)
    {
        if (!CanManageSessions())
        {
            var username = CurrentUsername();
            if (string.IsNullOrWhiteSpace(username))
            {
                return Unauthorized();
            }

            request = request with
            {
                StudentUsername = username,
                StudentName = User.FindFirstValue("name") ?? request.StudentName,
                IsTeacherPreview = false,
            };
        }

        if (request.PlannedExamId is Guid plannedExamId && (request.QuestionIds is null || request.QuestionIds.Count == 0))
        {
            var plannedExams = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(
                dbContext,
                PlannedExamsController.SectionKey,
                cancellationToken);
            var plannedExam = plannedExams.FirstOrDefault(item => item.Id == plannedExamId);
            if (plannedExam is null)
            {
                return NotFound(new { message = "Deneme sınavı bulunamadı." });
            }

            var questionIds = plannedExam.Sources
                .Where(item => item.QuestionId.HasValue)
                .Select(item => item.QuestionId!.Value)
                .Distinct()
                .ToList();
            if (questionIds.Count == 0)
            {
                return BadRequest(new { message = "Bu deneme sınavına henüz çözülebilir soru eklenmemiş." });
            }

            if (!request.IsTeacherPreview)
            {
                var existingSessions = await dbContext.ExamSessions
                    .AsNoTracking()
                    .Where(item => item.PlannedExamId == plannedExam.Id)
                    .OrderByDescending(item => item.StartedAtUtc)
                    .ToListAsync(cancellationToken);
                var normalizedUsername = CompatibilitySnapshotStore.NormalizeText(request.StudentUsername);
                var existingSession = existingSessions.FirstOrDefault(item =>
                    CompatibilitySnapshotStore.NormalizeText(item.StudentUsername) == normalizedUsername);

                if (existingSession?.Status == "Completed")
                {
                    return Conflict(new { message = "Bu sınava daha önce girdiniz. İkinci kez giriş yapılamaz." });
                }

                if (existingSession is not null)
                {
                    var activeSession = await examSolvingService.GetAsync(existingSession.Id, cancellationToken);
                    return activeSession is null
                        ? Conflict(new { message = "Bu sınav oturumu yeniden başlatılamaz." })
                        : Ok(activeSession);
                }

                if (TryResolvePlannedStartUtc(plannedExam, out var startsAtUtc))
                {
                    var now = DateTime.UtcNow;
                    if (now < startsAtUtc)
                    {
                        return Conflict(new
                        {
                            message = $"Sınav saati gelmeden sınava giriş yapılamaz. Başlangıç: {plannedExam.DateLabel} {plannedExam.StartTime}".Trim(),
                        });
                    }

                    var lateLimitMinutes = plannedExam.LateEntryLimitMinutes <= 0 ? 5 : plannedExam.LateEntryLimitMinutes;
                    if (now > startsAtUtc.AddMinutes(lateLimitMinutes))
                    {
                        return Conflict(new
                        {
                            message = $"Geç giriş süresi doldu. Bu sınava başlangıçtan sonraki ilk {lateLimitMinutes} dakika içinde girilebilir.",
                        });
                    }
                }
            }

            request = request with
            {
                Title = plannedExam.Title,
                Subject = plannedExam.Subject,
                ClassName = plannedExam.ClassName,
                DurationSeconds = ResolveDurationSeconds(plannedExam.Duration, request.DurationSeconds),
                QuestionIds = questionIds,
                QuestionCount = questionIds.Count,
            };
        }

        var session = await examSolvingService.StartAsync(request, cancellationToken);
        return Ok(session);
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<IActionResult> Get(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await examSolvingService.GetAsync(sessionId, cancellationToken);
        if (session is null) return NotFound();
        return CanAccessSession(session) ? Ok(session) : Forbid();
    }

    [HttpPost("{sessionId:guid}/answers")]
    public async Task<IActionResult> SaveAnswer(Guid sessionId, [FromBody] SaveSolutionAnswerRequest request, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        return Ok(await examSolvingService.SaveAnswerAsync(sessionId, request, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/flags")]
    public async Task<IActionResult> SaveFlag(Guid sessionId, [FromBody] SaveQuestionFlagRequest request, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        return Ok(await examSolvingService.SaveFlagAsync(sessionId, request, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/notes")]
    public async Task<IActionResult> SaveNote(Guid sessionId, [FromBody] SaveStudentNoteRequest request, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        return Ok(await examSolvingService.SaveNoteAsync(sessionId, request, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/canvas/strokes")]
    public async Task<IActionResult> SaveStroke(Guid sessionId, [FromBody] SaveCanvasStrokeRequest request, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        await examSolvingService.SaveStrokeAsync(sessionId, request, cancellationToken);
        return Accepted(new { saved = true });
    }

    [HttpPost("{sessionId:guid}/canvas/snapshot")]
    public async Task<IActionResult> SaveSnapshot(Guid sessionId, [FromBody] SaveCanvasSnapshotRequest request, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        return Ok(await examSolvingService.SaveSnapshotAsync(sessionId, request, BaseUrl(), cancellationToken));
    }

    [HttpPost("{sessionId:guid}/complete")]
    public async Task<IActionResult> Complete(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        var summary = await examSolvingService.CompleteAsync(sessionId, BaseUrl(), cancellationToken);
        await MirrorCompletedSessionForPlannedExamAsync(sessionId, cancellationToken);
        return Ok(summary);
    }

    [HttpPost("{sessionId:guid}/pdf")]
    public async Task<IActionResult> QueuePdf(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!await HasAccessAsync(sessionId, cancellationToken)) return Forbid();
        return Ok(await examSolvingService.QueuePdfAsync(sessionId, BaseUrl(), cancellationToken));
    }

    [HttpPost("{sessionId:guid}/reviews")]
    [Authorize(Roles = "Teacher,Admin,InstitutionAdmin,Idare")]
    public async Task<IActionResult> AddReview(Guid sessionId, [FromBody] AddTeacherReviewRequest request, CancellationToken cancellationToken)
    {
        var teacherName = User.FindFirstValue("name") ?? User.Identity?.Name ?? "Öğretmen";
        var teacherUserId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var parsed)
            ? parsed
            : (Guid?)null;
        return Ok(await examSolvingService.AddTeacherReviewAsync(sessionId, request, teacherName, teacherUserId, cancellationToken));
    }

    [HttpGet("/api/teacher/pdf-reports")]
    [Authorize(Roles = "Teacher,Admin,InstitutionAdmin,Idare")]
    public async Task<IActionResult> TeacherReports(CancellationToken cancellationToken)
    {
        return Ok(await examSolvingService.GetTeacherReportsAsync(cancellationToken));
    }

    // Öğrencinin tamamladığı sınavların kağıtları (PDF) — sonuç ekranında önizleme/indirme için.
    [HttpGet("my-papers")]
    public async Task<IActionResult> MyPapers([FromQuery] string? studentName, [FromQuery] string? studentUsername, CancellationToken cancellationToken)
    {
        var username = string.IsNullOrWhiteSpace(studentUsername) ? CurrentUsername() : studentUsername.Trim();
        return Ok(await examSolvingService.GetStudentPapersAsync(username, studentName ?? string.Empty, cancellationToken));
    }

    private string BaseUrl()
    {
        return $"{Request.Scheme}://{Request.Host}";
    }

    private string CurrentUsername()
    {
        return User.FindFirstValue("unique_name")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? string.Empty;
    }

    private bool CanManageSessions()
    {
        return User.IsInRole("Teacher")
            || User.IsInRole("Admin")
            || User.IsInRole("InstitutionAdmin")
            || User.IsInRole("Idare");
    }

    private bool CanAccessSession(SolutionSessionResponse session)
    {
        return CanManageSessions()
            || string.Equals(session.StudentUsername, CurrentUsername(), StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> HasAccessAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await examSolvingService.GetAsync(sessionId, cancellationToken);
        return session is not null && CanAccessSession(session);
    }

    private static int ResolveDurationSeconds(string value, int fallback)
    {
        var minutesText = (value ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return int.TryParse(minutesText, out var minutes) && minutes > 0
            ? minutes * 60
            : fallback;
    }

    private async Task MirrorCompletedSessionForPlannedExamAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var storedSession = await dbContext.ExamSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == sessionId, cancellationToken);
        if (storedSession?.PlannedExamId is not Guid plannedExamId || storedSession.IsTeacherPreview)
        {
            return;
        }

        var snapshots = await CompatibilitySnapshotStore.LoadListAsync<ExamSessionSnapshot>(
            dbContext,
            ExamSessionsController.SectionKey,
            cancellationToken);
        if (snapshots.Any(item => item.Id == sessionId))
        {
            return;
        }

        var plannedExams = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(
            dbContext,
            PlannedExamsController.SectionKey,
            cancellationToken);
        var plannedExam = plannedExams.FirstOrDefault(item => item.Id == plannedExamId);
        var session = await examSolvingService.GetAsync(sessionId, cancellationToken);
        if (session is null)
        {
            return;
        }

        snapshots.Add(new ExamSessionSnapshot
        {
            Id = session.Id,
            PlannedExamId = plannedExamId,
            ExamTitle = session.Title,
            Subject = session.Subject,
            StudentName = session.StudentName,
            StudentUsername = session.StudentUsername,
            ClassName = session.ClassName,
            DurationSeconds = session.DurationSeconds,
            Status = "Completed",
            TeacherName = plannedExam?.TeacherName ?? string.Empty,
            AssessmentLabel = plannedExam?.Type ?? string.Empty,
            ApprovalStatus = "Pending",
            StartedAtUtc = session.StartedAtUtc,
            CompletedAtUtc = session.CompletedAtUtc ?? DateTime.UtcNow,
            Questions = session.Questions
                .OrderBy(item => item.SortOrder)
                .Select(item => new ExamSessionQuestionSnapshot
                {
                    Id = item.AttemptId,
                    QuestionBankItemId = item.QuestionBankItemId,
                    Subject = item.Subject,
                    Topic = item.Topic,
                    QuestionText = item.QuestionText,
                    ImagePath = item.ImagePath,
                    ImagePlacement = item.ImagePlacement,
                    Options = item.Options.ToList(),
                    CorrectOptionIndex = item.CorrectOptionIndex ?? 0,
                    SortOrder = item.SortOrder,
                    Answer = item.Answer is null
                        ? null
                        : new ExamSessionAnswerSnapshot
                        {
                            SelectedOptionIndex = item.Answer.SelectedOptionIndex,
                            OpenAnswer = item.Answer.OpenAnswer,
                            IsCorrect = item.Answer.IsCorrect,
                            AnsweredAtUtc = item.Answer.SavedAtUtc,
                        },
                })
                .ToList(),
        });

        await CompatibilitySnapshotStore.SaveListAsync(
            dbContext,
            ExamSessionsController.SectionKey,
            snapshots,
            session.StudentUsername,
            cancellationToken);
    }

    private static bool TryResolvePlannedStartUtc(PlannedExamSnapshot plannedExam, out DateTime startsAtUtc)
    {
        var dateLabel = plannedExam.DateLabel ?? string.Empty;
        var hasTimeInDate = System.Text.RegularExpressions.Regex.IsMatch(dateLabel, @"\d{1,2}:\d{2}");
        var combined = !hasTimeInDate && !string.IsNullOrWhiteSpace(plannedExam.StartTime)
            ? $"{dateLabel} {plannedExam.StartTime}"
            : dateLabel;
        return ExamSessionsController.TryResolvePlannedStartUtc(combined, out startsAtUtc);
    }
}
