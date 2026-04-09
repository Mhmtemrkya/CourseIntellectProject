using CourseIntellect.Application.DTOs.Translations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
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
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Upsert([FromBody] BulkUpsertTranslationRequest request, CancellationToken cancellationToken)
    {
        var items = await translationService.UpsertManyAsync(request.Items, cancellationToken);
        return Ok(items);
    }

    [HttpGet("export")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Export([FromQuery] string language = "tr", CancellationToken cancellationToken = default)
    {
        var items = await translationService.ExportAsync(language, cancellationToken);
        return Ok(items);
    }
}
