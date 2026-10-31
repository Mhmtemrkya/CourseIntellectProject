using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Clubs;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Öğrenci kulüpleri. Kulübü kurum yöneticisi/şube müdürü açar ve danışman atar;
/// danışman öğretmen üyeleri ve etkinlikleri yönetir; öğrenci katılma isteği
/// gönderir; veli çocuğunun kulüplerini görür. Yetki kuralları ClubService'te.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Administrative,Teacher,Student,Parent")]
[Route("api/clubs")]
[RequireEntitlement("clubs")]
public sealed class ClubsController(IClubService service, CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> GetOverview([FromQuery] string? academicYear, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.GetOverviewAsync(viewer, academicYear, cancellationToken)), cancellationToken);

    [HttpGet("mine")]
    public Task<IActionResult> GetMine(CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.GetMineAsync(viewer, cancellationToken)), cancellationToken);

    [HttpGet("activities/upcoming")]
    public Task<IActionResult> GetUpcoming(CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.GetUpcomingActivitiesAsync(viewer, cancellationToken)), cancellationToken);

    [HttpGet("teachers")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetTeachers(CancellationToken cancellationToken)
        => Ok(await service.GetTeacherOptionsAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public Task<IActionResult> GetDetail(Guid id, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.GetDetailAsync(viewer, id, cancellationToken)), cancellationToken);

    [HttpGet("{id:guid}/student-options")]
    [Authorize(Roles = "Admin,Teacher")]
    public Task<IActionResult> SearchStudents(Guid id, [FromQuery] string? search, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.SearchStudentsAsync(viewer, id, search, cancellationToken)), cancellationToken);

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("clubs", "manage")]
    public Task<IActionResult> Create([FromBody] SaveClubRequest request, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.CreateAsync(viewer, request, cancellationToken)), cancellationToken);

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("clubs", "manage")]
    public Task<IActionResult> Update(Guid id, [FromBody] SaveClubRequest request, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.UpdateAsync(viewer, id, request, cancellationToken)), cancellationToken);

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("clubs", "manage")]
    public Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => Run(async viewer =>
        {
            await service.DeleteAsync(viewer, id, cancellationToken);
            return NoContent();
        }, cancellationToken);

    [HttpPost("{id:guid}/members")]
    [Authorize(Roles = "Admin,Teacher")]
    public Task<IActionResult> AddMember(Guid id, [FromBody] AddClubMemberRequest request, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.AddMemberAsync(viewer, id, request, cancellationToken)), cancellationToken);

    [HttpPut("{id:guid}/members/{memberId:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    public Task<IActionResult> UpdateMember(Guid id, Guid memberId, [FromBody] UpdateClubMemberRequest request, CancellationToken cancellationToken)
        => Run(async viewer =>
        {
            var member = await service.UpdateMemberAsync(viewer, id, memberId, request, cancellationToken);
            return member is null ? NoContent() : Ok(member);
        }, cancellationToken);

    [HttpPost("{id:guid}/join")]
    [Authorize(Roles = "Student")]
    public Task<IActionResult> Join(Guid id, [FromBody] JoinClubRequest request, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.RequestJoinAsync(viewer, id, request, cancellationToken)), cancellationToken);

    [HttpDelete("{id:guid}/join")]
    [Authorize(Roles = "Student")]
    public Task<IActionResult> Leave(Guid id, CancellationToken cancellationToken)
        => Run(async viewer =>
        {
            await service.LeaveAsync(viewer, id, cancellationToken);
            return NoContent();
        }, cancellationToken);

    [HttpPost("{id:guid}/activities")]
    [Authorize(Roles = "Admin,Teacher")]
    public Task<IActionResult> CreateActivity(Guid id, [FromBody] SaveClubActivityRequest request, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.SaveActivityAsync(viewer, id, null, request, cancellationToken)), cancellationToken);

    [HttpPut("{id:guid}/activities/{activityId:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    public Task<IActionResult> UpdateActivity(Guid id, Guid activityId, [FromBody] SaveClubActivityRequest request, CancellationToken cancellationToken)
        => Run(async viewer => Ok(await service.SaveActivityAsync(viewer, id, activityId, request, cancellationToken)), cancellationToken);

    [HttpDelete("{id:guid}/activities/{activityId:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    public Task<IActionResult> DeleteActivity(Guid id, Guid activityId, CancellationToken cancellationToken)
        => Run(async viewer =>
        {
            await service.DeleteActivityAsync(viewer, id, activityId, cancellationToken);
            return NoContent();
        }, cancellationToken);

    private async Task<ClubViewer> ResolveViewerAsync(CancellationToken cancellationToken)
    {
        var userId = StudentScope.ResolveUserId(User);
        // Şube müdürü JWT'de Admin rolünü taşır; verisi şube filtresiyle kilitli.
        if (User.IsInRole("Admin")) return new ClubViewer(ClubViewerKind.Manager, userId, []);
        if (User.IsInRole("Administrative")) return new ClubViewer(ClubViewerKind.Staff, userId, []);
        if (User.IsInRole("Teacher")) return new ClubViewer(ClubViewerKind.Teacher, userId, []);
        if (User.IsInRole("Student")) return new ClubViewer(ClubViewerKind.Student, userId, []);
        var children = await StudentScope.ResolveParentChildrenAsync(User, dbContext, cancellationToken);
        return new ClubViewer(ClubViewerKind.Parent, userId, children.Select(child => child.UserId).Where(id => id != Guid.Empty).ToList());
    }

    private async Task<IActionResult> Run(Func<ClubViewer, Task<IActionResult>> action, CancellationToken cancellationToken)
    {
        try
        {
            return await action(await ResolveViewerAsync(cancellationToken));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
