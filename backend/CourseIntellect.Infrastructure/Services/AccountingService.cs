using System.Globalization;
using CourseIntellect.Application.DTOs.Accounting;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

// Not: Öğrenci tahsilat/taksit verisi normalize finans modeline (FinancePayment /
// FinanceInstallment) taşındı. Bu servis tahsilat ve taksit dilimlerini artık o
// tablolardan üretir; fatura/maaş/onay/bildirim/audit kayıtları kendi tablolarında kalır.
public sealed class AccountingService(
    CourseIntellectDbContext dbContext,
    IStudentFinanceService studentFinanceService) : IAccountingService
{
    public async Task<AccountingDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        var invoices = await dbContext.AccountingInvoices.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var salaries = await dbContext.AccountingSalaries.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var approvals = await dbContext.AccountingApprovals.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var notifications = await dbContext.AccountingNotifications.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var auditLogs = await dbContext.AccountingAuditLogs.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);

        // Sınıf bilgisini öğrenci adından sözleşmeye bakarak (harf duyarsız) tamamla.
        var contractClassRows = await dbContext.EnrollmentContracts.AsNoTracking()
            .Select(x => new { x.StudentName, x.ClassName })
            .ToListAsync(cancellationToken);
        var classByStudent = contractClassRows
            .Where(x => !string.IsNullOrWhiteSpace(x.StudentName))
            .GroupBy(x => x.StudentName.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.Max(x => x.ClassName) ?? string.Empty);

        // Tahsilat listesi/dönem analizleri için tüm ödemeler döner (sabit 500 cap'i
        // kaldırıldı; aksi halde eski dönemler eksik/sıfır görünüyordu).
        var payments = await dbContext.FinancePayments.AsNoTracking()
            .OrderByDescending(x => x.PaidAtUtc)
            .ToListAsync(cancellationToken);

        // "Kim, hangi şubeden tahsil etti" — şube ve tahsil eden personel adlarını çöz.
        var collectionBranchIds = payments.Where(x => x.BranchId != null).Select(x => x.BranchId!.Value).Distinct().ToList();
        var collectorIds = payments.Where(x => x.CreatedByUserId != null).Select(x => x.CreatedByUserId!.Value).Distinct().ToList();
        var collectionBranchNames = await dbContext.OrgUnits.AsNoTracking()
            .Where(x => collectionBranchIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
        var collectorNames = await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(x => collectorIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.FullName, cancellationToken);

        var collections = payments.Select(payment => new AccountingCollectionDto(
            payment.Id.ToString(),
            payment.StudentName,
            classByStudent.GetValueOrDefault(payment.StudentName.Trim().ToLowerInvariant()) ?? string.Empty,
            FormatAmount(payment.Amount),
            payment.Method,
            payment.PaidAtUtc.ToLocalTime().ToString("dd.MM.yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR")),
            string.IsNullOrWhiteSpace(payment.ReceiptNo) ? payment.Note : $"{payment.ReceiptNo} • {payment.Note}".Trim(' ', '•'),
            payment.BranchId is Guid pb && collectionBranchNames.TryGetValue(pb, out var pbn) ? pbn : null,
            payment.CreatedByUserId is Guid pc && collectorNames.TryGetValue(pc, out var pcn) ? pcn : null,
            payment.Amount < 0 ? "Refund" : payment.EntryType,
            payment.OriginalPaymentId,
            payment.RefundReason,
            payment.RefundChannel,
            payment.ExternalReference)).ToList();

        var now = DateTime.UtcNow;
        var financeInstallments = await dbContext.FinanceInstallments.AsNoTracking()
            .OrderBy(x => x.DueDateUtc)
            .ToListAsync(cancellationToken);
        var installments = financeInstallments.Select(item => new AccountingInstallmentDto(
            item.Id.ToString(),
            item.StudentName,
            MapInstallmentStatus(item, now),
            FormatAmount(item.Amount),
            item.DueDateUtc.ToLocalTime().ToString("dd.MM.yyyy", CultureInfo.GetCultureInfo("tr-TR")),
            item.Amount - item.PaidAmount > 0 ? $"Kalan {FormatAmount(item.Amount - item.PaidAmount)}" : "Tamamlandı")).ToList();

        return new AccountingDashboardDto(invoices, salaries, approvals, collections, installments, notifications, auditLogs);
    }

    public async Task<AccountingInvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest request, CancellationToken cancellationToken = default)
    {
        var invoice = new AccountingInvoice
        {
            Title = request.Title.Trim(),
            Category = request.Category.Trim(),
            Subtitle = $"{request.Date.Trim()} • PDF",
            Amount = NormalizeAmount(request.Amount),
            Status = "Bekliyor"
        };
        await dbContext.AccountingInvoices.AddAsync(invoice, cancellationToken);
        var approval = new AccountingApproval
        {
            Title = request.Title.Trim(),
            Reason = request.Reason.Trim(),
            Category = request.Category.Trim(),
            Status = "Bekliyor",
            SourceType = "invoice",
            SourceKey = invoice.Id.ToString()
        };
        await dbContext.AccountingApprovals.AddAsync(approval, cancellationToken);
        await AddNotificationAsync("Yeni fatura oluşturuldu", $"{invoice.Title} kaydı onay akışına gönderildi.", cancellationToken);
        await AddAuditAsync("Fatura kaydı açıldı", $"{invoice.Title} için {invoice.Amount} tutarında yeni kayıt oluşturuldu.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(invoice);
    }

    public async Task<AccountingSalaryDto> CreateSalaryAsync(CreateSalaryRequest request, CancellationToken cancellationToken = default)
    {
        var salary = new AccountingSalary
        {
            Employee = request.Employee.Trim(),
            Role = request.Role.Trim(),
            Amount = NormalizeAmount(request.Amount),
            PayDate = request.PayDate.Trim(),
            Status = "Bekliyor"
        };
        await dbContext.AccountingSalaries.AddAsync(salary, cancellationToken);
        var approval = new AccountingApproval
        {
            Title = $"{salary.Employee} bordro talebi",
            Reason = request.Reason.Trim(),
            Category = "Maaş",
            Status = "Bekliyor",
            SourceType = "salary",
            SourceKey = salary.Id.ToString()
        };
        await dbContext.AccountingApprovals.AddAsync(approval, cancellationToken);
        await AddNotificationAsync("Yeni bordro kaydı", $"{salary.Employee} için bordro yönetici onayına gönderildi.", cancellationToken);
        await AddAuditAsync("Bordro oluşturuldu", $"{salary.Employee} için {salary.Amount} tutarlı bordro planı hazırlandı.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(salary);
    }

    // Manuel tahsilat artık normalize finans modeline yazılır ve öğrencinin
    // taksitlerine (FIFO) mahsup edilir.
    public async Task<AccountingCollectionDto> CreateCollectionAsync(CreateCollectionRequest request, Guid? createdByUserId = null, CancellationToken cancellationToken = default)
    {
        var amount = ParseAmount(request.Amount);
        var payment = await studentFinanceService.RecordPaymentAsync(
            new RecordPaymentRequest(
                request.StudentUserId,
                request.Name.Trim(),
                null,
                null,
                amount,
                string.IsNullOrWhiteSpace(request.Method) ? "Nakit" : request.Method.Trim(),
                request.Note?.Trim()),
            // Tahsil eden personel kaydedilsin ("kim tahsil etti"). Şube RecordPaymentAsync
            // içinde ApplyTenantContext ile aktörün şubesine damgalanır.
            createdByUserId,
            cancellationToken);

        await AddNotificationAsync("Tahsilat tamamlandı", $"{request.Name} için {FormatAmount(amount)} tutarında {request.Method} tahsilatı alındı.", cancellationToken);
        await AddAuditAsync("Tahsilat işlendi", $"{request.Name} için {request.Method} ile {FormatAmount(amount)} tutarında ödeme kaydedildi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Liste anında "kim, hangi şubeden" gösterebilsin diye dönen kayda da ekle
        // (istemci yeni satırı iyimser ekliyor; yenilemeyi beklemesin).
        var savedBranchId = await dbContext.FinancePayments.AsNoTracking()
            .Where(x => x.Id == payment.Id).Select(x => x.BranchId).FirstOrDefaultAsync(cancellationToken);
        var branchName = savedBranchId is Guid bid
            ? await dbContext.OrgUnits.AsNoTracking().Where(x => x.Id == bid).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken)
            : null;
        var collectedByName = createdByUserId is Guid uid
            ? await dbContext.Users.IgnoreQueryFilters().AsNoTracking().Where(x => x.Id == uid).Select(x => x.FullName).FirstOrDefaultAsync(cancellationToken)
            : null;

        return new AccountingCollectionDto(
            payment.Id.ToString(),
            request.Name.Trim(),
            request.ClassName?.Trim() ?? string.Empty,
            FormatAmount(amount),
            request.Method.Trim(),
            DateTime.Now.ToString("dd.MM.yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR")),
            payment.ReceiptNo,
            branchName,
            collectedByName);
    }

    // Manuel taksit (standalone) normalize taksit tablosuna yazılır.
    public async Task<AccountingInstallmentDto> CreateInstallmentAsync(CreateInstallmentRequest request, CancellationToken cancellationToken = default)
    {
        var amount = ParseAmount(request.Amount);
        var installment = new FinanceInstallment
        {
            EnrollmentContractId = Guid.Empty,
            StudentName = request.Student.Trim(),
            SeqNo = 1,
            Label = "Manuel Taksit",
            DueDateUtc = ParseDueDate(request.Due),
            Amount = amount,
            PaidAmount = 0,
            Status = "Pending",
            Currency = "TRY",
        };
        await dbContext.FinanceInstallments.AddAsync(installment, cancellationToken);
        await AddNotificationAsync("Yeni taksit planı", $"{installment.StudentName} için yeni taksit planı oluşturuldu.", cancellationToken);
        await AddAuditAsync("Taksit planı açıldı", $"{installment.StudentName} için {FormatAmount(amount)} tutarlı yeni taksit oluşturuldu.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AccountingInstallmentDto(installment.Id.ToString(), installment.StudentName, MapInstallmentStatus(installment, DateTime.UtcNow), FormatAmount(amount), request.Due.Trim(), request.Note?.Trim() ?? string.Empty);
    }

    public async Task<AccountingInstallmentDto?> UpdateInstallmentAsync(Guid id, UpdateInstallmentRequest request, CancellationToken cancellationToken = default)
    {
        var installment = await dbContext.FinanceInstallments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (installment is null) return null;

        installment.Amount = ParseAmount(request.Amount);
        installment.DueDateUtc = ParseDueDate(request.Due);
        if (string.Equals(request.Status.Trim(), "Ödendi", StringComparison.OrdinalIgnoreCase))
        {
            installment.PaidAmount = installment.Amount;
            installment.Status = "Paid";
        }

        await AddNotificationAsync("Taksit güncellendi", $"{installment.StudentName} için taksit planı güncellendi.", cancellationToken);
        await AddAuditAsync("Taksit güncellendi", $"{installment.StudentName} için taksit {FormatAmount(installment.Amount)} olarak güncellendi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AccountingInstallmentDto(installment.Id.ToString(), installment.StudentName, MapInstallmentStatus(installment, DateTime.UtcNow), FormatAmount(installment.Amount), request.Due.Trim(), request.Note?.Trim() ?? string.Empty);
    }

    public async Task<AccountingApprovalDto?> UpdateApprovalStatusAsync(Guid id, UpdateApprovalStatusRequest request, CancellationToken cancellationToken = default)
    {
        var approval = await dbContext.AccountingApprovals.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (approval is null) return null;
        approval.Status = request.Status.Trim();

        if (approval.SourceType == "invoice")
        {
            var invoice = Guid.TryParse(approval.SourceKey, out var invoiceId)
                ? await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken)
                : await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Title == approval.SourceKey, cancellationToken);
            if (invoice is not null)
            {
                invoice.Status = IsApprovedStatus(approval.Status) ? "Onaylandı" : "Reddedildi";
            }
        }

        if (approval.SourceType == "salary")
        {
            var salary = Guid.TryParse(approval.SourceKey, out var salaryId)
                ? await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Id == salaryId, cancellationToken)
                : await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Employee == approval.SourceKey, cancellationToken);
            if (salary is not null)
            {
                salary.Status = IsApprovedStatus(approval.Status) ? "Planlandı" : "Reddedildi";
            }
        }

        await AddNotificationAsync("Onay durumu güncellendi", $"{approval.Title} kaydı için durum: {approval.Status}", cancellationToken);
        await AddAuditAsync("Onay güncellendi", $"{approval.Title} kaydı {approval.Status} olarak işaretlendi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(approval);
    }

    public async Task<AccountingNotificationDto> CreateNotificationAsync(CreateAccountingNotificationRequest request, CancellationToken cancellationToken = default)
    {
        var notification = new AccountingNotification
        {
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            Time = "Bugün",
            Unread = true
        };
        await dbContext.AccountingNotifications.AddAsync(notification, cancellationToken);
        await AddAuditAsync("Finans bildirimi oluşturuldu", $"{notification.Title} bildirimi üretildi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(notification);
    }

    public async Task MarkAllNotificationsReadAsync(CancellationToken cancellationToken = default)
    {
        var notifications = await dbContext.AccountingNotifications.Where(x => x.Unread).ToListAsync(cancellationToken);
        foreach (var item in notifications)
        {
            item.Unread = false;
        }

        if (notifications.Count > 0)
        {
            await AddAuditAsync("Bildirimler okundu", $"{notifications.Count} muhasebe bildirimi okundu olarak işaretlendi.", cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task AddNotificationAsync(string title, string message, CancellationToken cancellationToken)
    {
        await dbContext.AccountingNotifications.AddAsync(new AccountingNotification
        {
            Title = title,
            Message = message,
            Time = "Bugün",
            Unread = true
        }, cancellationToken);
    }

    private async Task AddAuditAsync(string title, string detail, CancellationToken cancellationToken)
    {
        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = title,
            Detail = detail,
            Time = $"{DateTime.Now:dd MMMM yyyy} • {TimeLabel()}"
        }, cancellationToken);
    }

    private static string MapInstallmentStatus(FinanceInstallment installment, DateTime nowUtc)
    {
        var remaining = installment.Amount - installment.PaidAmount;
        if (remaining <= 0) return "Ödendi";
        if (installment.DueDateUtc < nowUtc) return "Gecikti";
        return installment.PaidAmount > 0 ? "Kısmi" : "Bekleyen";
    }

    private static DateTime ParseDueDate(string value)
    {
        if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("tr-TR"), DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
        {
            return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
        }

        return DateTime.UtcNow.Date.AddMonths(1);
    }

    private static decimal ParseAmount(string amount)
    {
        var cleaned = NormalizeMoneyNumber(amount);
        return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var value) ? value : 0;
    }

    private static string FormatAmount(decimal amount) => $"₺{amount.ToString("N2", CultureInfo.GetCultureInfo("tr-TR"))}";

    private static string NormalizeAmount(string amount)
    {
        var value = amount.Trim();
        return value.StartsWith("₺") ? value : $"₺{value}";
    }

    private static bool IsApprovedStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "approved" or "onaylandı" or "onaylandi";
    }

    private static string NormalizeMoneyNumber(string? amount)
    {
        var cleaned = new string((amount ?? string.Empty).Where(ch => char.IsDigit(ch) || ch == ',' || ch == '.' || ch == '-').ToArray());
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

    private static string TimeLabel()
    {
        var now = DateTime.Now;
        return $"{now.Hour:00}:{now.Minute:00}";
    }

    private static AccountingInvoiceDto ToDto(AccountingInvoice x) => new(x.Id.ToString(), x.Title, x.Category, x.Subtitle, x.Amount, x.Status);
    private static AccountingSalaryDto ToDto(AccountingSalary x) => new(x.Id.ToString(), x.Employee, x.Role, x.Amount, x.PayDate, x.Status);
    private static AccountingApprovalDto ToDto(AccountingApproval x) => new(x.Id.ToString(), x.Title, x.Reason, x.Category, x.Status, x.SourceType, x.SourceKey);
    private static AccountingNotificationDto ToDto(AccountingNotification x) => new(x.Id.ToString(), x.Title, x.Message, x.Time, x.Unread);
    private static AccountingAuditLogDto ToDto(AccountingAuditLog x) => new(x.Id.ToString(), x.Title, x.Detail, x.Time);
}
