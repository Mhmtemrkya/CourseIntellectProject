using System.Security.Claims;
using CourseIntellect.Application.DTOs.Accounting;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class AccountingController(
    IAccountingService accountingService,
    IStudentFinanceService studentFinanceService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string BenefitSectionKey = "accounting-benefits";

    [HttpGet("dashboard")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> GetDashboard(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        if (fromUtc.HasValue && toUtc.HasValue && toUtc <= fromUtc)
            return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden sonra olmalıdır." });
        var data = await accountingService.GetDashboardAsync(fromUtc, toUtc, cancellationToken);
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
        var data = await accountingService.GetDashboardAsync(cancellationToken: cancellationToken);
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

        var benefitType = string.Equals(request.BenefitType.Trim(), "Burs", StringComparison.OrdinalIgnoreCase) ? "Burs" : "İndirim";
        var benefitTitle = string.IsNullOrWhiteSpace(request.Title) ? $"{benefitType} Tanımı" : request.Title.Trim();

        // Tanım öğrencinin sözleşmesine gerçekten uygulanır (ödenmemiş taksitlerden
        // düşülür). Eskiden yalnız bu listeye "Aktif" yazılıyor, borç değişmiyordu.
        var username = request.StudentUsername.Trim();
        var studentUserId = await dbContext.Users.AsNoTracking()
            .Where(x => x.Username == username)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        decimal applied, requested;
        try
        {
            (applied, requested) = await studentFinanceService.ApplyBenefitAsync(
                studentUserId,
                request.StudentName.Trim(),
                ParsePercent(request.Rate),
                benefitType == "Burs",
                benefitTitle,
                cancellationToken);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }

        var benefits = await CompatibilitySnapshotStore.LoadListAsync<AccountingBenefitSnapshot>(dbContext, BenefitSectionKey, cancellationToken);
        var appliedNote = applied < requested
            ? $"Borçtan düşülen: {MoneyParser.Format(applied)} (istenen {MoneyParser.Format(requested)}; kalanı tahsil edilmiş olduğu için düşülemedi)."
            : $"Borçtan düşülen: {MoneyParser.Format(applied)}.";
        var item = new AccountingBenefitSnapshot
        {
            Id = Guid.NewGuid(),
            StudentName = request.StudentName.Trim(),
            StudentUsername = request.StudentUsername.Trim(),
            ClassName = request.ClassName.Trim(),
            BenefitType = benefitType,
            Title = benefitTitle,
            Rate = request.Rate.Trim(),
            TotalAmount = NormalizeMoney(request.TotalAmount),
            NetAmount = CalculateNetAmount(request.TotalAmount, request.Rate),
            // İndirim/burs tanımı artık ayrı bir onay akışına girmez; kaydedildiği
            // anda aktiftir. Rol ve paket yetkisi endpoint seviyesinde korunur.
            Status = "Aktif",
            Note = string.IsNullOrWhiteSpace(request.Note) ? appliedNote : $"{request.Note.Trim()} • {appliedNote}",
            CreatedAtUtc = DateTime.UtcNow,
        };

        benefits.Add(item);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, BenefitSectionKey, benefits, item.StudentUsername, cancellationToken);

        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = $"{item.BenefitType} doğrudan uygulandı",
            Detail = $"{item.StudentName} için {item.Title} uygulandı; {appliedNote}",
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
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Fatura başlığı zorunludur.", action = "Faturanın hangi hizmet veya gider için düzenlendiğini yazın." });
        if (string.IsNullOrWhiteSpace(request.Category))
            return BadRequest(new { message = "Fatura kategorisi zorunludur.", action = "Listeden faturaya uygun kategoriyi seçin." });
        decimal amount;
        try { amount = MoneyParser.Parse(request.Amount); }
        catch { return BadRequest(new { message = "Fatura tutarı geçerli değil.", action = "Sıfırdan büyük sayısal bir tutar girin." }); }
        if (amount <= 0)
            return BadRequest(new { message = "Fatura tutarı sıfırdan büyük olmalıdır.", action = "Faturanın toplam tutarını kontrol edin." });
        if (!DateTime.TryParse(request.Date, out var issueDate))
            return BadRequest(new { message = "Fatura tarihi geçerli değil.", action = "Fatura tarihini takvimden yeniden seçin." });
        if (request.DueDateUtc.HasValue && request.DueDateUtc.Value.Date < issueDate.Date)
            return BadRequest(new { message = "Son ödeme tarihi fatura tarihinden önce olamaz.", action = "Son ödeme tarihini fatura tarihine eşit veya daha ileri seçin." });
        if (request.IsPaid && string.IsNullOrWhiteSpace(request.PaymentMethod))
            return BadRequest(new { message = "Ödenmiş faturada ödeme yöntemi zorunludur.", action = "Nakit, kredi kartı veya havale/EFT seçeneklerinden birini seçin." });
        if (!string.IsNullOrWhiteSpace(request.InvoiceNumber)
            && await dbContext.AccountingInvoices.AnyAsync(x => x.InvoiceNumber == request.InvoiceNumber.Trim().ToUpper(), cancellationToken))
            return Conflict(new { message = "Bu fatura numarası daha önce kullanılmış.", action = "Farklı bir fatura numarası girin veya alanı boş bırakarak otomatik numara oluşturun." });

        var item = await accountingService.CreateInvoiceAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("invoices/{id:guid}/mark-paid")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("billing", "invoice-create")]
    public async Task<IActionResult> MarkInvoicePaid(Guid id, [FromBody] MarkInvoicePaidRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PaymentMethod))
            return BadRequest(new { message = "Ödeme yöntemi zorunludur.", action = "Ödemenin nakit, kredi kartı veya havale/EFT olarak nasıl alındığını seçin." });

        var invoice = await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null)
            return NotFound(new { message = "Ödendi olarak işaretlenecek fatura bulunamadı.", action = "Fatura listesini yenileyip kaydı yeniden seçin." });
        if (string.Equals(invoice.Status, "Ödendi", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "Bu fatura zaten ödendi olarak kayıtlı.", action = "Fatura detayından ödeme tarihini ve yöntemini kontrol edin." });

        invoice.Status = "Ödendi";
        invoice.PaidAtUtc = (request.PaidAtUtc ?? DateTime.UtcNow).ToUniversalTime();
        invoice.PaymentMethod = request.PaymentMethod.Trim();
        if (!string.IsNullOrWhiteSpace(request.Note))
            invoice.Note = string.IsNullOrWhiteSpace(invoice.Note)
                ? request.Note.Trim()
                : $"{invoice.Note} • {request.Note.Trim()}";

        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = "Fatura ödendi olarak işaretlendi",
            Detail = $"{invoice.InvoiceNumber} numaralı fatura {invoice.PaymentMethod} yöntemiyle ödendi.",
            Time = DateTime.UtcNow.ToString("dd.MM.yyyy • HH:mm"),
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new AccountingInvoiceDto(
            invoice.Id.ToString(),
            string.IsNullOrWhiteSpace(invoice.InvoiceNumber) ? invoice.Id.ToString() : invoice.InvoiceNumber,
            invoice.Title,
            invoice.Counterparty,
            invoice.Category,
            invoice.Subtitle,
            invoice.Amount,
            invoice.Status,
            invoice.IssueDateUtc,
            invoice.DueDateUtc,
            invoice.PaidAtUtc,
            invoice.PaymentMethod,
            invoice.Note));
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
        var amount = ParseMoney(request.Amount);
        if (amount <= 0)
            return BadRequest(new { message = "Bordro tutarı sıfırdan büyük olmalıdır." });

        // Bordro onayı yönetici işidir. Muhasebe rolü durumu yalnız "Planlandı" →
        // "Ödendi" ilerletebilir; onay/ret/geri alma kararını veremez. Onaylanmış
        // bordronun tutarı değişirse kayıt yeniden yönetici onayına düşer.
        var currentStatus = NormalizeSalaryStatus(item.Status);
        var requestedStatus = NormalizeSalaryStatus(request.Status);
        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin && requestedStatus != currentStatus
            && !(currentStatus == "Planlandı" && requestedStatus == "Ödendi"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Bordro onay durumu yalnızca yönetici tarafından değiştirilebilir." });
        }

        var amountChanged = MoneyParser.Parse(item.Amount) != amount;
        item.Employee = request.Employee.Trim();
        item.Role = request.Role.Trim();
        item.Amount = MoneyParser.Format(amount);
        item.PayDate = request.PayDate.Trim();
        item.Status = requestedStatus;
        if (!isAdmin && amountChanged && currentStatus == "Planlandı")
        {
            item.Status = "Bekliyor";
            var approval = await dbContext.AccountingApprovals
                .FirstOrDefaultAsync(x => x.SourceType == "salary" && x.SourceKey == item.Id.ToString(), cancellationToken);
            if (approval is null)
            {
                await dbContext.AccountingApprovals.AddAsync(new AccountingApproval
                {
                    Title = $"{item.Employee} bordro talebi",
                    Reason = "Onaylı bordronun tutarı değiştirildi.",
                    Category = "Maaş",
                    Status = "Bekliyor",
                    SourceType = "salary",
                    SourceKey = item.Id.ToString(),
                    UpdatedAtUtc = DateTime.UtcNow,
                }, cancellationToken);
            }
            else
            {
                approval.Status = "Bekliyor";
                approval.Reason = "Onaylı bordronun tutarı değiştirildi.";
                approval.UpdatedAtUtc = DateTime.UtcNow;
            }
        }
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
        // Silinen bordronun onay satırı "Onaylar" ekranında sahipsiz kalmasın.
        var key = item.Id.ToString();
        var approvals = await dbContext.AccountingApprovals
            .Where(x => x.SourceType == "salary" && x.SourceKey == key)
            .ToListAsync(cancellationToken);
        dbContext.AccountingApprovals.RemoveRange(approvals);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("collections")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("collections", "collect")]
    public async Task<IActionResult> CreateCollection([FromBody] CreateCollectionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await accountingService.CreateCollectionAsync(request, CurrentUserId(), cancellationToken);
            return Ok(item);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
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
        // Yalnız taksitlere dokunmayan tahsilat (peşinat, avans) düzeltilebilir;
        // mahsup edilmiş tahsilatın düzeltmesi makbuz üzerinden iadedir. Eskiden
        // düzeltme/silme öğrencinin bütün taksitlerini sıfırdan yeniden dağıtıyor,
        // peşinatı taksitlere de sayıyordu.
        FinancePaymentDto payment;
        try
        {
            payment = await studentFinanceService.UpdateCollectionAsync(
                id, request.Name, ParseMoney(request.Amount), request.Method, request.Note, cancellationToken);
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }

        var studentName = await dbContext.FinancePayments.AsNoTracking()
            .Where(x => x.Id == id).Select(x => x.StudentName).FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        return Ok(new AccountingCollectionDto(
            payment.Id.ToString(),
            studentName,
            request.ClassName?.Trim() ?? string.Empty,
            MoneyParser.Format(payment.Amount),
            payment.Method,
            payment.PaidAtUtc.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
            payment.Note));
    }

    [HttpDelete("collections/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("collections")]
    public async Task<IActionResult> DeleteCollection(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            await studentFinanceService.DeleteCollectionAsync(id, cancellationToken);
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        return NoContent();
    }

    [HttpPost("installments")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("installments", "plan-create")]
    public async Task<IActionResult> CreateInstallment([FromBody] CreateInstallmentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await accountingService.CreateInstallmentAsync(request, cancellationToken);
            return Ok(item);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("installments/{id:guid}")]
    [Authorize(Roles = "Accounting,Admin")]
    [RequireEntitlement("installments", "edit")]
    public async Task<IActionResult> UpdateInstallment(Guid id, [FromBody] UpdateInstallmentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var item = await accountingService.UpdateInstallmentAsync(id, request, CurrentUserId(), cancellationToken);
            return item is null ? NotFound() : Ok(item);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
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
        // Hatırlatma yalnız borçlu öğrencinin kendi velisine gider ve aynı gün tekrar
        // basılırsa çoğalmaz. Eskiden her geciken taksit için bütün velilere açık bir
        // yayın yazılıyordu (her veli başka çocukların adını ve borcunu görüyordu).
        var result = await studentFinanceService.SendOverdueRemindersAsync(cancellationToken);
        if (result.OverdueCount == 0)
        {
            return Ok(new { sentCount = 0, message = "Geciken kayıt bulunmuyor." });
        }

        return Ok(new { sentCount = result.Notified, message = "Hatırlatmalar gönderildi." });
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
        var total = Math.Max(0m, ParseMoney(totalAmount));
        // Oran indirim/burs yüzdesidir; 0-100 dışına taşarsa net tutar negatife veya
        // toplamın üstüne çıkardı. Aralığa sıkıştırıp tek biçimlendiriciden geçiririz.
        var rateValue = Math.Clamp(ParsePercent(rate), 0m, 100m);
        var net = Math.Round(total - (total * rateValue / 100m), 2);
        return MoneyParser.Format(net);
    }

    // Para ayrıştırma tek kaynaktan (Domain/MoneyParser).
    private static decimal ParseMoney(string? value) => MoneyParser.Parse(value);

    private static decimal ParsePercent(string? value)
    {
        var normalized = (value ?? "0").Replace("%", string.Empty).Replace(',', '.').Trim();
        return decimal.TryParse(normalized, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var amount)
            ? amount
            : 0m;
    }

    // Muhasebe ekranı ile maaş ekranının durum etiketlerini tek biçime indirger.
    private static string NormalizeSalaryStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Contains("bekl") || normalized.Contains("pend")) return "Bekliyor";
        if (normalized.Contains("öd") || normalized.Contains("oden") || normalized.Contains("paid")) return "Ödendi";
        if (normalized.Contains("plan") || normalized.Contains("onaylan") || normalized.Contains("approv")) return "Planlandı";
        if (normalized.Contains("red") || normalized.Contains("reject")) return "Reddedildi";
        return "Bekliyor";
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
