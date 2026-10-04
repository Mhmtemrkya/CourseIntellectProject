using System.Security.Claims;
using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Platform yöneticisi tarafı: kurum yöneticilerinin kendi hesap silme talepleri (görüntüleme)
/// ve kurum silme taleplerinin onay/reddi. PlatformAdmin politikası arkasında, tenant bağlamsız.
/// </summary>
[ApiController]
[Authorize(Policy = "PlatformAdmin")]
[Route("api/platformops")]
public sealed class PlatformDeletionController(
    IAccountDeletionService accountDeletionService,
    IInstitutionDeletionService institutionDeletionService) : ControllerBase
{
    [HttpGet("account-deletions")]
    public async Task<IActionResult> GetAccountDeletions(CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        return Ok(await accountDeletionService.GetPlatformQueueAsync(cancellationToken));
    }

    [HttpGet("institution-deletions")]
    public async Task<IActionResult> GetInstitutionDeletions(CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        return Ok(await institutionDeletionService.GetPlatformQueueAsync(cancellationToken));
    }

    [HttpPost("institution-deletions/{id:guid}/decide")]
    public async Task<IActionResult> DecideInstitutionDeletion(
        Guid id, [FromBody] InstitutionDeletionDecisionRequest decision, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        try
        {
            return Ok(await institutionDeletionService.DecideAsync(id, userId.Value, CurrentUserName(), decision, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private bool DenyPlatformAccess()
    {
        var isPlatformAdmin = string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase);
        return !isPlatformAdmin || !string.IsNullOrWhiteSpace(User.FindFirstValue("tenant_id"));
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
        => User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "Bilinmiyor";
}
