using System.Security.Claims;
using CourseIntellect.Application.DTOs.ExamSolving;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/solution-sessions")]
public sealed class SolutionSessionsController(IExamSolvingService examSolvingService) : ControllerBase
{
    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartSolutionSessionRequest request, CancellationToken cancellationToken)
    {
        var session = await examSolvingService.StartAsync(request, cancellationToken);
        return Ok(session);
    }

    [HttpGet("{sessionId:guid}")]
    public async Task<IActionResult> Get(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await examSolvingService.GetAsync(sessionId, cancellationToken);
        return session is null ? NotFound() : Ok(session);
    }

    [HttpPost("{sessionId:guid}/answers")]
    public async Task<IActionResult> SaveAnswer(Guid sessionId, [FromBody] SaveSolutionAnswerRequest request, CancellationToken cancellationToken)
    {
        return Ok(await examSolvingService.SaveAnswerAsync(sessionId, request, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/flags")]
    public async Task<IActionResult> SaveFlag(Guid sessionId, [FromBody] SaveQuestionFlagRequest request, CancellationToken cancellationToken)
    {
        return Ok(await examSolvingService.SaveFlagAsync(sessionId, request, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/notes")]
    public async Task<IActionResult> SaveNote(Guid sessionId, [FromBody] SaveStudentNoteRequest request, CancellationToken cancellationToken)
    {
        return Ok(await examSolvingService.SaveNoteAsync(sessionId, request, cancellationToken));
    }

    [HttpPost("{sessionId:guid}/canvas/strokes")]
    public async Task<IActionResult> SaveStroke(Guid sessionId, [FromBody] SaveCanvasStrokeRequest request, CancellationToken cancellationToken)
    {
        await examSolvingService.SaveStrokeAsync(sessionId, request, cancellationToken);
        return Accepted(new { saved = true });
    }

    [HttpPost("{sessionId:guid}/canvas/snapshot")]
    public async Task<IActionResult> SaveSnapshot(Guid sessionId, [FromBody] SaveCanvasSnapshotRequest request, CancellationToken cancellationToken)
    {
        return Ok(await examSolvingService.SaveSnapshotAsync(sessionId, request, BaseUrl(), cancellationToken));
    }

    [HttpPost("{sessionId:guid}/complete")]
    public async Task<IActionResult> Complete(Guid sessionId, CancellationToken cancellationToken)
    {
        return Ok(await examSolvingService.CompleteAsync(sessionId, BaseUrl(), cancellationToken));
    }

    [HttpPost("{sessionId:guid}/pdf")]
    public async Task<IActionResult> QueuePdf(Guid sessionId, CancellationToken cancellationToken)
    {
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
}
