using CourseIntellect.Application.DTOs.ContactMessages;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
// Pazarlama sitesinin iletişim mesajları platforma aittir (aday müşteri ad/e-posta/
// telefon). Eskiden her kurum yöneticisi tüm mesajları okuyup silebiliyordu.
public sealed class ContactMessagesController(IContactMessageService contactMessageService, ICaptchaVerificationService captcha) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("public-form")]
    public async Task<IActionResult> Create([FromBody] CreateContactMessageRequest request, CancellationToken cancellationToken)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var verification = await captcha.VerifyAsync(request.CaptchaToken, ipAddress, cancellationToken);
        if (!verification.IsAllowed) return BadRequest(new { message = "Lütfen güvenlik doğrulamasını tamamlayın." });
        var created = await contactMessageService.CreateAsync(request, ipAddress, cancellationToken);
        return Ok(created);
    }

    [HttpGet]
    [Authorize(Policy = "PlatformAdmin")]
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
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var item = await contactMessageService.GetByIdAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateContactMessageStatusRequest request, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.UpdateStatusAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/read")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.MarkAsReadAsync(id, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/star")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> ToggleStar(Guid id, [FromBody] ToggleStarRequest request, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.ToggleStarAsync(id, request.IsStarred, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/reply")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> MarkAsReplied(Guid id, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.MarkAsRepliedAsync(id, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPut("{id:guid}/archive")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        var updated = await contactMessageService.ArchiveAsync(id, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await contactMessageService.DeleteAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}

public sealed record ToggleStarRequest(bool IsStarred);
