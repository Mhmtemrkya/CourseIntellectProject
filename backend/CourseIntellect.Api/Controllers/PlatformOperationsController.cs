using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Policy = "PlatformAdmin")]
[Route("api/platformops")]
public sealed class PlatformOperationsController(
    IPlatformOperationsService platformOperationsService,
    IEmailSender emailSender,
    CourseIntellectDbContext db) : ControllerBase
{
    private bool DenyPlatformAccess()
    {
        var isPlatformAdmin = string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase);
        return !isPlatformAdmin || !string.IsNullOrWhiteSpace(User.FindFirstValue("tenant_id"));
    }

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var overview = await platformOperationsService.GetOverviewAsync(cancellationToken);
        return Ok(overview);
    }

    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants(CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var items = await platformOperationsService.GetTenantsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPut("tenants")]
    public async Task<IActionResult> UpsertTenant([FromQuery] Guid? id, [FromBody] UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var item = await platformOperationsService.UpsertTenantAsync(id, request, cancellationToken);
        return Ok(item);
    }

    [HttpGet("support-tickets")]
    public async Task<IActionResult> GetSupportTickets(CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var items = await platformOperationsService.GetSupportTicketsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("support-tickets")]
    public async Task<IActionResult> CreateSupportTicket([FromBody] CreateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var item = await platformOperationsService.CreateSupportTicketAsync(request, cancellationToken);
        return Ok(item);
    }

    /// <summary>
    /// Pazarlama sitesindeki kurum kaydı formu. ANONİM uç.
    /// </summary>
    /// <remarks>
    /// Yanıt hijyeni: başvuru alındıysa da yinelenen/tavan nedeniyle yutulduysa da
    /// AYNI 202 döner. Oluşan kaydın id/slug bilgisi anonim çağırana verilmez ve
    /// "bu e-posta zaten kayıtlı" gibi bir ayrım sızdırılmaz.
    /// </remarks>
    [HttpPost("tenants/register")]
    [AllowAnonymous]
    [EnableRateLimiting("public-form")]
    public async Task<IActionResult> RegisterTenant([FromBody] RegisterTenantRequest request, CancellationToken cancellationToken)
    {
        var context = new TenantRegistrationContext(
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString(),
            Request.Headers.Referer.ToString());

        var result = await platformOperationsService.RegisterTenantAsync(request, context, cancellationToken);

        return result.Outcome switch
        {
            TenantRegistrationOutcome.Disabled =>
                StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    code = "REGISTRATION_DISABLED",
                    message = "Kurum kaydı geçici olarak kullanılamıyor.",
                }),
            TenantRegistrationOutcome.Invalid =>
                BadRequest(new { code = "VALIDATION_FAILED", message = result.Message }),
            TenantRegistrationOutcome.CaptchaFailed =>
                BadRequest(new { code = "CAPTCHA_FAILED", message = result.Message }),
            TenantRegistrationOutcome.Throttled =>
                StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    code = "RATE_LIMITED",
                    message = "Şu anda çok fazla başvuru alıyoruz. Lütfen daha sonra tekrar deneyin.",
                }),
            // verificationRequired yalnız YAPILANDIRMAYA bakar, sonuca değil: üç 202
            // durumunda da aynı değeri taşır, yani gövde birebir aynı kalır.
            _ => Accepted(new
            {
                ok = true,
                verificationRequired = emailSender.IsConfigured,
                message = emailSender.IsConfigured
                    ? "Başvurunuz alındı. E-posta adresinize gönderdiğimiz doğrulama bağlantısına tıklayın."
                    : "Başvurunuz alındı. İnceleme sonrası sizinle iletişime geçeceğiz.",
            }),
        };
    }

    /// <summary>
    /// Doğrulama bağlantısının ucu. ANONİM.
    /// </summary>
    /// <remarks>
    /// Geçersiz, süresi dolmuş ve daha önce kullanılmış kodlar AYNI yanıtı alır:
    /// aralarındaki farkı göstermek, uçtan jeton denemesiyle bilgi sızdırırdı.
    /// </remarks>
    [HttpPost("tenants/verify")]
    [AllowAnonymous]
    [EnableRateLimiting("public-form")]
    public async Task<IActionResult> VerifyRegistrationContact(
        [FromBody] VerifyRegistrationRequest request,
        CancellationToken cancellationToken)
    {
        var verified = await platformOperationsService.VerifyRegistrationContactAsync(request.Token, cancellationToken);

        return verified
            ? Ok(new { ok = true, message = "Adresiniz doğrulandı. Başvurunuz incelemeye alındı." })
            : BadRequest(new
            {
                code = "VERIFICATION_FAILED",
                message = "Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Yeniden başvurabilirsiniz.",
            });
    }

    [HttpPut("tenants/{id:guid}/approve")]
    public async Task<IActionResult> ApproveTenant(Guid id, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var item = await platformOperationsService.ApproveTenantAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    /// <summary>Kurulum belgesini yeniden üretir. Eski geçici parola geçersiz olur.</summary>
    [HttpPost("tenants/{id:guid}/setup-document")]
    public async Task<IActionResult> RegenerateSetupDocument(Guid id, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();

        var result = await platformOperationsService.RegenerateSetupDocumentAsync(id, cancellationToken);

        return result.Outcome switch
        {
            SetupDocumentOutcome.NotFound => NotFound(),
            SetupDocumentOutcome.AlreadyActivated => BadRequest(new
            {
                code = "ALREADY_ACTIVATED",
                message = "Kurum yöneticisi kendi parolasını belirlemiş. Belge yenilemek onun "
                          + "parolasını habersiz sıfırlar; bunun yerine parola sıfırlama akışını kullanın.",
            }),
            _ => Ok(result.Tenant),
        };
    }

    [HttpPut("tenants/{id:guid}/access")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> SetAccess(Guid id, [FromBody] TenantAccessRequest request, CancellationToken ct)
    {
        if (DenyPlatformAccess()) return Forbid();
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().SingleOrDefaultAsync(t => t.Id == id, ct);
        if (tenant is null) return NotFound();
        if (tenant.Status is not ("active" or "suspended"))
            return BadRequest(new { message = "Önce kurum başvurusunu onaylayın." });
        tenant.Status = request.Enabled ? "active" : "suspended";
        if (!request.Enabled)
        {
            var users = db.Users.IgnoreQueryFilters().Where(u => u.TenantId == id).Select(u => u.Id);
            var sessions = await db.RefreshTokenSessions
                .Where(s => users.Contains(s.UserId) && s.RevokedAtUtc == null).ToListAsync(ct);
            foreach (var session in sessions) session.RevokedAtUtc = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { tenant.Id, tenant.Status });
    }

    [HttpPut("tenants/{id:guid}/reject")]
    public async Task<IActionResult> RejectTenant(
        Guid id,
        [FromQuery] string? reason,
        CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        // Gerekçe isteğe bağlı ve query'den okunur: mevcut paneller gövdesiz PUT atıyor.
        var item = await platformOperationsService.RejectTenantAsync(id, reason, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("tenants/{id:guid}")]
    public async Task<IActionResult> DeleteTenant(Guid id, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var deleted = await platformOperationsService.DeleteTenantAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("tenants/{id:guid}/reset-data")]
    public async Task<IActionResult> ResetTenantData(
        Guid id,
        [FromBody] ResetTenantDataRequest request,
        CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();

        var expectedConfirmation = $"RESET:{id:D}";
        if (!string.Equals(request.Confirmation?.Trim(), expectedConfirmation, StringComparison.Ordinal))
        {
            return BadRequest(new
            {
                message = "Kurum sıfırlama onayı geçersiz.",
                expectedConfirmation
            });
        }

        if (string.IsNullOrWhiteSpace(request.PreserveUsername))
        {
            return BadRequest(new { message = "Korunacak yönetici kullanıcı adı zorunludur." });
        }

        var result = await platformOperationsService.ResetTenantDataAsync(
            id,
            request.PreserveUsername.Trim(),
            cancellationToken);

        return result is null ? NotFound() : Ok(result);
    }

    // --- Kurum kaydı kuyruğu: kara liste ve şüpheli işareti ---

    [HttpGet("registration-blocklist")]
    public async Task<IActionResult> GetRegistrationBlocklist(CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var items = await platformOperationsService.GetRegistrationBlocklistAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("registration-blocklist")]
    public async Task<IActionResult> AddRegistrationBlocklistEntry(
        [FromBody] AddRegistrationBlocklistRequest request,
        CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();

        Guid? actorUserId = Guid.TryParse(User.FindFirstValue("nameid") ?? User.FindFirstValue("sub"), out var parsed)
            ? parsed
            : null;
        var actorName = User.FindFirstValue("name") ?? User.FindFirstValue("unique_name") ?? "Platform";

        var item = await platformOperationsService.AddRegistrationBlocklistEntryAsync(
            request, actorUserId, actorName, cancellationToken);

        return item is null
            ? BadRequest(new { message = "Kara liste kaydı geçersiz. Tür 'domain' ya da 'ip' olmalı." })
            : Ok(item);
    }

    [HttpDelete("registration-blocklist/{id:guid}")]
    public async Task<IActionResult> RemoveRegistrationBlocklistEntry(Guid id, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var removed = await platformOperationsService.RemoveRegistrationBlocklistEntryAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    [HttpPut("tenants/{id:guid}/suspicious")]
    public async Task<IActionResult> SetApplicationSuspicious(
        Guid id,
        [FromQuery] bool value,
        [FromQuery] string? reason,
        CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var item = await platformOperationsService.SetApplicationSuspiciousAsync(id, value, reason, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("support-tickets/{id:guid}")]
    public async Task<IActionResult> UpdateSupportTicket(Guid id, [FromBody] UpdateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        if (DenyPlatformAccess()) return Forbid();
        var item = await platformOperationsService.UpdateSupportTicketAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}

public sealed record TenantAccessRequest(bool Enabled);
