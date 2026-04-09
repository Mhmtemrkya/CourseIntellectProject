using CourseIntellect.Application.DTOs.Accounting;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AccountingController(IAccountingService accountingService, CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string BenefitSectionKey = "accounting-benefits";

    [HttpGet("dashboard")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> GetDashboard(CancellationToken cancellationToken)
    {
        var data = await accountingService.GetDashboardAsync(cancellationToken);
        var benefits = await CompatibilitySnapshotStore.LoadListAsync<AccountingBenefitSnapshot>(dbContext, BenefitSectionKey, cancellationToken);
        return Ok(new
        {
            invoices = data.Invoices,
            salaries = data.Salaries,
            approvals = data.Approvals,
            collections = data.Collections,
            installments = data.Installments,
            benefits = benefits.Select(MapBenefit).ToList(),
            notifications = data.Notifications,
            auditLogs = data.AuditLogs,
        });
    }

    [HttpGet("benefits")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> GetBenefits(CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<AccountingBenefitSnapshot>(dbContext, BenefitSectionKey, cancellationToken);
        return Ok(items.Select(MapBenefit).ToList());
    }

    [HttpPost("benefits")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> CreateBenefit([FromBody] CreateAccountingBenefitRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.StudentName) ||
            string.IsNullOrWhiteSpace(request.StudentUsername) ||
            string.IsNullOrWhiteSpace(request.ClassName) ||
            string.IsNullOrWhiteSpace(request.BenefitType) ||
            string.IsNullOrWhiteSpace(request.Rate))
        {
            return BadRequest(new { message = "Öğrenci, sınıf, tür ve oran zorunludur." });
        }

        var benefits = await CompatibilitySnapshotStore.LoadListAsync<AccountingBenefitSnapshot>(dbContext, BenefitSectionKey, cancellationToken);
        var benefitType = string.Equals(request.BenefitType.Trim(), "Burs", StringComparison.OrdinalIgnoreCase) ? "Burs" : "İndirim";
        var item = new AccountingBenefitSnapshot
        {
            Id = Guid.NewGuid(),
            StudentName = request.StudentName.Trim(),
            StudentUsername = request.StudentUsername.Trim(),
            ClassName = request.ClassName.Trim(),
            BenefitType = benefitType,
            Title = string.IsNullOrWhiteSpace(request.Title) ? $"{benefitType} Tanımı" : request.Title.Trim(),
            Rate = request.Rate.Trim(),
            TotalAmount = NormalizeMoney(request.TotalAmount),
            NetAmount = CalculateNetAmount(request.TotalAmount, request.Rate),
            Status = "Onay Bekliyor",
            Note = request.Note?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow,
        };

        benefits.Add(item);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, BenefitSectionKey, benefits, item.StudentUsername, cancellationToken);

        await dbContext.AccountingApprovals.AddAsync(new AccountingApproval
        {
            Id = Guid.NewGuid(),
            Title = $"{item.BenefitType}: {item.StudentName}",
            Reason = string.IsNullOrWhiteSpace(item.Note) ? item.Title : item.Note,
            Category = item.BenefitType,
            Status = "Bekliyor",
            SourceType = "benefit",
            SourceKey = item.Id.ToString(),
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapBenefit(item));
    }

    [HttpPost("invoices")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateInvoiceAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("salaries")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> CreateSalary([FromBody] CreateSalaryRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateSalaryAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("collections")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> CreateCollection([FromBody] CreateCollectionRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateCollectionAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("collections/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> UpdateCollection(Guid id, [FromBody] CreateCollectionRequest request, CancellationToken cancellationToken)
    {
        var item = await dbContext.AccountingCollections.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        item.Name = request.Name.Trim();
        item.ClassName = request.ClassName.Trim();
        item.Amount = NormalizeMoney(request.Amount);
        item.Method = request.Method.Trim();
        item.Note = request.Note.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new AccountingCollectionDto(item.Id.ToString(), item.Name, item.ClassName, item.Amount, item.Method, item.Time, item.Note));
    }

    [HttpDelete("collections/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> DeleteCollection(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.AccountingCollections.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        dbContext.AccountingCollections.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("installments")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> CreateInstallment([FromBody] CreateInstallmentRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateInstallmentAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("installments/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> UpdateInstallment(Guid id, [FromBody] UpdateInstallmentRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.UpdateInstallmentAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("approvals/{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateApprovalStatus(Guid id, [FromBody] UpdateApprovalStatusRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.UpdateApprovalStatusAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("notifications")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> CreateNotification([FromBody] CreateAccountingNotificationRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateNotificationAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("bulk-reminders")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> SendBulkReminders(CancellationToken cancellationToken)
    {
        var installments = await dbContext.AccountingInstallments
            .AsNoTracking()
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        var overdue = installments.Where(item =>
            item.Status.Contains("Gec", StringComparison.OrdinalIgnoreCase) ||
            item.Status.Contains("Overdue", StringComparison.OrdinalIgnoreCase) ||
            CompatibilitySnapshotStore.ParseDateLabel(item.Due) < DateTime.Today).ToList();

        if (overdue.Count == 0)
        {
            return Ok(new { sentCount = 0, message = "Geciken kayıt bulunmuyor." });
        }

        foreach (var item in overdue)
        {
            await dbContext.Notifications.AddAsync(new NotificationItem
            {
                Id = Guid.NewGuid(),
                Title = "Ödeme hatırlatması",
                Message = $"{item.Student} için {item.Amount} tutarlı ödeme bekleniyor.",
                TimeLabel = "Bugün",
                Audience = "Parent",
                TargetRole = "Parent",
                Category = "AccountingReminder",
                IsRead = false,
            }, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { sentCount = overdue.Count, message = "Hatırlatmalar gönderildi." });
    }

    [HttpPut("notifications/read-all")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> MarkAllNotificationsRead(CancellationToken cancellationToken)
    {
        await accountingService.MarkAllNotificationsReadAsync(cancellationToken);
        return NoContent();
    }

    private static string NormalizeMoney(string? value)
    {
        var raw = (value ?? "0").Trim();
        return raw.StartsWith("₺", StringComparison.Ordinal) ? raw : $"₺{raw}";
    }

    private static string CalculateNetAmount(string? totalAmount, string? rate)
    {
        var total = ParseMoney(totalAmount);
        var rateValue = ParsePercent(rate);
        var net = Math.Round(total - (total * rateValue / 100m), 2);
        return $"₺{net:0.##}";
    }

    private static decimal ParseMoney(string? value)
    {
        var normalized = (value ?? "0").Replace("₺", string.Empty).Replace(".", string.Empty).Replace(',', '.').Trim();
        return decimal.TryParse(normalized, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var amount)
            ? amount
            : 0m;
    }

    private static decimal ParsePercent(string? value)
    {
        var normalized = (value ?? "0").Replace("%", string.Empty).Replace(',', '.').Trim();
        return decimal.TryParse(normalized, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var amount)
            ? amount
            : 0m;
    }

    private static object MapBenefit(AccountingBenefitSnapshot item)
    {
        return new
        {
            id = item.Id,
            studentName = item.StudentName,
            studentUsername = item.StudentUsername,
            className = item.ClassName,
            benefitType = item.BenefitType,
            title = item.Title,
            rate = item.Rate,
            totalAmount = item.TotalAmount,
            netAmount = item.NetAmount,
            status = item.Status,
            note = item.Note,
            createdAtLabel = item.CreatedAtUtc.ToString("dd.MM.yyyy"),
        };
    }
}

public sealed class CreateAccountingBenefitRequest
{
    public string StudentName { get; set; } = string.Empty;
    public string StudentUsername { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string BenefitType { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string Rate { get; set; } = string.Empty;
    public string? TotalAmount { get; set; }
    public string? Note { get; set; }
}

public sealed class AccountingBenefitSnapshot
{
    public Guid Id { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string StudentUsername { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string BenefitType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Rate { get; set; } = string.Empty;
    public string TotalAmount { get; set; } = string.Empty;
    public string NetAmount { get; set; } = string.Empty;
    public string Status { get; set; } = "Onay Bekliyor";
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
