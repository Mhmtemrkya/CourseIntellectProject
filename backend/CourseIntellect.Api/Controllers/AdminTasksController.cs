using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/admin-tasks")]
public sealed class AdminTasksController(IAdminTaskService taskService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? status,
        [FromQuery] string? assignee,
        CancellationToken cancellationToken)
    {
        return Ok(await taskService.GetAsync(status, assignee, cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Başlık zorunludur." });
        }

        return Ok(await taskService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] TaskStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await taskService.UpdateStatusAsync(id, request, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
    {
        return User.FindFirstValue("name")
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("unique_name")
            ?? User.Identity?.Name
            ?? string.Empty;
    }
}
