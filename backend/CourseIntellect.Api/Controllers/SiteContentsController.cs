using CourseIntellect.Application.DTOs.SiteContent;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class SiteContentsController(ISiteContentService siteContentService) : ControllerBase
{
    [HttpGet("{sectionKey}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublished(string sectionKey, [FromQuery] string language = "tr", CancellationToken cancellationToken = default)
    {
        var item = await siteContentService.GetPublishedAsync(sectionKey, language, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("{sectionKey}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateOrUpdate(string sectionKey, [FromBody] UpdateSiteContentRequest request, CancellationToken cancellationToken = default)
    {
        var item = await siteContentService.CreateOrUpdateAsync(sectionKey, request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("{sectionKey}/publish")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Publish(string sectionKey, [FromQuery] string language = "tr", CancellationToken cancellationToken = default)
    {
        var item = await siteContentService.PublishLatestAsync(sectionKey, language, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpGet("history/{sectionKey}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetHistory(string sectionKey, [FromQuery] string language = "tr", CancellationToken cancellationToken = default)
    {
        var items = await siteContentService.GetHistoryAsync(sectionKey, language, cancellationToken);
        return Ok(items);
    }
}
