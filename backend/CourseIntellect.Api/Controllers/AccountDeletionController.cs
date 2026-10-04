using System.Security.Claims;
using CourseIntellect.Application.DTOs.AccountLifecycle;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kişisel hesap silme. Her rol kendi talebini oluşturabilir/izleyebilir/iptal edebilir.
/// Kurum yöneticisi kurumdaki talepleri YALNIZ görüntüler (reddedemez).
/// </summary>
[ApiController]
[Authorize]
[Route("api/account-deletion")]
public sealed class AccountDeletionController(IAccountDeletionService service) : ControllerBase
{
    [HttpPost("request")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateAccountDeletionRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return await ExecuteAsync(() => service.RequestAsync(userId.Value, CurrentUserName(), request, cancellationToken));
    }

    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.GetMineAsync(userId.Value, cancellationToken));
    }

    [HttpPost("mine/cancel")]
    public async Task<IActionResult> CancelMine(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return await ExecuteAsync(() => service.CancelMineAsync(userId.Value, CurrentUserName(), cancellationToken));
    }

    /// <summary>Tek yönetici kendini silerken yönetimi devredebileceği aday kullanıcılar.</summary>
    [HttpGet("successor-candidates")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetSuccessorCandidates(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await service.GetSuccessorCandidatesAsync(userId.Value, cancellationToken));
    }

    /// <summary>Kurum yöneticisi: kurumdaki kişisel silme talepleri (yalnız görüntüleme/SLA).</summary>
    [HttpGet]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> GetTenantQueue(CancellationToken cancellationToken)
        => Ok(await service.GetTenantQueueAsync(cancellationToken));

    private async Task<IActionResult> ExecuteAsync(Func<Task<AccountDeletionStatusDto>> action)
    {
        try
        {
            return Ok(await action());
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

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
        => User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name ?? "Bilinmiyor";
}
