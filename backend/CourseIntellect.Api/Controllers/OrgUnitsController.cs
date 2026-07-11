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
public sealed class OrgUnitsController(
    IOrgUnitService orgUnitService,
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) =>
        Ok(await orgUnitService.GetAsync(cancellationToken));

    /// <summary>Şube sorumlusu seçiminde listelenecek AKTİF kullanıcılar. Personelin yanı
    /// sıra kurum yöneticilerini de içerir — böylece yeni kurumda hiç personel yokken de
    /// ilk şube açılabilir (sorumlu = kurum admini).</summary>
    [HttpGet("manager-candidates")]
    public async Task<IActionResult> GetManagerCandidates(CancellationToken cancellationToken)
    {
        var roles = new[]
        {
            Domain.Enums.UserRole.Admin, Domain.Enums.UserRole.BranchManager,
            Domain.Enums.UserRole.Administrative, Domain.Enums.UserRole.Teacher,
            Domain.Enums.UserRole.Accounting, Domain.Enums.UserRole.Cafeteria,
        };
        var candidates = await dbContext.Users.AsNoTracking()
            .Where(u => u.Status == Domain.Enums.UserStatus.Active && roles.Contains(u.PrimaryRole))
            .OrderBy(u => u.FullName)
            .Select(u => new ManagerCandidateDto(u.Id, u.FullName, u.PrimaryRole.ToString()))
            .ToListAsync(cancellationToken);
        return Ok(candidates);
    }

    /// <summary>Birimi pasif/aktif yapar. Pasif birim seçim listelerinde görünmez; veri silinmez.</summary>
    [HttpPut("{id:guid}/active")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetActive(Guid id, [FromBody] SetOrgUnitActiveRequest request, CancellationToken cancellationToken)
    {
        var unit = await dbContext.OrgUnits.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (unit is null) return NotFound();
        unit.IsActive = request.IsActive;
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            request.IsActive ? "Birim aktifleştirildi" : "Birim pasifleştirildi",
            "OrgUnit",
            nameof(OrgUnit),
            unit.Id.ToString(),
            $"{unit.UnitType}: {unit.Name} {(request.IsActive ? "yeniden aktif" : "pasif")} duruma alındı.",
            cancellationToken);
        return Ok(new { unit.Id, unit.IsActive });
    }

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

        // Şube/kampüs biriminde sorumlu zorunlu ve personel listesinden seçilir.
        var isBranchType = new[] { "şube", "sube", "kampüs", "kampus" }
            .Contains((request.UnitType ?? string.Empty).Trim().ToLowerInvariant());
        if (isBranchType && request.ManagerUserId is null)
        {
            return BadRequest(new { message = "Şube için sorumlu seçimi zorunludur." });
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
