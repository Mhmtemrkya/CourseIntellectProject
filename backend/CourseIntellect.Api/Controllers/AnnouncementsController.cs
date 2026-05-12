using CourseIntellect.Application.DTOs.Announcements;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AnnouncementsController(IAnnouncementQueryService announcementQueryService, CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? audience,
        [FromQuery] string? className,
        [FromQuery] string? teacherName,
        CancellationToken cancellationToken)
    {
        var list = await announcementQueryService.GetAnnouncementsAsync(audience, className, teacherName, cancellationToken);
        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher,Administrative")]
    public async Task<IActionResult> Create([FromBody] CreateAnnouncementRequest request, CancellationToken cancellationToken)
    {
        var created = await announcementQueryService.CreateAnnouncementAsync(request, cancellationToken);
        return Ok(created);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher,Administrative")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.Announcements.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        dbContext.Announcements.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
