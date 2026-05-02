using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Route("api/system")]
public sealed class SystemController(ISystemService systemService) : ControllerBase
{
    /// <summary>
    /// Public sistem durumu — tüm istemciler bunu poll'lar.
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
    {
        var status = await systemService.GetStatusAsync(cancellationToken);
        return Ok(status);
    }

    /// <summary>
    /// Bakım modu aç/kapat — sadece platform admin.
    /// </summary>
    [HttpPut("maintenance")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> SetMaintenance(
        [FromBody] UpdateMaintenanceRequest request,
        CancellationToken cancellationToken)
    {
        var status = await systemService.SetMaintenanceAsync(request, cancellationToken);
        return Ok(status);
    }
}
