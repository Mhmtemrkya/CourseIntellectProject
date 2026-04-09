using CourseIntellect.Application.DTOs.Courses;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class CoursesController(ICourseService courseService) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? isActive, CancellationToken cancellationToken)
    {
        var items = await courseService.GetAllAsync(search, isActive, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateCourseRequest request, CancellationToken cancellationToken)
    {
        var created = await courseService.CreateAsync(request, cancellationToken);
        return Ok(created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCourseRequest request, CancellationToken cancellationToken)
    {
        var updated = await courseService.UpdateAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await courseService.DeleteAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}
