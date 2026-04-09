using CourseIntellect.Application.DTOs.Homework;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class HomeworkController(IHomeworkService homeworkService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var items = await homeworkService.GetAssignmentsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateHomeworkAssignmentRequest request, CancellationToken cancellationToken)
    {
        var item = await homeworkService.CreateAssignmentAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await homeworkService.DeleteAssignmentAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "Student,Admin,Teacher")]
    public async Task<IActionResult> Submit(Guid id, [FromBody] CreateHomeworkSubmissionRequest request, CancellationToken cancellationToken)
    {
        var item = await homeworkService.SubmitAssignmentAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}
