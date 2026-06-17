using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/admin-documents")]
public sealed class AdminDocumentsController(IAdminDocumentService documentService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? category,
        [FromQuery] string? direction,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        return Ok(await documentService.GetAsync(category, direction, status, cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDocumentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Başlık zorunludur." });
        }

        return Ok(await documentService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        var result = await documentService.ArchiveAsync(id, CurrentUserId(), CurrentUserName(), cancellationToken);
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
