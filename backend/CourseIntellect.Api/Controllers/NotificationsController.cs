using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class NotificationsController(INotificationService notificationService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? targetRole, [FromQuery] string? audience, CancellationToken cancellationToken)
    {
        var items = await notificationService.GetNotificationsAsync(targetRole, audience, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative,Teacher")]
    public async Task<IActionResult> Create([FromBody] CreateNotificationRequest request, CancellationToken cancellationToken)
    {
        var item = await notificationService.CreateNotificationAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        await notificationService.MarkAsReadAsync(id, cancellationToken);
        return NoContent();
    }
}
