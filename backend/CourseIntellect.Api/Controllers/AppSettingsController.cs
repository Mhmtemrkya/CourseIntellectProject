using CourseIntellect.Application.DTOs.AppSettings;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AppSettingsController(IAppSettingService appSettingService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll([FromQuery] string? category, CancellationToken cancellationToken)
    {
        var items = await appSettingService.GetAllAsync(category, cancellationToken);
        return Ok(items);
    }

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upsert([FromBody] List<UpsertAppSettingRequest> items, CancellationToken cancellationToken)
    {
        var results = await appSettingService.UpsertManyAsync(items, cancellationToken);
        return Ok(results);
    }
}
