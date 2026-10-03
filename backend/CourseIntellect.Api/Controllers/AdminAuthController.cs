using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CourseIntellect.Infrastructure.Auth;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Route("api/admin-auth")]
[EnableRateLimiting("auth")]
[RequestSizeLimit(8192)]
public sealed class AdminAuthController(IAuthService auth, AdminEmailAccessPolicy policy) : ControllerBase
{
    [HttpPost("start")]
    public async Task<IActionResult> Start(LoginRequest request, CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "no-store";
        if (!policy.IsManagementRequest(HttpContext) || !policy.IsConfigured) return GateDenied();
        try
        {
            var challenge = await auth.BeginAdminLoginAsync(request, cancellationToken);
            return challenge is null ? Unauthorized(new { message = "Giriş başlatılamadı. Bilgilerinizi kontrol edin ve bir süre sonra tekrar deneyin." }) : Ok(challenge);
        }
        catch (AccountLockedException ex)
        {
            Response.Headers.RetryAfter = (ex.RetryAfterMinutes * 60).ToString();
            return StatusCode(429, new { code = "ACCOUNT_LOCKED", message = ex.Message });
        }
        catch (PublicDemoPasswordException)
        {
            return Unauthorized(new { message = "Bu parola yönetim erişimi için kullanılamaz." });
        }
        catch (TemporaryPasswordExpiredException)
        {
            return Unauthorized(new { message = "Yönetici hesabının parolası güncellenmelidir." });
        }
    }

    [HttpPost("verify")]
    public async Task<IActionResult> Verify(AdminMfaVerifyRequest request, CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "no-store";
        if (!policy.IsManagementRequest(HttpContext) || !policy.IsConfigured) return GateDenied();
        var session = await auth.CompleteAdminLoginAsync(request, cancellationToken);
        return session is null ? Unauthorized(new { message = "Kod geçersiz, kullanılmış veya doğrulama süresi dolmuş. Yeni kodu deneyin ya da yeniden başlayın." }) : Ok(session);
    }

    private ObjectResult GateDenied() => StatusCode(403, new
    {
        code = "ADMIN_ACCESS_REQUIRED",
        message = "Yönetim erişimi doğrulanamadı. Yönetim adresini kullanın."
    });
}
