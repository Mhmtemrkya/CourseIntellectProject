using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/staff-hr")]
public sealed class StaffHrController(IStaffHrService staffHrService) : ControllerBase
{
    [HttpGet("leaves")]
    public async Task<IActionResult> GetLeaves(
        [FromQuery] string? status,
        [FromQuery] string? staffName,
        CancellationToken cancellationToken)
    {
        return Ok(await staffHrService.GetLeavesAsync(status, staffName, cancellationToken));
    }

    [HttpPost("leaves")]
    public async Task<IActionResult> CreateLeave([FromBody] CreateLeaveRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.StaffName) && string.IsNullOrWhiteSpace(CurrentUserName()))
        {
            return BadRequest(new { message = "Personel adı zorunludur." });
        }

        return Ok(await staffHrService.CreateLeaveAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("leaves/{id:guid}/decide")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> DecideLeave(Guid id, [FromBody] LeaveDecisionRequest decision, CancellationToken cancellationToken)
    {
        var result = await staffHrService.DecideLeaveAsync(id, decision, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("leave-balance")]
    public async Task<IActionResult> GetLeaveBalance([FromQuery] string staffName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(staffName))
        {
            return BadRequest(new { message = "staffName gerekli." });
        }

        return Ok(await staffHrService.GetLeaveBalanceAsync(staffName, cancellationToken));
    }

    [HttpGet("assets")]
    public async Task<IActionResult> GetAssets([FromQuery] string? staffName, CancellationToken cancellationToken)
    {
        return Ok(await staffHrService.GetAssetsAsync(staffName, cancellationToken));
    }

    [HttpPost("assets")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> AssignAsset([FromBody] AssignAssetRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.StaffName) || string.IsNullOrWhiteSpace(request.AssetName))
        {
            return BadRequest(new { message = "Personel ve demirbaş adı zorunludur." });
        }

        return Ok(await staffHrService.AssignAssetAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("assets/{id:guid}/return")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> ReturnAsset(Guid id, CancellationToken cancellationToken)
    {
        var result = await staffHrService.ReturnAssetAsync(id, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
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
