using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/admin-tasks")]
public sealed class AdminTasksController(IAdminTaskService taskService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Get(
        [FromQuery] string? status,
        [FromQuery] string? assignee,
        CancellationToken cancellationToken)
    {
        return Ok(await taskService.GetAsync(status, assignee, cancellationToken));
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> Mine(CancellationToken cancellationToken)
    {
        return Ok(await taskService.GetMineAsync(CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("tasks", "create")]
    public async Task<IActionResult> Create([FromBody] CreateTaskRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Başlık zorunludur." });
        }
        if (string.IsNullOrWhiteSpace(request.AssignedToName) && !request.AssignedToUserId.HasValue)
        {
            return BadRequest(new { message = "Görevin atanacağı kişi zorunludur." });
        }
        if (request.StartDate.HasValue && request.EndDate.HasValue && request.EndDate <= request.StartDate)
        {
            return BadRequest(new { message = "Görev bitiş zamanı başlangıç zamanından sonra olmalıdır." });
        }

        return Ok(await taskService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    [RequireEntitlement("tasks", "complete")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] TaskStatusRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest(new { message = "Görev durumu zorunludur." });
        }
        if (request.Status.Trim() is "Rejected" or "Reject" or "Reddedildi" or "Kabul Edilmedi"
            && string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "Görevi kabul etmeme nedeni zorunludur." });
        }

        try
        {
            var canManageAllTasks = User.IsInRole("Admin") || User.IsInRole("Administrative");
            var result = await taskService.UpdateStatusAsync(
                id,
                request,
                CurrentUserId(),
                CurrentUserName(),
                canManageAllTasks,
                cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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
