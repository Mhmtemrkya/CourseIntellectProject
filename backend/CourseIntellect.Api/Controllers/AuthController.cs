using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await authService.LoginAsync(request, cancellationToken);
            return result is null ? Unauthorized(new { message = "Kullanici adi veya sifre hatali." }) : Ok(result);
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
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.RefreshAsync(request, cancellationToken);
        return result is null ? Unauthorized(new { message = "Refresh token gecersiz veya suresi dolmus." }) : Ok(result);
    }

    [HttpPost("register")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.RegisterAsync(request, cancellationToken);
        return result is null ? Conflict(new { message = "Bu kullanici adi zaten kayitli." }) : Ok(result);
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

    /// <summary>Debug: JWT claim'leri ve IsInRole kontrolü</summary>
    [Authorize]
    [HttpGet("debug-claims")]
    public IActionResult DebugClaims()
    {
        var identity = User.Identity as System.Security.Claims.ClaimsIdentity;
        return Ok(new
        {
            IsAuthenticated = User.Identity?.IsAuthenticated,
            RoleClaimType = identity?.RoleClaimType,
            NameClaimType = identity?.NameClaimType,
            IsInRoleAdmin = User.IsInRole("Admin"),
            IsInRoleDeveloper = User.IsInRole("Developer"),
            IsInRoleStudent = User.IsInRole("Student"),
            IsInRoleTeacher = User.IsInRole("Teacher"),
            Claims = identity?.Claims.Select(c => new { c.Type, c.Value }).ToList()
        });
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
