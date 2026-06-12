using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/push")]
public sealed class PushController(CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] PushDeviceRegistrationRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Push token zorunludur." });
        }

        var userId = RequireCurrentUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        var normalizedToken = request.Token.Trim();
        var device = await dbContext.PushDeviceRegistrations
            .FirstOrDefaultAsync(x => x.Token == normalizedToken, cancellationToken);

        if (device is null)
        {
            device = new()
            {
                Token = normalizedToken,
                CreatedAtUtc = DateTime.UtcNow,
            };
            await dbContext.PushDeviceRegistrations.AddAsync(device, cancellationToken);
        }

        device.TenantId = dbContext.CurrentTenantId ?? user?.TenantId;
        device.UserId = userId;
        device.Platform = request.Platform?.Trim() ?? "other";
        device.Username = request.Username?.Trim() ?? user?.Username ?? string.Empty;
        device.FullName = request.FullName?.Trim() ?? user?.FullName ?? string.Empty;
        device.Role = request.Role?.Trim() ?? user?.PrimaryRole.ToString() ?? string.Empty;
        device.DeviceId = request.DeviceId?.Trim() ?? string.Empty;
        device.IsActive = true;
        device.UpdatedAtUtc = DateTime.UtcNow;
        device.LastSeenAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { success = true });
    }

    [HttpPost("unregister")]
    public async Task<IActionResult> Unregister([FromBody] PushDeviceRegistrationRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Push token zorunludur." });
        }

        var userId = RequireCurrentUserId();
        var token = request.Token.Trim();
        var device = await dbContext.PushDeviceRegistrations
            .FirstOrDefaultAsync(x => x.Token == token && x.UserId == userId, cancellationToken);
        if (device is not null)
        {
            device.IsActive = false;
            device.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new { success = true });
    }

    private Guid RequireCurrentUserId()
    {
        var raw = User.FindFirstValue("user_id")
            ?? User.FindFirstValue("nameid")
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var userId)
            ? userId
            : throw new UnauthorizedAccessException("Kullanıcı bilgisi bulunamadı.");
    }
}

public sealed class PushDeviceRegistrationRequest
{
    public string Token { get; set; } = string.Empty;
    public string? Platform { get; set; }
    public string? Username { get; set; }
    public string? FullName { get; set; }
    public string? Role { get; set; }
    public string? DeviceId { get; set; }
}
