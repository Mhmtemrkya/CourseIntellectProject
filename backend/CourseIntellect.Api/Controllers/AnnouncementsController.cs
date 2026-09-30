using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Announcements;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AnnouncementsController(IAnnouncementQueryService announcementQueryService, CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? audience,
        [FromQuery] string? className,
        [FromQuery] string? teacherName,
        CancellationToken cancellationToken)
    {
        var list = await announcementQueryService.GetAnnouncementsAsync(audience, className, teacherName, cancellationToken);

        // Güvenlik: kitle/sınıf süzgeci istemciye bırakılmıştı; öğrenci ve veli
        // öğretmenlere yönelik ya da başka sınıfa özel duyuruları da görebiliyordu.
        // Öğrenci: "Ogrenci" + tüm kurum duyuruları, sınıfsız ya da kendi sınıfı.
        // Veli: "Veli" + tüm kurum duyuruları, sınıfsız ya da çocuklarının sınıfı.
        var isStudent = User.IsInRole("Student");
        var isParent = User.IsInRole("Parent");
        var isStaff = User.IsInRole("Admin") || User.IsInRole("Administrative") || User.IsInRole("Teacher");
        if (!isStaff && (isStudent || isParent))
        {
            var roleAudience = isStudent ? "ogrenci" : "veli";
            var allowedClasses = await StudentScope.ResolveAllowedClassNamesAsync(User, dbContext, cancellationToken) ?? [];
            var classKeys = allowedClasses.Select(CompatibilitySnapshotStore.NormalizeText).ToHashSet();
            list = list
                .Where(item =>
                    (CompatibilitySnapshotStore.NormalizeText(item.Audience) == "tumkurum"
                        || CompatibilitySnapshotStore.NormalizeText(item.Audience).Contains(roleAudience))
                    && (string.IsNullOrWhiteSpace(item.ClassName)
                        || classKeys.Contains(CompatibilitySnapshotStore.NormalizeText(item.ClassName))))
                .ToList();
        }

        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher,Administrative")]
    [RequireEntitlement("notifications", "create")]
    public async Task<IActionResult> Create([FromBody] CreateAnnouncementRequest request, CancellationToken cancellationToken)
    {
        var created = await announcementQueryService.CreateAnnouncementAsync(request, cancellationToken);
        return Ok(created);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher,Administrative")]
    [RequireEntitlement("notifications", "delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.Announcements.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        dbContext.Announcements.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
