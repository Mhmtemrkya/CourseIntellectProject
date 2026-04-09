using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/[controller]")]
public sealed class DashboardController(IDashboardService dashboardService) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        var stats = await dashboardService.GetStatsAsync(cancellationToken);
        return Ok(stats);
    }

    [HttpGet("activities")]
    public async Task<IActionResult> GetActivities([FromQuery] int limit = 10, CancellationToken cancellationToken = default)
    {
        var activities = await dashboardService.GetActivitiesAsync(limit, cancellationToken);
        return Ok(activities);
    }
}
