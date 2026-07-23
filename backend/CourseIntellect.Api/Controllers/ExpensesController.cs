using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// İşletme gider faturaları (mazot, bakım, kira, sigorta, fatura/abonelik,
/// vergi/harç, kırtasiye, reklam, diğer). KURUM TÜRÜNDEN BAĞIMSIZ genel finans
/// modülü: hem okul hem sürücü kursu yöneticisi/muhasebesi aynı ekranı kullanır.
///
/// <para>Personel maaş/primi burada DEĞİL — bordro/muhasebe tarafında.</para>
///
/// <para>Depolama iç ismi olarak sürücü kursundan gelen <c>DrivingExpense</c>
/// tablosu yeniden kullanılır (kullanıcıya görünmez); tenant + şube izolasyonu
/// global query filter ile otomatik uygulanır. İsteğe bağlı <c>VehicleId</c>
/// yalnız sürücü kursunda anlamlıdır (okulda araç listesi boş döner).</para>
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Accounting,BranchManager")]
[Route("api/finance/expenses")]
public sealed class ExpensesController(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "Finance";

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] string? category, [FromQuery] Guid? vehicleId, CancellationToken ct)
    {
        DrivingExpenseCategory? categoryFilter =
            Enum.TryParse<DrivingExpenseCategory>(category, true, out var c) && Enum.IsDefined(c) ? c : null;

        var query = dbContext.DrivingExpenses.AsNoTracking().AsQueryable();
        if (from.HasValue) query = query.Where(x => x.ExpenseDateUtc >= from.Value);
        if (to.HasValue) query = query.Where(x => x.ExpenseDateUtc < to.Value);
        if (categoryFilter.HasValue) query = query.Where(x => x.Category == categoryFilter.Value);
        if (vehicleId.HasValue) query = query.Where(x => x.VehicleId == vehicleId.Value);

        var rows = await query.OrderByDescending(x => x.ExpenseDateUtc).ThenByDescending(x => x.CreatedAtUtc)
            .Select(x => new { x.Id, category = x.Category.ToString(), x.Title, x.VendorName, x.InvoiceNo, x.Amount,
                x.Currency, x.ExpenseDateUtc, x.VehicleId, x.Note, x.BranchId, x.CreatedByUserId, x.CreatedAtUtc, x.UpdatedAtUtc })
            .ToListAsync(ct);

        // "Kim oluşturdu, hangi şube, hangi araç" — detayda göstermek için adları çöz.
        var creatorIds = rows.Where(x => x.CreatedByUserId != null).Select(x => x.CreatedByUserId!.Value).Distinct().ToList();
        var branchIds = rows.Where(x => x.BranchId != null).Select(x => x.BranchId!.Value).Distinct().ToList();
        var vehIds = rows.Where(x => x.VehicleId != null).Select(x => x.VehicleId!.Value).Distinct().ToList();
        var creatorNames = await dbContext.Users.IgnoreQueryFilters().AsNoTracking().Where(x => creatorIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var branchNames = await dbContext.OrgUnits.AsNoTracking().Where(x => branchIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var vehiclePlates = await dbContext.DrivingVehicles.AsNoTracking().Where(x => vehIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.PlateNumber, ct);

        var items = rows.Select(x => new
        {
            x.Id, x.category, x.Title, x.VendorName, x.InvoiceNo, x.Amount, x.Currency, x.ExpenseDateUtc,
            x.VehicleId, vehiclePlate = x.VehicleId is Guid v && vehiclePlates.TryGetValue(v, out var vp) ? vp : null,
            x.Note, x.BranchId, branchName = x.BranchId is Guid b && branchNames.TryGetValue(b, out var bn) ? bn : null,
            x.CreatedByUserId, createdByName = x.CreatedByUserId is Guid cr && creatorNames.TryGetValue(cr, out var cn) ? cn : null,
            x.CreatedAtUtc, x.UpdatedAtUtc,
        }).ToList();

        var byCategory = rows.GroupBy(x => x.category)
            .Select(g => new { category = g.Key, total = g.Sum(y => y.Amount), count = g.Count() })
            .OrderByDescending(x => x.total).ToList();

        return Ok(new
        {
            items,
            summary = new { total = rows.Sum(x => x.Amount), count = rows.Count, byCategory },
            categories = Enum.GetValues<DrivingExpenseCategory>().Select(x => x.ToString()),
            // Araç seçici yalnız sürücü kursunda dolu döner; okulda boş liste.
            vehicles = await dbContext.DrivingVehicles.AsNoTracking().Where(x => x.IsActive)
                .OrderBy(x => x.PlateNumber).Select(x => new { x.Id, x.PlateNumber }).ToListAsync(ct),
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ExpenseRequest request, CancellationToken ct)
    {
        if (await ValidateAsync(request, ct) is { } error) return error;
        var expense = new DrivingExpense
        {
            Category = request.ParsedCategory!.Value,
            Title = request.Title!.Trim(),
            VendorName = (request.VendorName ?? string.Empty).Trim(),
            InvoiceNo = (request.InvoiceNo ?? string.Empty).Trim(),
            Amount = request.Amount,
            Currency = "TRY",
            ExpenseDateUtc = request.ExpenseDateUtc ?? DateTime.UtcNow,
            VehicleId = request.VehicleId,
            Note = (request.Note ?? string.Empty).Trim(),
            CreatedByUserId = CurrentUserId(),
            // TenantId + BranchId ApplyTenantContext ile aktörün şubesine otomatik damgalanır.
        };
        dbContext.DrivingExpenses.Add(expense);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Gider faturası oluşturuldu", AuditCategory, nameof(DrivingExpense), expense.Id.ToString(),
            $"{expense.Title} — {expense.Amount:N2} ₺ ({expense.Category})", null,
            new { expense.Category, expense.Amount, expense.VendorName, expense.InvoiceNo }, ct);
        return Ok(new { expense.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ExpenseRequest request, CancellationToken ct)
    {
        var expense = await dbContext.DrivingExpenses.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (expense is null) return NotFound(new { message = "Gider bulunamadı." });
        if (await ValidateAsync(request, ct) is { } error) return error;
        var before = new { expense.Category, expense.Amount, expense.Title };
        expense.Category = request.ParsedCategory!.Value;
        expense.Title = request.Title!.Trim();
        expense.VendorName = (request.VendorName ?? string.Empty).Trim();
        expense.InvoiceNo = (request.InvoiceNo ?? string.Empty).Trim();
        expense.Amount = request.Amount;
        expense.ExpenseDateUtc = request.ExpenseDateUtc ?? expense.ExpenseDateUtc;
        expense.VehicleId = request.VehicleId;
        expense.Note = (request.Note ?? string.Empty).Trim();
        expense.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Gider faturası güncellendi", AuditCategory, nameof(DrivingExpense), expense.Id.ToString(),
            $"{expense.Title} — {expense.Amount:N2} ₺", before, new { expense.Category, expense.Amount, expense.Title }, ct);
        return Ok(new { expense.Id });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var expense = await dbContext.DrivingExpenses.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (expense is null) return NotFound(new { message = "Gider bulunamadı." });
        dbContext.DrivingExpenses.Remove(expense);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Gider faturası silindi", AuditCategory, nameof(DrivingExpense), id.ToString(),
            $"{expense.Title} — {expense.Amount:N2} ₺", new { expense.Title, expense.Amount }, null, ct);
        return Ok(new { deleted = true });
    }

    private async Task<IActionResult?> ValidateAsync(ExpenseRequest request, CancellationToken ct)
    {
        if (request.ParsedCategory is null) return BadRequest(new { message = "Gider kategorisi geçersiz." });
        var title = (request.Title ?? string.Empty).Trim();
        if (title.Length is < 2 or > 200) return BadRequest(new { message = "Gider başlığı 2-200 karakter olmalıdır." });
        if (request.Amount <= 0 || request.Amount > 100_000_000) return BadRequest(new { message = "Gider tutarı 0'dan büyük olmalıdır." });
        if (request.VehicleId is Guid vid && !await dbContext.DrivingVehicles.AsNoTracking().AnyAsync(x => x.Id == vid, ct))
            return BadRequest(new { message = "Seçilen araç bulunamadı." });
        return null;
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }
}

public sealed record ExpenseRequest(
    string? Category,
    string? Title,
    string? VendorName,
    string? InvoiceNo,
    decimal Amount,
    DateTime? ExpenseDateUtc,
    Guid? VehicleId,
    string? Note)
{
    public DrivingExpenseCategory? ParsedCategory =>
        Enum.TryParse<DrivingExpenseCategory>(Category, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}
