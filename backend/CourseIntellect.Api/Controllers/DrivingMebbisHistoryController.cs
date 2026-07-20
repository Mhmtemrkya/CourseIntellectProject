using CourseIntellect.Api.Authorization;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/driving-school/mebbis/history")]
public sealed class DrivingMebbisHistoryController(CourseIntellectDbContext db) : ControllerBase
{
    [HttpGet("students/{profileId:guid}")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView, DrivingPermissions.StudentView)]
    public async Task<IActionResult> StudentTimeline(Guid profileId, [FromQuery] string? type,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (page < 1 || pageSize is < 1 or > 100) return BadRequest(new { message = "Sayfalama değerleri geçersiz." });
        if (!await db.StudentDrivingProfiles.AsNoTracking().AnyAsync(x => x.Id == profileId, ct)) return NotFound(new { message = "Kursiyer bulunamadı." });
        if (User.IsInRole("Student"))
        {
            var userId = CurrentUserId();
            var ownProfileId = userId is null ? null : await db.StudentDrivingProfiles.AsNoTracking()
                .Join(db.Students.AsNoTracking().Where(x => x.UserId == userId), p => p.StudentId, s => s.Id, (p, _) => (Guid?)p.Id)
                .SingleOrDefaultAsync(ct);
            if (ownProfileId != profileId) return Forbid();
        }
        DrivingMebbisHistoryEventType? parsedType = null;
        if (!string.IsNullOrWhiteSpace(type))
        {
            if (!Enum.TryParse<DrivingMebbisHistoryEventType>(type, true, out var value) || !Enum.IsDefined(value))
                return BadRequest(new { message = "Geçmiş türü geçersiz." });
            parsedType = value;
        }

        Response.Headers.CacheControl = "no-store, no-cache";
        var query = db.DrivingMebbisHistoryEvents.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId);
        if (parsedType.HasValue) query = query.Where(x => x.EventType == parsedType.Value);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new
            {
                x.Id, eventType = x.EventType.ToString(), severity = x.Severity.ToString(), x.Title, x.Description,
                x.Status, x.SourceType, x.SourceId, x.ActorName, x.OccurredAtUtc,
            }).ToListAsync(ct);
        var summary = await db.DrivingMebbisHistoryEvents.AsNoTracking().Where(x => x.StudentDrivingProfileId == profileId)
            .GroupBy(x => x.EventType).Select(x => new { type = x.Key.ToString(), count = x.Count() }).ToListAsync(ct);
        return Ok(new { profileId, items, summary, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) });
    }

    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (db.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}

internal static class DrivingMebbisHistoryWriter
{
    public static void AddMebbisHistory(this CourseIntellectDbContext db, Guid profileId,
        DrivingMebbisHistoryEventType eventType, string title, string description, string status,
        string sourceType, Guid? sourceId, Guid? actorUserId, string actorName,
        DrivingMebbisHistorySeverity severity = DrivingMebbisHistorySeverity.Info, DateTime? occurredAtUtc = null)
    {
        db.DrivingMebbisHistoryEvents.Add(new DrivingMebbisHistoryEvent
        {
            StudentDrivingProfileId = profileId,
            EventType = eventType,
            Severity = severity,
            Title = Clean(title, 200),
            Description = Clean(description, 1000),
            Status = Clean(status, 40),
            SourceType = Clean(sourceType, 80),
            SourceId = sourceId,
            ActorUserId = actorUserId,
            ActorName = Clean(string.IsNullOrWhiteSpace(actorName) ? "Sistem" : actorName, 150),
            OccurredAtUtc = occurredAtUtc ?? DateTime.UtcNow,
        });
    }

    private static string Clean(string? value, int max)
    {
        var normalized = new string((value ?? string.Empty).Where(x => !char.IsControl(x) || x is '\n' or '\t').ToArray()).Trim();
        normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"(?<!\d)\d{10,11}(?!\d)", "[kişisel veri gizlendi]");
        return normalized.Length <= max ? normalized : normalized[..max];
    }
}
