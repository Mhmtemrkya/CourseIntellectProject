using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Attendance;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
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
        [FromQuery] Guid? studentId,
        CancellationToken cancellationToken)
    {
        // Kapsam: öğrenci yalnızca kendi kayıtlarını, veli yalnızca kendi
        // çocuklarının kayıtlarını görebilir; personel rolleri kısıtsızdır.
        // Kimliğe bağlı kayıtlar kimlikle, bağlanmamış eski kayıtlar adla süzülür.
        var scope = await StudentScope.ResolveStudentRecordScopeAsync(User, dbContext, cancellationToken);
        if (scope is { StudentIds.Count: 0, StudentNames.Count: 0 })
        {
            return Ok(Array.Empty<AttendanceEntryDto>());
        }

        if (scope is not null)
        {
            // Kapsam dışı öğrenci istenirse boş döner. Eskiden istek yok sayılıp tüm kapsam
            // dönüyordu: çok çocuklu velide bir çocuğun kartına kardeşlerinin kayıtları karışabilirdi.
            if (studentId is { } requestedId && !scope.StudentIds.Contains(requestedId))
            {
                return Ok(Array.Empty<object>());
            }

            // Ad harf/Türkçe karakterden bağımsız karşılaştırılır: mobil adı "Ayse" diye
            // gönderebilir, kayıtta "Ayşe" yazar.
            var requested = studentName?.Trim();
            studentName = !string.IsNullOrWhiteSpace(requested)
                && scope.StudentNames.Any(name => StudentIdentityResolver.NameKey(name) == StudentIdentityResolver.NameKey(requested))
                ? requested
                : null;
        }

        var items = await attendanceService.GetAttendanceAsync(studentName, className, studentId, scope, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    [RequireEntitlement("attendance", "take")]
    public async Task<IActionResult> Save([FromBody] SaveAttendanceRequest request, CancellationToken cancellationToken)
    {
        var items = await attendanceService.SaveLessonAttendanceAsync(request, cancellationToken);
        return Ok(items);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    [RequireEntitlement("attendance", "edit-past")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await attendanceService.DeleteAsync(id, cancellationToken);
        return deleted ? Ok(new { deleted = true }) : NotFound();
    }
}
