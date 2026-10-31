using System.Security.Claims;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Visitors;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Ziyaretçi takibi. Danışma/sekreterlik işi olduğu için İdari Personel
/// (Administrative) rolüne verilir; kurum yöneticisi ve şube müdürü de kullanır.
/// Kayıt silme yalnız yöneticidedir (KVKK silme taleplerinde).
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/visitors")]
[RequireEntitlement("visitors")]
public sealed class VisitorsController(IVisitorService service) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> List([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, [FromQuery] string? search, [FromQuery] string? status, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.ListAsync(fromUtc, toUtc, search, status, cancellationToken)));

    [HttpGet("hosts")]
    public async Task<IActionResult> Hosts(CancellationToken cancellationToken) => Ok(await service.GetHostsAsync(cancellationToken));

    [HttpGet("students")]
    public async Task<IActionResult> Students([FromQuery] string? search, CancellationToken cancellationToken)
        => Ok(await service.SearchStudentsAsync(search, cancellationToken));

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string? q, CancellationToken cancellationToken)
        => Ok(await service.LookupAsync(q, cancellationToken));

    [HttpPost]
    [RequireEntitlement("visitors", "check-in")]
    public Task<IActionResult> CheckIn([FromBody] CheckInVisitorRequest request, CancellationToken cancellationToken)
        => Run(async () =>
        {
            var actorName = (User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? string.Empty).Trim();
            return Ok(await service.CheckInAsync(request, StudentScope.ResolveUserId(User), actorName, cancellationToken));
        });

    [HttpPost("{id:guid}/checkout")]
    [RequireEntitlement("visitors", "check-in")]
    public Task<IActionResult> CheckOut(Guid id, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.CheckOutAsync(id, StudentScope.ResolveUserId(User), cancellationToken)));

    [HttpPut("{id:guid}")]
    [RequireEntitlement("visitors", "check-in")]
    public Task<IActionResult> Update(Guid id, [FromBody] UpdateVisitorRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.UpdateAsync(id, request, cancellationToken)));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => Run(async () =>
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
