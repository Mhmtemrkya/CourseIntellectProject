using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class LoginAttemptsController(ILoginAttemptService loginAttemptService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] bool? success,
        CancellationToken cancellationToken)
    {
        var items = await loginAttemptService.GetAllAsync(search, role, success, cancellationToken);
        return Ok(items);
    }

    [HttpGet("stats")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        var stats = await loginAttemptService.GetStatsAsync(cancellationToken);
        return Ok(stats);
    }
}
