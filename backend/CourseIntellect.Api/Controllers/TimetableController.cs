using System.Security.Claims;
using CourseIntellect.Application.DTOs.Timetable;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/timetable")]
public sealed class TimetableController(ITimetableService timetableService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    public async Task<IActionResult> Get([FromQuery] Guid? teacherUserId, [FromQuery] string? teacherName, CancellationToken cancellationToken)
    {
        // Öğretmen kendi programını çekebilir; parametre yoksa kendi kimliğine düşer.
        var resolvedId = teacherUserId ?? CurrentUserId();
        var resolvedName = string.IsNullOrWhiteSpace(teacherName) && teacherUserId is null ? CurrentUserName() : teacherName;
        return Ok(await timetableService.GetByTeacherAsync(resolvedId, resolvedName, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("duties", "create")]
    public async Task<IActionResult> Set([FromBody] SetTimetableRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await timetableService.SetForTeacherAsync(request, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("duties")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var ok = await timetableService.DeleteAsync(id, cancellationToken);
        return ok ? Ok(new { deleted = true }) : NotFound();
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
