using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.LoginAsync(request, cancellationToken);
            return result is null ? Unauthorized(new { message = "Kullanici adi veya sifre hatali." }) : Ok(result);
        }
        catch (AccountLockedException ex)
        {
            Response.Headers.RetryAfter = (ex.RetryAfterMinutes * 60).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                code = "ACCOUNT_LOCKED",
                message = ex.Message,
                retryAfterMinutes = ex.RetryAfterMinutes,
            });
        }
        catch (MaintenanceModeException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                code = "MAINTENANCE_MODE",
                message = ex.Message,
            });
        }
    }

    [HttpPost("refresh")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.RefreshAsync(request, cancellationToken);
        return result is null ? Unauthorized(new { message = "Refresh token gecersiz veya suresi dolmus." }) : Ok(result);
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await authService.RequestPasswordResetAsync(request, cancellationToken);
        return Ok(new
        {
            message = "E-posta sistemde kayıtlıysa şifre sıfırlama talebiniz kurum yetkililerine iletildi."
        });
    }

    [Authorize(Roles = "Admin,Administrative")]
    [HttpGet("password-reset-requests")]
    [ProducesResponseType(typeof(IReadOnlyList<PasswordResetRequestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PasswordResetRequests([FromQuery] string? status, CancellationToken cancellationToken)
    {
        var requests = await authService.GetPasswordResetRequestsAsync(status, cancellationToken);
        return Ok(requests);
    }

    [Authorize(Roles = "Admin,Administrative")]
    [HttpPost("password-reset-requests/{id:guid}/review")]
    [ProducesResponseType(typeof(PasswordResetReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReviewPasswordResetRequest(Guid id, [FromBody] ReviewPasswordResetRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.ReviewPasswordResetRequestAsync(id, request, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await authService.GetCurrentUserAsync(userId, cancellationToken);
        return user is null ? Unauthorized() : Ok(user);
    }

    [Authorize]
    [HttpPut("me")]
    [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await authService.UpdateProfileAsync(userId, request, cancellationToken);
        return user is null ? BadRequest(new { message = "Profil guncellenemedi." }) : Ok(user);
    }

    [Authorize]
    [HttpPost("change-password")]
    [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        try
        {
            var user = await authService.ChangePasswordAsync(userId, request, cancellationToken);
            return user is null ? Unauthorized() : Ok(user);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request, CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(request.RefreshToken, cancellationToken);
        return NoContent();
    }

    [HttpPost("pkce/authorize")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(PkceAuthorizeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> PkceAuthorize([FromBody] PkceAuthorizeRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.PkceAuthorizeAsync(request, cancellationToken);
        return result is null
            ? Unauthorized(new { message = "Kimlik dogrulama basarisiz veya gecersiz istemci." })
            : Ok(result);
    }

    [HttpPost("pkce/token")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> PkceToken([FromBody] PkceTokenRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.PkceTokenExchangeAsync(request, cancellationToken);
        return result is null
            ? Unauthorized(new { message = "Gecersiz veya suresi dolmus yetkilendirme kodu." })
            : Ok(result);
    }
}
