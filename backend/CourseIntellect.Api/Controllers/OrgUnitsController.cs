using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/org-units")]
public sealed class OrgUnitsController(IOrgUnitService orgUnitService, CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) =>
        Ok(await orgUnitService.GetAsync(cancellationToken));

    // Şube atanmamış (BranchId=null) mevcut kayıtları seçilen şubeye taşır.
    // Tenant-güvenli: yalnızca aktif tenant'ın satırları güncellenir.
    [HttpPost("backfill-branch")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BackfillBranch([FromQuery] Guid branchId, CancellationToken cancellationToken)
    {
        if (branchId == Guid.Empty) return BadRequest(new { message = "Şube (branchId) zorunludur." });
        var tenantId = dbContext.CurrentTenantId;
        // Güvenlik: aktif kurum bağlamı yoksa toplu yazma TÜM kurumlara sızardı; reddet.
        if (tenantId is null) return BadRequest(new { message = "Aktif kurum bağlamı yok; toplu şube ataması reddedildi." });

        async Task<int> Fill<T>(DbSet<T> set) where T : class, IBranchScopedEntity =>
            await set.IgnoreQueryFilters()
                .Where(x => x.BranchId == null && x.TenantId == tenantId)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.BranchId, branchId), cancellationToken);

        var updated = 0;
        updated += await Fill(dbContext.Users);
        updated += await Fill(dbContext.Students);
        updated += await Fill(dbContext.Staff);
        updated += await Fill(dbContext.EnrollmentContracts);
        updated += await Fill(dbContext.FinanceInstallments);
        updated += await Fill(dbContext.FinancePayments);
        updated += await Fill(dbContext.ExamSessions);
        updated += await Fill(dbContext.TeacherDuties);
        updated += await Fill(dbContext.AttendanceEntries);
        return Ok(new { updated, message = $"{updated} kayıt şubeye atandı." });
    }

    [HttpPost]
    [RequireEntitlement("org-units", "manage")]
    public async Task<IActionResult> Create([FromBody] CreateOrgUnitRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Birim adı zorunludur." });
        }

        return Ok(await orgUnitService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPut("{id:guid}")]
    [RequireEntitlement("org-units", "manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrgUnitRequest request, CancellationToken cancellationToken)
    {
        var result = await orgUnitService.UpdateAsync(id, request, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [RequireEntitlement("org-units", "manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await orgUnitService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
    {
        return User.FindFirstValue("name")
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("unique_name")
            ?? User.Identity?.Name
            ?? string.Empty;
    }
}
