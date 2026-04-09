using CourseIntellect.Application.DTOs.ContactMessages;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ContactMessagesController(IContactMessageService contactMessageService) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Create([FromBody] CreateContactMessageRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var created = await contactMessageService.CreateAsync(request, ipAddress, cancellationToken);
        return Ok(created);
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] bool? starred,
        CancellationToken cancellationToken)
    {
        var items = await contactMessageService.GetAllAsync(search, status, starred, cancellationToken);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var item = await contactMessageService.GetByIdAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateContactMessageStatusRequest request, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.UpdateStatusAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/read")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.MarkAsReadAsync(id, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/star")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleStar(Guid id, [FromBody] ToggleStarRequest request, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.ToggleStarAsync(id, request.IsStarred, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/reply")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkAsReplied(Guid id, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.MarkAsRepliedAsync(id, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/archive")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.ArchiveAsync(id, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await contactMessageService.DeleteAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}

public sealed record ToggleStarRequest(bool IsStarred);
