using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ContentsController(IContentService contentService, CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] bool visibleOnly = false, CancellationToken cancellationToken = default)
    {
        var items = await contentService.GetContentsAsync(visibleOnly, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateContentRequest request, CancellationToken cancellationToken)
    {
        var item = await contentService.CreateContentAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateContentRequest request, CancellationToken cancellationToken)
    {
        var item = await contentService.UpdateContentAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateContentStatusRequest request, CancellationToken cancellationToken)
    {
        var item = await contentService.UpdateStatusAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.ContentItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        dbContext.ContentItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
