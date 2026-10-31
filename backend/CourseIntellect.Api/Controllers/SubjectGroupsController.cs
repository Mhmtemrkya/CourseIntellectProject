using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.SubjectGroups;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Zümreler (ders zümreleri ve zümre başkanları). Oluşturma/düzenleme kurum
/// yöneticisi ve şube müdürüne aittir (şube müdürü JWT'de Admin rolünü taşır,
/// verisi şube filtresiyle kendi şubesine kilitlidir). İdari personel listeyi
/// görür; öğretmen yalnız üyesi olduğu zümreleri görür.
/// </summary>
[ApiController]
[Authorize]
[Route("api/subject-groups")]
public sealed class SubjectGroupsController(ISubjectGroupService service) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("subject-groups")]
    public async Task<IActionResult> GetOverview([FromQuery] string? academicYear, CancellationToken cancellationToken)
        => await Run(async () => Ok(await service.GetOverviewAsync(academicYear, cancellationToken)));

    [HttpGet("teachers")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("subject-groups")]
    public async Task<IActionResult> GetTeachers([FromQuery] string? academicYear, CancellationToken cancellationToken)
        => await Run(async () => Ok(await service.GetTeacherOptionsAsync(academicYear, cancellationToken)));

    /// <summary>Öğretmenin üyesi olduğu zümreler (başkansa kendisi işaretli).</summary>
    [HttpGet("mine")]
    [Authorize(Roles = "Teacher")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        if (StudentScope.ResolveUserId(User) is not Guid userId) return Unauthorized();
        return Ok(await service.GetForTeacherAsync(userId, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("subject-groups", "manage")]
    public async Task<IActionResult> Create([FromBody] SaveSubjectGroupRequest request, CancellationToken cancellationToken)
        => await Run(async () => Ok(await service.CreateAsync(request, StudentScope.ResolveUserId(User), cancellationToken)));

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("subject-groups", "manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveSubjectGroupRequest request, CancellationToken cancellationToken)
        => await Run(async () => Ok(await service.UpdateAsync(id, request, cancellationToken)));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("subject-groups", "manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => await Run(async () =>
        {
            await service.DeleteAsync(id, cancellationToken);
            return NoContent();
        });

    private async Task<IActionResult> Run(Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
