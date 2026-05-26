using System.Security.Claims;
using CourseIntellect.Application.DTOs.ExamSolving;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
        return Ok(await examSolvingService.CompleteAsync(sessionId, BaseUrl(), cancellationToken));
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
}
