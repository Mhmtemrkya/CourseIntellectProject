using CourseIntellect.Application.DTOs.Translations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
// Çeviriler tüm kurumlar ve herkese açık site için ortaktır; yalnız platform
// yöneticisi değiştirir (eskiden her kurum yöneticisi değiştirebiliyordu).
public sealed class TranslationsController(ITranslationService translationService) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? language,
        [FromQuery] string? category,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var items = await translationService.GetAllAsync(language, category, search, cancellationToken);
        return Ok(items);
    }

    [HttpPut]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Upsert([FromBody] BulkUpsertTranslationRequest request, CancellationToken cancellationToken)
    {
        var items = await translationService.UpsertManyAsync(request.Items, cancellationToken);
        return Ok(items);
    }

    [HttpGet("export")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Export([FromQuery] string language = "tr", CancellationToken cancellationToken = default)
    {
        var items = await translationService.ExportAsync(language, cancellationToken);
        return Ok(items);
    }
}
