using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/push")]
public sealed class PushController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string SectionKey = "push-device-registrations";

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] PushDeviceRegistrationRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Push token zorunludur." });
        }

        var devices = await CompatibilitySnapshotStore.LoadListAsync<PushDeviceRegistrationSnapshot>(dbContext, SectionKey, cancellationToken);
        devices.RemoveAll(item => item.Token == request.Token);
        devices.Add(new PushDeviceRegistrationSnapshot
        {
            Token = request.Token.Trim(),
            Platform = request.Platform?.Trim() ?? "other",
            Username = request.Username?.Trim() ?? string.Empty,
            FullName = request.FullName?.Trim() ?? string.Empty,
            Role = request.Role?.Trim() ?? string.Empty,
            DeviceId = request.DeviceId?.Trim() ?? string.Empty,
            UpdatedAtUtc = DateTime.UtcNow,
        });

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, devices, request.Username?.Trim() ?? "push", cancellationToken);
        return Ok(new { success = true });
    }

    [HttpPost("unregister")]
    public async Task<IActionResult> Unregister([FromBody] PushDeviceRegistrationRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Push token zorunludur." });
        }

        var devices = await CompatibilitySnapshotStore.LoadListAsync<PushDeviceRegistrationSnapshot>(dbContext, SectionKey, cancellationToken);
        devices.RemoveAll(item => item.Token == request.Token.Trim());
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, devices, request.Username?.Trim() ?? "push", cancellationToken);
        return Ok(new { success = true });
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

public sealed class PushDeviceRegistrationSnapshot
{
    public string Token { get; set; } = string.Empty;
    public string Platform { get; set; } = "other";
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
