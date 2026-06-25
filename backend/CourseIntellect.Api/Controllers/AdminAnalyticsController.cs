using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/admin/analytics")]
public sealed class AdminAnalyticsController(IAdminAnalyticsService analyticsService) : ControllerBase
{
    // GET /api/admin/analytics?period=day|week|month|year[&from=yyyy-MM-dd&to=yyyy-MM-dd]
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? period,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        return Ok(await analyticsService.GetAsync(period, from, to, cancellationToken));
    }
}
