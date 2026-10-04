using System.Security.Claims;
using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kurum (tenant) silme. Yalnız kurum yöneticisi talep eder; platform yöneticisi onaylar.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/institution-deletion")]
public sealed class InstitutionDeletionController(IInstitutionDeletionService service) : ControllerBase
{
    [HttpPost("request")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateInstitutionDeletionRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        try
        {
            return Ok(await service.RequestAsync(userId.Value, CurrentUserName(), request, cancellationToken));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
        => Ok(await service.GetMineAsync(cancellationToken));

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
        => User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "Bilinmiyor";
}
