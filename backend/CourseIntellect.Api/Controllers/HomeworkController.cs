using System.Security.Claims;
using CourseIntellect.Application.DTOs.Homework;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
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
        var (role, userId, fullName) = GetCurrentUser();
        var items = await homeworkService.GetAssignmentsAsync(role, userId, fullName, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    [RequireEntitlement("assignments", "assign")]
    public async Task<IActionResult> Create([FromBody] CreateHomeworkAssignmentRequest request, CancellationToken cancellationToken)
    {
        var item = await homeworkService.CreateAssignmentAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    [RequireEntitlement("assignments", "delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await homeworkService.DeleteAssignmentAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "Student,Admin,Teacher")]
    [RequireEntitlement("assignments", "submit")]
    public async Task<IActionResult> Submit(Guid id, [FromBody] CreateHomeworkSubmissionRequest request, CancellationToken cancellationToken)
    {
        var (role, userId, fullName) = GetCurrentUser();
        try
        {
            var item = await homeworkService.SubmitAssignmentAsync(id, role, userId, fullName, request, cancellationToken);
            return item is null ? NotFound() : Ok(item);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Teslim sahipliği ve teslim görünürlüğü OTURUMDAN belirlenir; istek gövdesindeki
    /// öğrenci adı yetki kararında kullanılmaz.
    /// </summary>
    private (string Role, Guid UserId, string FullName) GetCurrentUser()
    {
        var role = User.FindFirstValue("role") ?? string.Empty;
        var fullName = User.FindFirstValue("name") ?? string.Empty;
        var rawId = User.FindFirstValue("nameid") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return (role, Guid.TryParse(rawId, out var userId) ? userId : Guid.Empty, fullName);
    }
}
