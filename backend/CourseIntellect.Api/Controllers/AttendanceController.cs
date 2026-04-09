using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AttendanceController(IAttendanceService attendanceService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? studentName,
        [FromQuery] string? className,
        CancellationToken cancellationToken)
    {
        var items = await attendanceService.GetAttendanceAsync(studentName, className, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    public async Task<IActionResult> Save([FromBody] SaveAttendanceRequest request, CancellationToken cancellationToken)
    {
        var items = await attendanceService.SaveLessonAttendanceAsync(request, cancellationToken);
        return Ok(items);
    }
}
