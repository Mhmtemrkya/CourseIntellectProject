using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/staff-hr")]
public sealed class StaffHrController(IStaffHrService staffHrService) : ControllerBase
{
    /// <summary>
    /// İzin kayıtları izin türü ve gerekçe (sağlık, ölüm, doğum) taşır. Öğrenci ve
    /// veli bu ekrana hiç girmez; personel yalnız KENDİ izinlerini görür, tüm kadroyu
    /// yalnız yönetim (kurum yöneticisi / idari / şube müdürü) görür.
    /// </summary>
    [HttpGet("leaves")]
    public async Task<IActionResult> GetLeaves(
        [FromQuery] string? status,
        [FromQuery] string? staffName,
        CancellationToken cancellationToken)
    {
        if (!IsStaff())
        {
            return Forbid();
        }

        if (!IsStaffManager())
        {
            staffName = CurrentUserName();
        }

        return Ok(await staffHrService.GetLeavesAsync(status, staffName, cancellationToken));
    }

    [HttpPost("leaves")]
    public async Task<IActionResult> CreateLeave([FromBody] CreateLeaveRequest request, CancellationToken cancellationToken)
    {
        if (!IsStaff())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.StaffName) && string.IsNullOrWhiteSpace(CurrentUserName()))
        {
            return BadRequest(new { message = "Personel adı zorunludur." });
        }

        // Yönetici olmayan personel yalnız kendi adına izin talep edebilir;
        // aksi hâlde başkasının adına izin kaydı açılabiliyordu.
        if (!IsStaffManager())
        {
            request = request with { StaffUserId = CurrentUserId(), StaffName = CurrentUserName() };
        }

        return Ok(await staffHrService.CreateLeaveAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("leaves/{id:guid}/decide")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("staff-hr", "leave-approve")]
    public async Task<IActionResult> DecideLeave(Guid id, [FromBody] LeaveDecisionRequest decision, CancellationToken cancellationToken)
    {
        var result = await staffHrService.DecideLeaveAsync(id, decision, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("leave-balance")]
    public async Task<IActionResult> GetLeaveBalance([FromQuery] string staffName, CancellationToken cancellationToken)
    {
        if (!IsStaff())
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(staffName))
        {
            return BadRequest(new { message = "staffName gerekli." });
        }

        if (!IsStaffManager() && !string.Equals(staffName.Trim(), CurrentUserName().Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        return Ok(await staffHrService.GetLeaveBalanceAsync(staffName, cancellationToken));
    }

    [HttpGet("assets")]
    public async Task<IActionResult> GetAssets([FromQuery] string? staffName, CancellationToken cancellationToken)
    {
        if (!IsStaff())
        {
            return Forbid();
        }

        if (!IsStaffManager())
        {
            staffName = CurrentUserName();
        }

        return Ok(await staffHrService.GetAssetsAsync(staffName, cancellationToken));
    }

    [HttpPost("assets")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("staff-hr", "asset-assign")]
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
    [RequireEntitlement("staff-hr", "asset-assign")]
    public async Task<IActionResult> ReturnAsset(Guid id, CancellationToken cancellationToken)
    {
        var result = await staffHrService.ReturnAssetAsync(id, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Personel kadrosu rolleri — öğrenci/veli bu ekranların dışındadır.</summary>
    private bool IsStaff()
        => User.IsInRole("Admin") || User.IsInRole("Administrative") || User.IsInRole("BranchManager")
        || User.IsInRole("Accounting") || User.IsInRole("Teacher") || User.IsInRole("Cafeteria")
        || User.IsInRole("Developer");

    /// <summary>Tüm kadronun izin/demirbaş kaydını görebilen yönetim rolleri.</summary>
    private bool IsStaffManager()
        => User.IsInRole("Admin") || User.IsInRole("Administrative") || User.IsInRole("BranchManager")
        || User.IsInRole("Developer");

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
