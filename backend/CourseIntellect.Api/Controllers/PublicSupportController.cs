using System.ComponentModel.DataAnnotations;
using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public-support")]
public sealed class PublicSupportController(
    CourseIntellectDbContext db,
    IPlatformOperationsService platform,
    ICaptchaVerificationService captcha) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("public-form")]
    public async Task<IActionResult> Create(PublicSupportRequest request, CancellationToken ct)
    {
        var verification = await captcha.VerifyAsync(request.CaptchaToken,
            HttpContext.Connection.RemoteIpAddress?.ToString(), ct);
        if (!verification.IsAllowed) return BadRequest(new { message = "Lütfen güvenlik doğrulamasını tamamlayın." });
        // A customer number identifies routing only; it never grants access to tickets or tenant data.
        var customerNumber = request.CustomerNumber.Trim().ToUpperInvariant();
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(t => t.CustomerNumber == customerNumber, ct);
        await platform.CreateSupportTicketAsync(new CreateSupportTicketRequest(
            request.Subject.Trim(), tenant?.Name ?? "Eşleşmeyen müşteri numarası", request.Name.Trim(),
            "Harici başvuru (kimlik doğrulanmadı)", request.Category, "normal", request.Message.Trim(),
            request.Message.Trim(), tenant?.Id, customerNumber, request.Email.Trim()), ct);
        // Same response for unknown numbers; don't expose registration status or contact details.
        return Accepted(new { message = "Talebiniz alındı. Destek ekibimiz belirttiğiniz e-posta adresinden size ulaşacak." });
    }
}

public sealed record PublicSupportRequest(
    [Required, StringLength(40, MinimumLength = 3)] string CustomerNumber,
    [Required, StringLength(150, MinimumLength = 2)] string Name,
    [Required, EmailAddress, StringLength(180)] string Email,
    [Required, StringLength(180, MinimumLength = 3)] string Subject,
    [Required, StringLength(2000, MinimumLength = 10)] string Message,
    [Required, RegularExpression("^(Destek|Şikayet|Erişim)$")] string Category,
    string? CaptchaToken);
