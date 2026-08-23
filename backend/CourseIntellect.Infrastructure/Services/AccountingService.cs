using System.Globalization;
using CourseIntellect.Domain.Services;
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
    public async Task<AccountingDashboardDto> GetDashboardAsync(
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        var invoiceQuery = dbContext.AccountingInvoices.AsNoTracking().AsQueryable();
        var salaryQuery = dbContext.AccountingSalaries.AsNoTracking().AsQueryable();
        var approvalQuery = dbContext.AccountingApprovals.AsNoTracking().AsQueryable();
        if (fromUtc.HasValue)
        {
            invoiceQuery = invoiceQuery.Where(x => x.IssueDateUtc >= fromUtc.Value);
            salaryQuery = salaryQuery.Where(x => x.CreatedAtUtc >= fromUtc.Value);
            approvalQuery = approvalQuery.Where(x => x.UpdatedAtUtc >= fromUtc.Value);
        }
        if (toUtc.HasValue)
        {
            invoiceQuery = invoiceQuery.Where(x => x.IssueDateUtc < toUtc.Value);
            salaryQuery = salaryQuery.Where(x => x.CreatedAtUtc < toUtc.Value);
            approvalQuery = approvalQuery.Where(x => x.UpdatedAtUtc < toUtc.Value);
        }
        var invoices = await invoiceQuery.OrderByDescending(x => x.IssueDateUtc).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var salaries = await salaryQuery.OrderByDescending(x => x.CreatedAtUtc).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var approvals = await approvalQuery.OrderByDescending(x => x.UpdatedAtUtc).Select(x => ToDto(x)).ToListAsync(cancellationToken);
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
        var paymentQuery = dbContext.FinancePayments.AsNoTracking().AsQueryable();
        if (fromUtc.HasValue) paymentQuery = paymentQuery.Where(x => x.PaidAtUtc >= fromUtc.Value);
        if (toUtc.HasValue) paymentQuery = paymentQuery.Where(x => x.PaidAtUtc < toUtc.Value);
        var payments = await paymentQuery.OrderByDescending(x => x.PaidAtUtc).ToListAsync(cancellationToken);

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
        var installmentQuery = dbContext.FinanceInstallments.AsNoTracking().AsQueryable();
        if (fromUtc.HasValue) installmentQuery = installmentQuery.Where(x => x.DueDateUtc >= fromUtc.Value);
        if (toUtc.HasValue) installmentQuery = installmentQuery.Where(x => x.DueDateUtc < toUtc.Value);
        var financeInstallments = await installmentQuery.OrderBy(x => x.DueDateUtc).ToListAsync(cancellationToken);
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
        var issueDate = DateTime.TryParse(
            request.Date,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal,
            out var parsedIssueDate)
            ? parsedIssueDate.ToUniversalTime()
            : DateTime.UtcNow;
        var invoice = new AccountingInvoice
        {
            Title = request.Title.Trim(),
            Counterparty = request.Counterparty?.Trim() ?? string.Empty,
            Category = request.Category.Trim(),
            Subtitle = request.DueDateUtc.HasValue
                ? $"{issueDate.ToLocalTime():dd.MM.yyyy} • Vade {request.DueDateUtc.Value.ToLocalTime():dd.MM.yyyy}"
                : $"{issueDate.ToLocalTime():dd.MM.yyyy}",
            Amount = NormalizeAmount(request.Amount),
            Status = request.IsPaid ? "Ödendi" : "Ödenmedi",
            IssueDateUtc = issueDate,
            DueDateUtc = request.DueDateUtc?.ToUniversalTime(),
            PaidAtUtc = request.IsPaid ? DateTime.UtcNow : null,
            PaymentMethod = request.IsPaid ? request.PaymentMethod?.Trim() ?? string.Empty : string.Empty,
            Note = request.Reason.Trim(),
        };
        invoice.InvoiceNumber = string.IsNullOrWhiteSpace(request.InvoiceNumber)
            ? $"FTR-{issueDate:yyyyMMdd}-{invoice.Id.ToString("N")[..8].ToUpperInvariant()}"
            : request.InvoiceNumber.Trim().ToUpperInvariant();
        await dbContext.AccountingInvoices.AddAsync(invoice, cancellationToken);
        await AddNotificationAsync(
            "Yeni fatura oluşturuldu",
            $"{invoice.InvoiceNumber} numaralı fatura {invoice.Status.ToLowerInvariant()} durumunda kaydedildi.",
            cancellationToken);
        await AddAuditAsync(
            "Fatura kaydı açıldı",
            $"{invoice.InvoiceNumber} • {invoice.Title} • {invoice.Amount} • {invoice.Status}.",
            cancellationToken);
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
            SourceKey = salary.Id.ToString(),
            UpdatedAtUtc = DateTime.UtcNow,
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
        // Ödeme yöntemi boş/null gelebilir; tek yerde varsayılana ("Nakit") indirger ve
        // hem kayıtta hem bildirim/audit/DTO'da aynı değeri kullanırız (aksi halde DTO'daki
        // request.Method.Trim() null gelince tahsilat kaydedildikten sonra 500 veriyordu).
        var method = string.IsNullOrWhiteSpace(request.Method) ? "Nakit" : request.Method.Trim();
        var payment = await studentFinanceService.RecordPaymentAsync(
            new RecordPaymentRequest(
                request.StudentUserId,
                request.Name.Trim(),
                null,
                null,
                amount,
                method,
                request.Note?.Trim()),
            // Tahsil eden personel kaydedilsin ("kim tahsil etti"). Şube RecordPaymentAsync
            // içinde ApplyTenantContext ile aktörün şubesine damgalanır.
            createdByUserId,
            cancellationToken);

        await AddNotificationAsync("Tahsilat tamamlandı", $"{request.Name} için {FormatAmount(amount)} tutarında {method} tahsilatı alındı.", cancellationToken);
        await AddAuditAsync("Tahsilat işlendi", $"{request.Name} için {method} ile {FormatAmount(amount)} tutarında ödeme kaydedildi.", cancellationToken);
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
            method,
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

        var requestedStatus = request.Status.Trim();
        if (string.Equals(requestedStatus, "Ödendi", StringComparison.OrdinalIgnoreCase))
        {
            installment.PaidAmount = installment.Amount;
            installment.Status = "Paid";
        }
        else if (string.Equals(requestedStatus, "Bekliyor", StringComparison.OrdinalIgnoreCase)
            || string.Equals(requestedStatus, "Pending", StringComparison.OrdinalIgnoreCase))
        {
            // Geri alma yolu eskiden HİÇ işlenmiyordu: "Ödendi"den "Bekliyor"a
            // çevrilen taksit PaidAmount ve Status="Paid" ile kalıyor, borç
            // kapalı görünmeye devam ediyordu.
            //
            // Yalnız ELLE işaretlenmiş kısım geri alınır: gerçek tahsilatların
            // mahsubu (FinancePaymentAllocation) korunur. Aksi hâlde bir durum
            // düzeltmesi, gerçekten alınmış parayı kayıtlardan silerdi.
            var allocatedPaid = await dbContext.FinancePaymentAllocations
                .Where(x => x.FinanceInstallmentId == installment.Id)
                .SumAsync(x => (decimal?)(x.Amount - x.RefundedAmount), cancellationToken) ?? 0m;

            installment.PaidAmount = Math.Clamp(allocatedPaid, 0, installment.Amount);
            installment.Status = installment.PaidAmount <= 0
                ? "Pending"
                : installment.PaidAmount >= installment.Amount ? "Paid" : "Partial";
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
        approval.UpdatedAtUtc = DateTime.UtcNow;

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

    // Para ayrıştırma/biçimleme tek kaynaktan (Domain/MoneyParser) gelir.
    private static decimal ParseAmount(string amount) => MoneyParser.Parse(amount);
    private static string FormatAmount(decimal amount) => MoneyParser.Format(amount);

    /// <summary>
    /// Kullanıcının serbest yazdığı tutarı ("5000", "₺5.000,00") ortak gösterim
    /// biçimine getirir ("5.000 TL"). Eskiden yalnız başına "₺" ekliyordu; aynı
    /// kayıt listede farklı, kartta farklı görünüyordu.
    /// </summary>
    private static string NormalizeAmount(string amount)
        => MoneyParser.Format(MoneyParser.Parse(amount));

    private static bool IsApprovedStatus(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "approved" or "onaylandı" or "onaylandi";
    }

    private static string TimeLabel()
    {
        var now = DateTime.Now;
        return $"{now.Hour:00}:{now.Minute:00}";
    }

    private static AccountingInvoiceDto ToDto(AccountingInvoice x) => new(
        x.Id.ToString(),
        string.IsNullOrWhiteSpace(x.InvoiceNumber) ? x.Id.ToString() : x.InvoiceNumber,
        x.Title,
        x.Counterparty,
        x.Category,
        x.Subtitle,
        x.Amount,
        x.Status,
        x.IssueDateUtc,
        x.DueDateUtc,
        x.PaidAtUtc,
        x.PaymentMethod,
        x.Note);
    private static AccountingSalaryDto ToDto(AccountingSalary x) => new(x.Id.ToString(), x.Employee, x.Role, x.Amount, x.PayDate, x.Status);
    private static AccountingApprovalDto ToDto(AccountingApproval x) => new(x.Id.ToString(), x.Title, x.Reason, x.Category, x.Status, x.SourceType, x.SourceKey, x.UpdatedAtUtc);
    private static AccountingNotificationDto ToDto(AccountingNotification x) => new(x.Id.ToString(), x.Title, x.Message, x.Time, x.Unread);
    private static AccountingAuditLogDto ToDto(AccountingAuditLog x) => new(x.Id.ToString(), x.Title, x.Detail, x.Time);
}
