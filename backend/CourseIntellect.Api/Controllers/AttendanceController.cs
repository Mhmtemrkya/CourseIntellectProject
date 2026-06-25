using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AttendanceController(
    IAttendanceService attendanceService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? studentName,
        [FromQuery] string? className,
        CancellationToken cancellationToken)
    {
        // Kapsam: öğrenci yalnızca kendi kayıtlarını, veli yalnızca kendi
        // çocuklarının kayıtlarını görebilir; personel rolleri kısıtsızdır.
        var allowedNames = await StudentScope.ResolveAllowedStudentNamesAsync(User, dbContext, cancellationToken);
        if (allowedNames is { Count: 0 })
        {
            return Ok(Array.Empty<AttendanceEntryDto>());
        }

        if (allowedNames is { Count: 1 })
        {
            studentName = allowedNames[0];
        }
        else if (allowedNames is { Count: > 1 })
        {
            // Veli birden fazla çocuğa sahipse: istenen isim izinli listedeyse
            // korunur, değilse/boşsa tüm çocuklarına daraltılır.
            var requested = studentName?.Trim();
            studentName = !string.IsNullOrWhiteSpace(requested)
                && allowedNames.Any(name => string.Equals(name.Trim(), requested, StringComparison.OrdinalIgnoreCase))
                ? requested
                : null;
        }

        var items = await attendanceService.GetAttendanceAsync(studentName, className, cancellationToken);

        if (allowedNames is { Count: > 1 } && string.IsNullOrWhiteSpace(studentName))
        {
            items = StudentScope.FilterByStudentNames(items, allowedNames, item => item.StudentName);
        }

        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    public async Task<IActionResult> Save([FromBody] SaveAttendanceRequest request, CancellationToken cancellationToken)
    {
        var items = await attendanceService.SaveLessonAttendanceAsync(request, cancellationToken);
        return Ok(items);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await attendanceService.DeleteAsync(id, cancellationToken);
        return deleted ? Ok(new { deleted = true }) : NotFound();
    }
}
