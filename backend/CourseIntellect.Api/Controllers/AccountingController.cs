using System.Security.Claims;
using CourseIntellect.Application.DTOs.Accounting;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
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
            // Eski sürümlerde indirim tanımları için açılmış onay satırlarını
            // göstermeyiz; indirim/burs artık doğrudan aktiftir.
            approvals = data.Approvals.Where(x => !string.Equals(x.SourceType, "benefit", StringComparison.OrdinalIgnoreCase)).ToList(),
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

    [HttpGet("exports/csv")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> ExportCsv(CancellationToken cancellationToken)
    {
        // Muhasebe ihracatı backend'de hazırlanır (mobil+desktop ortak kaynak).
        // Tek bir CSV: tahsilatlar, taksitler, faturalar, bordrolar.
        var data = await accountingService.GetDashboardAsync(cancellationToken);
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("Tip,Ad/Sistem,Kategori/Sinif,Tutar,Durum/Tarih");

        foreach (var c in data.Collections)
        {
            builder.AppendLine($"Tahsilat,{CsvEscape(c.Name)},{CsvEscape(c.ClassName)},{CsvEscape(c.Amount)},{CsvEscape(c.Time)}");
        }
        foreach (var i in data.Installments)
        {
            builder.AppendLine($"Taksit,{CsvEscape(i.Student)},{CsvEscape(i.Status)},{CsvEscape(i.Amount)},{CsvEscape(i.Due)}");
        }
        foreach (var inv in data.Invoices)
        {
            builder.AppendLine($"Fatura,{CsvEscape(inv.Title)},{CsvEscape(inv.Category)},{CsvEscape(inv.Amount)},{CsvEscape(inv.Status)}");
        }
        foreach (var s in data.Salaries)
        {
            builder.AppendLine($"Bordro,{CsvEscape(s.Employee)},{CsvEscape(s.Role)},{CsvEscape(s.Amount)},{CsvEscape(s.Status)}");
        }

        var bytes = System.Text.Encoding.UTF8.GetPreamble()
            .Concat(System.Text.Encoding.UTF8.GetBytes(builder.ToString()))
            .ToArray();
        var fileName = $"muhasebe-{DateTime.UtcNow:yyyyMMddHHmm}.csv";
        return File(bytes, "text/csv", fileName);
    }

    private static string CsvEscape(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var needsQuote = value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r');
        var escaped = value.Replace("\"", "\"\"");
        return needsQuote ? $"\"{escaped}\"" : escaped;
    }

    [HttpPost("benefits")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("discounts-scholarships", "define")]
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
            // İndirim/burs tanımı artık ayrı bir onay akışına girmez; kaydedildiği
            // anda aktiftir. Rol ve paket yetkisi endpoint seviyesinde korunur.
            Status = "Aktif",
            Note = request.Note?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow,
        };

        benefits.Add(item);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, BenefitSectionKey, benefits, item.StudentUsername, cancellationToken);

        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = $"{item.BenefitType} doğrudan uygulandı",
            Detail = $"{item.StudentName} için {item.Title} onay beklemeden aktif edildi.",
            Time = DateTime.UtcNow.ToString("dd.MM.yyyy • HH:mm"),
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapBenefit(item));
    }

    [HttpPost("invoices")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("billing", "invoice-create")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateInvoiceAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("salaries")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("salary", "define")]
    public async Task<IActionResult> CreateSalary([FromBody] CreateSalaryRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateSalaryAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpGet("salaries")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> GetSalaries(CancellationToken cancellationToken)
    {
        var items = await dbContext.AccountingSalaries
            .OrderByDescending(x => x.Id)
            .Select(x => new AccountingSalaryDto(x.Id.ToString(), x.Employee, x.Role, x.Amount, x.PayDate, x.Status))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPut("salaries/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("salary", "define")]
    public async Task<IActionResult> UpdateSalary(Guid id, [FromBody] UpdateSalaryRequest request, CancellationToken cancellationToken)
    {
        var item = await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        item.Employee = request.Employee.Trim();
        item.Role = request.Role.Trim();
        item.Amount = NormalizeMoney(request.Amount);
        item.PayDate = request.PayDate.Trim();
        item.Status = request.Status.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new AccountingSalaryDto(item.Id.ToString(), item.Employee, item.Role, item.Amount, item.PayDate, item.Status));
    }

    [HttpDelete("salaries/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("salary")]
    public async Task<IActionResult> DeleteSalary(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();
        dbContext.AccountingSalaries.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("collections")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("collections", "collect")]
    public async Task<IActionResult> CreateCollection([FromBody] CreateCollectionRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateCollectionAsync(request, CurrentUserId(), cancellationToken);
        return Ok(item);
    }

    // Tahsilatı alan personeli kaydetmek için oturumdaki kullanıcı. Inbound claim map
    // kapalı olduğundan user_id/nameid/sub sırasıyla denenir (bkz. jwt-claim-names).
    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    [HttpPut("collections/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("collections", "collect")]
    public async Task<IActionResult> UpdateCollection(Guid id, [FromBody] CreateCollectionRequest request, CancellationToken cancellationToken)
    {
        var item = await dbContext.FinancePayments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();

        var previousStudentName = item.StudentName;
        var previousStudentUserId = item.StudentUserId;
        var previousContractId = item.EnrollmentContractId;

        item.StudentName = string.IsNullOrWhiteSpace(request.Name) ? item.StudentName : request.Name.Trim();
        item.Amount = Math.Max(0m, ParseMoney(request.Amount));
        item.Method = string.IsNullOrWhiteSpace(request.Method) ? "Nakit" : request.Method.Trim();
        item.Note = request.Note?.Trim() ?? string.Empty;
        var targetContract = await dbContext.EnrollmentContracts
            .AsNoTracking()
            .Where(contract => contract.StudentName == item.StudentName)
            .OrderByDescending(contract => contract.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        item.EnrollmentContractId = targetContract?.Id;
        item.StudentUserId = targetContract?.StudentUserId;
        item.FinanceInstallmentId = null;

        await dbContext.SaveChangesAsync(cancellationToken);
        await RecalculateInstallmentPaymentsAsync(previousStudentName, previousStudentUserId, previousContractId, cancellationToken);
        await RecalculateInstallmentPaymentsAsync(item.StudentName, item.StudentUserId, item.EnrollmentContractId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new AccountingCollectionDto(
            item.Id.ToString(),
            item.StudentName,
            request.ClassName?.Trim() ?? string.Empty,
            $"₺{item.Amount:N2}",
            item.Method,
            item.PaidAtUtc.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
            item.Note));
    }

    [HttpDelete("collections/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("collections")]
    public async Task<IActionResult> DeleteCollection(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.FinancePayments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return NotFound();

        var studentName = item.StudentName;
        var studentUserId = item.StudentUserId;
        var contractId = item.EnrollmentContractId;

        dbContext.FinancePayments.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        await RecalculateInstallmentPaymentsAsync(studentName, studentUserId, contractId, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("installments")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("installments", "plan-create")]
    public async Task<IActionResult> CreateInstallment([FromBody] CreateInstallmentRequest request, CancellationToken cancellationToken)
    {
        var item = await accountingService.CreateInstallmentAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("installments/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("installments", "edit")]
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
    [RequireEntitlement("bulk-actions", "bulk-notify")]
    public async Task<IActionResult> SendBulkReminders(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var installments = await dbContext.FinanceInstallments
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var overdue = installments
            .Where(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < now)
            .ToList();

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
                Message = $"{item.StudentName} için ₺{(item.Amount - item.PaidAmount):N2} tutarlı ödeme bekleniyor.",
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
        var normalized = NormalizeMoneyNumber(value);
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

    private static string NormalizeMoneyNumber(string? value)
    {
        var cleaned = new string((value ?? "0")
            .Where(ch => char.IsDigit(ch) || ch == ',' || ch == '.' || ch == '-')
            .ToArray());
        var lastComma = cleaned.LastIndexOf(',');
        var lastDot = cleaned.LastIndexOf('.');

        if (lastComma >= 0 && lastDot >= 0)
        {
            return lastComma > lastDot
                ? cleaned.Replace(".", string.Empty).Replace(',', '.')
                : cleaned.Replace(",", string.Empty);
        }

        if (lastComma >= 0)
        {
            return cleaned.Replace(".", string.Empty).Replace(',', '.');
        }

        if (lastDot >= 0)
        {
            var decimals = cleaned.Length - lastDot - 1;
            return decimals == 3 ? cleaned.Replace(".", string.Empty) : cleaned;
        }

        return cleaned;
    }

    private async Task RecalculateInstallmentPaymentsAsync(
        string? studentName,
        Guid? studentUserId,
        Guid? contractId,
        CancellationToken cancellationToken)
    {
        var normalizedName = studentName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedName) && studentUserId is null && contractId is null)
        {
            return;
        }

        var installments = await dbContext.FinanceInstallments
            .Where(item =>
                (contractId != null && item.EnrollmentContractId == contractId)
                || (studentUserId != null && item.StudentUserId == studentUserId)
                || (!string.IsNullOrWhiteSpace(normalizedName) && item.StudentName == normalizedName))
            .OrderBy(item => item.DueDateUtc)
            .ThenBy(item => item.SeqNo)
            .ToListAsync(cancellationToken);

        if (installments.Count == 0)
        {
            return;
        }

        foreach (var installment in installments)
        {
            installment.PaidAmount = 0m;
            installment.Status = "Pending";
        }

        var payments = await dbContext.FinancePayments
            .Where(item =>
                item.Amount > 0
                && ((contractId != null && item.EnrollmentContractId == contractId)
                    || (studentUserId != null && item.StudentUserId == studentUserId)
                    || (!string.IsNullOrWhiteSpace(normalizedName) && item.StudentName == normalizedName)))
            .OrderBy(item => item.PaidAtUtc)
            .ToListAsync(cancellationToken);

        foreach (var payment in payments)
        {
            var remaining = payment.Amount;
            var orderedInstallments = payment.FinanceInstallmentId is Guid installmentId
                ? installments
                    .Where(item => item.Id == installmentId)
                    .Concat(installments.Where(item => item.Id != installmentId))
                    .ToList()
                : installments;

            foreach (var installment in orderedInstallments)
            {
                if (remaining <= 0) break;

                var due = installment.Amount - installment.PaidAmount;
                if (due <= 0) continue;

                var applied = Math.Min(due, remaining);
                installment.PaidAmount += applied;
                remaining -= applied;
            }
        }

        foreach (var installment in installments)
        {
            installment.Status = installment.PaidAmount <= 0
                ? "Pending"
                : installment.PaidAmount >= installment.Amount
                    ? "Paid"
                    : "Partial";
        }
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
            status = item.Status is "Onay Bekliyor" or "Bekliyor" ? "Aktif" : item.Status,
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
    public string Status { get; set; } = "Aktif";
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
