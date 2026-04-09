using CourseIntellect.Application.DTOs.Meetings;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class MeetingRequestsController(IMeetingRequestService meetingRequestService, CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string AvailabilitySectionKey = "meeting-availability-slots";

    [HttpGet("slots")]
    public async Task<IActionResult> GetSlots(
        [FromQuery] string? advisor = null,
        [FromQuery] string? teacherName = null,
        [FromQuery] bool onlineMeeting = true,
        CancellationToken cancellationToken = default)
    {
        var resolvedAdvisor = string.IsNullOrWhiteSpace(advisor) ? teacherName ?? string.Empty : advisor;
        var normalizedAdvisor = CompatibilitySnapshotStore.NormalizeText(resolvedAdvisor);
        var availability = await CompatibilitySnapshotStore.LoadListAsync<MeetingAvailabilitySlotSnapshot>(dbContext, AvailabilitySectionKey, cancellationToken);
        var configuredSlots = availability
            .Where(item => item.OnlineMeeting == onlineMeeting && CompatibilitySnapshotStore.NormalizeText(item.Advisor) == normalizedAdvisor)
            .OrderBy(item => item.Slot)
            .ToList();

        var requests = await meetingRequestService.GetRequestsAsync(resolvedAdvisor, null, cancellationToken);
        var taken = requests
            .Where(item => item.OnlineMeeting == onlineMeeting && !string.Equals(item.Status, "Reddedildi", StringComparison.OrdinalIgnoreCase))
            .Select(item => item.Slot)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var response = configuredSlots
            .Where(item => !taken.Contains(item.Slot))
            .Take(6)
            .Select(item => new
            {
                slot = item.Slot,
                advisor = resolvedAdvisor,
                onlineMeeting = item.OnlineMeeting,
            })
            .ToList();

        return Ok(response);
    }

    [HttpGet("availability")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> GetAvailability([FromQuery] string? advisor = null, [FromQuery] string? teacherName = null, CancellationToken cancellationToken = default)
    {
        var resolvedAdvisor = string.IsNullOrWhiteSpace(advisor) ? teacherName ?? string.Empty : advisor;
        var normalizedAdvisor = CompatibilitySnapshotStore.NormalizeText(resolvedAdvisor);
        var items = await CompatibilitySnapshotStore.LoadListAsync<MeetingAvailabilitySlotSnapshot>(dbContext, AvailabilitySectionKey, cancellationToken);
        return Ok(items
            .Where(item => CompatibilitySnapshotStore.NormalizeText(item.Advisor) == normalizedAdvisor)
            .OrderBy(item => item.Slot)
            .Select(item => new
            {
                id = item.Id,
                advisor = item.Advisor,
                slot = item.Slot,
                onlineMeeting = item.OnlineMeeting,
                createdAtUtc = item.CreatedAtUtc,
            }).ToList());
    }

    [HttpGet("advisors")]
    public async Task<IActionResult> GetAvailableAdvisors(CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<MeetingAvailabilitySlotSnapshot>(dbContext, AvailabilitySectionKey, cancellationToken);
        var advisors = items
            .Select(item => item.Advisor)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item)
            .ToList();
        return Ok(advisors);
    }

    [HttpPost("availability")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> CreateAvailability([FromBody] MeetingAvailabilityCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Advisor) || string.IsNullOrWhiteSpace(request.Slot))
        {
            return BadRequest(new { message = "Öğretmen ve saat zorunludur." });
        }

        var items = await CompatibilitySnapshotStore.LoadListAsync<MeetingAvailabilitySlotSnapshot>(dbContext, AvailabilitySectionKey, cancellationToken);
        var exists = items.Any(item =>
            item.OnlineMeeting == request.OnlineMeeting &&
            item.Slot == request.Slot.Trim() &&
            CompatibilitySnapshotStore.NormalizeText(item.Advisor) == CompatibilitySnapshotStore.NormalizeText(request.Advisor));
        if (exists)
        {
            return BadRequest(new { message = "Bu saat zaten tanımlı." });
        }

        var created = new MeetingAvailabilitySlotSnapshot
        {
            Id = Guid.NewGuid(),
            Advisor = request.Advisor.Trim(),
            Slot = request.Slot.Trim(),
            OnlineMeeting = request.OnlineMeeting,
            CreatedAtUtc = DateTime.UtcNow,
        };
        items.Add(created);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, AvailabilitySectionKey, items, created.Advisor, cancellationToken);

        return Ok(new
        {
            id = created.Id,
            advisor = created.Advisor,
            slot = created.Slot,
            onlineMeeting = created.OnlineMeeting,
            createdAtUtc = created.CreatedAtUtc,
        });
    }

    [HttpDelete("availability/{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> DeleteAvailability(Guid id, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<MeetingAvailabilitySlotSnapshot>(dbContext, AvailabilitySectionKey, cancellationToken);
        var removed = items.RemoveAll(item => item.Id == id);
        if (removed == 0) return NotFound();
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, AvailabilitySectionKey, items, User.Identity?.Name ?? "meeting", cancellationToken);
        return Ok(new { success = true, id });
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? advisor,
        [FromQuery] string? parentName,
        CancellationToken cancellationToken)
    {
        var list = await meetingRequestService.GetRequestsAsync(advisor, parentName, cancellationToken);
        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> Create([FromBody] CreateMeetingRequestRequest request, CancellationToken cancellationToken)
    {
        var created = await meetingRequestService.CreateRequestAsync(request, cancellationToken);
        return Ok(created);
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateMeetingRequestStatusRequest request, CancellationToken cancellationToken)
    {
        var updated = await meetingRequestService.UpdateStatusAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }
}

public sealed class MeetingAvailabilityCreateRequest
{
    public string Advisor { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public bool OnlineMeeting { get; set; } = true;
}

public sealed class MeetingAvailabilitySlotSnapshot
{
    public Guid Id { get; set; }
    public string Advisor { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public bool OnlineMeeting { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
