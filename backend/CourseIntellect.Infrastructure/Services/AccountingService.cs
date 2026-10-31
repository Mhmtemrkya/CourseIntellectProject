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
        // Kimlik (Guid) sırası rastgeledir; kayıt geçmişi gerçek zamana göre sıralanır.
        var auditLogs = await dbContext.AccountingAuditLogs.OrderByDescending(x => x.CreatedAtUtc).Take(1000).Select(x => ToDto(x)).ToListAsync(cancellationToken);

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
        var pausedContracts = (await dbContext.EnrollmentContracts.AsNoTracking()
            .Where(x => x.Status != "Active")
            .Select(x => new { x.Id, x.Status })
            .ToListAsync(cancellationToken)).ToDictionary(x => x.Id, x => x.Status);
        var installments = financeInstallments.Select(item => new AccountingInstallmentDto(
            item.Id.ToString(),
            item.StudentName,
            // Dondurulmuş kaydın taksiti "Gecikti" değil "Donduruldu" görünür.
            pausedContracts.TryGetValue(item.EnrollmentContractId, out var pausedStatus) && item.Amount > item.PaidAmount
                ? (pausedStatus == "Frozen" ? "Donduruldu" : "İptal")
                : MapInstallmentStatus(item, now),
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
        if (invoice.PaidAtUtc is DateTime createdPaidAt)
        {
            await FinanceDayGuard.EnsureOpenAsync(dbContext, createdPaidAt, cancellationToken);
        }
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
        // Geçersiz/eksi tutar 0'a ayrışır; 0 TL'lik makbuzlu tahsilat yazılmasın.
        if (amount <= 0) throw new ArgumentException("Tahsilat tutarı sıfırdan büyük olmalı.");
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

    // Elle taksit kendi sözleşmesiyle açılır (bkz. StudentFinanceService.CreateManualInstallmentAsync).
    public async Task<AccountingInstallmentDto> CreateInstallmentAsync(CreateInstallmentRequest request, CancellationToken cancellationToken = default)
    {
        var amount = ParseAmount(request.Amount);
        var installment = await studentFinanceService.CreateManualInstallmentAsync(
            request.Student, amount, ParseDueDate(request.Due), request.Note, cancellationToken);
        var studentName = request.Student.Trim();
        await AddNotificationAsync("Yeni taksit planı", $"{studentName} için yeni taksit planı oluşturuldu.", cancellationToken);
        await AddAuditAsync("Taksit planı açıldı", $"{studentName} için {FormatAmount(amount)} tutarlı yeni taksit oluşturuldu.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AccountingInstallmentDto(installment.Id.ToString(), studentName, MapInstallmentStatus(installment.Amount, installment.PaidAmount, installment.DueDateUtc, DateTime.UtcNow), FormatAmount(amount), request.Due.Trim(), request.Note?.Trim() ?? string.Empty);
    }

    public async Task<AccountingInstallmentDto?> UpdateInstallmentAsync(Guid id, UpdateInstallmentRequest request, Guid? actorUserId = null, CancellationToken cancellationToken = default)
    {
        var installment = await studentFinanceService.UpdateInstallmentAsync(
            id,
            ParseAmount(request.Amount),
            ParseDueDate(request.Due),
            request.Status,
            request.Method,
            actorUserId,
            cancellationToken);
        if (installment is null) return null;

        var studentName = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(x => x.Id == id).Select(x => x.StudentName).FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
        await AddNotificationAsync("Taksit güncellendi", $"{studentName} için taksit planı güncellendi.", cancellationToken);
        await AddAuditAsync("Taksit güncellendi", $"{studentName} için taksit {FormatAmount(installment.Amount)} olarak güncellendi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AccountingInstallmentDto(id.ToString(), studentName, MapInstallmentStatus(installment.Amount, installment.PaidAmount, installment.DueDateUtc, DateTime.UtcNow), FormatAmount(installment.Amount), request.Due.Trim(), request.Note?.Trim() ?? string.Empty);
    }

    public async Task<AccountingInvoiceDto?> UpdateInvoiceAsync(Guid id, UpdateInvoiceRequest request, CancellationToken cancellationToken = default)
    {
        var invoice = await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null) return null;
        if (IsCancelled(invoice.Status)) throw new InvalidOperationException("İptal edilmiş fatura düzenlenemez.");
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ArgumentException("Fatura başlığı zorunludur.");
        if (string.IsNullOrWhiteSpace(request.Category)) throw new ArgumentException("Fatura kategorisi zorunludur.");
        var amount = ParseAmount(request.Amount);
        if (amount <= 0) throw new ArgumentException("Fatura tutarı sıfırdan büyük olmalıdır.");
        var issueDate = DateTime.TryParse(request.Date, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
            ? parsed.ToUniversalTime()
            : invoice.IssueDateUtc;
        if (request.DueDateUtc.HasValue && request.DueDateUtc.Value.Date < issueDate.Date)
            throw new ArgumentException("Son ödeme tarihi fatura tarihinden önce olamaz.");

        var isPaid = IsPaidStatus(invoice.Status);
        if (isPaid && (MoneyParser.Parse(invoice.Amount) != amount))
        {
            // Ödenmiş faturanın tutarı kasadan çıkmış parayı gösterir; değişmesi
            // geçmiş kasa/mutabakatı bozar. Düzeltme: iptal + yeni fatura.
            throw new InvalidOperationException("Ödenmiş faturanın tutarı değiştirilemez; faturayı iptal edip doğrusunu girin.");
        }
        if (isPaid && invoice.PaidAtUtc is DateTime paidAt)
        {
            await FinanceDayGuard.EnsureOpenAsync(dbContext, paidAt, cancellationToken);
        }

        var before = $"{invoice.Title} • {invoice.Amount}";
        invoice.Title = request.Title.Trim();
        invoice.Category = request.Category.Trim();
        invoice.Counterparty = request.Counterparty?.Trim() ?? invoice.Counterparty;
        invoice.Amount = MoneyParser.Format(amount);
        invoice.IssueDateUtc = issueDate;
        invoice.DueDateUtc = request.DueDateUtc?.ToUniversalTime();
        invoice.Subtitle = invoice.DueDateUtc.HasValue
            ? $"{issueDate.ToLocalTime():dd.MM.yyyy} • Vade {invoice.DueDateUtc.Value.ToLocalTime():dd.MM.yyyy}"
            : $"{issueDate.ToLocalTime():dd.MM.yyyy}";
        if (request.Note is not null) invoice.Note = request.Note.Trim();
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        await AddAuditAsync("Fatura düzenlendi", $"{invoice.InvoiceNumber}: {before} → {invoice.Title} • {invoice.Amount}.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(invoice);
    }

    /// <summary>İptal edilen fatura silinmez: gider toplamından çıkar, izi ve gerekçesi kalır.</summary>
    public async Task<AccountingInvoiceDto?> CancelInvoiceAsync(Guid id, string reason, CancellationToken cancellationToken = default)
    {
        var invoice = await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null) return null;
        if (IsCancelled(invoice.Status)) throw new InvalidOperationException("Fatura zaten iptal edilmiş.");
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("İptal gerekçesi zorunludur.");
        if (invoice.PaidAtUtc is DateTime paidAt && IsPaidStatus(invoice.Status))
        {
            // Ödenmiş faturanın iptali o günün kasasını değiştirir.
            await FinanceDayGuard.EnsureOpenAsync(dbContext, paidAt, cancellationToken);
        }

        invoice.Status = FinanceExpenseRules.Cancelled;
        invoice.CancelledAtUtc = DateTime.UtcNow;
        invoice.CancelReason = reason.Trim().Length > 300 ? reason.Trim()[..300] : reason.Trim();
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        await AddAuditAsync("Fatura iptal edildi", $"{invoice.InvoiceNumber} • {invoice.Title} • {invoice.Amount}. Gerekçe: {invoice.CancelReason}", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(invoice);
    }

    /// <summary>Yalnız ödenmemiş fatura silinir; ödenmiş fatura iptal edilir.</summary>
    public async Task<bool> DeleteInvoiceAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var invoice = await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null) return false;
        if (IsPaidStatus(invoice.Status) || invoice.PaidAtUtc.HasValue)
        {
            throw new InvalidOperationException("Ödenmiş fatura silinemez; iptal edin.");
        }
        dbContext.AccountingInvoices.Remove(invoice);
        var key = invoice.Id.ToString();
        var approvals = await dbContext.AccountingApprovals
            .Where(x => x.SourceType == "invoice" && x.SourceKey == key)
            .ToListAsync(cancellationToken);
        dbContext.AccountingApprovals.RemoveRange(approvals);
        await AddAuditAsync("Fatura silindi", $"{invoice.InvoiceNumber} • {invoice.Title} • {invoice.Amount}.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>
    /// Onaylı (Planlandı) bordronun ödendiğini kaydeder. Gider ve kasa bu ödeme
    /// tarihine yazılır; nakit ödenen maaş o günün kasasından düşer.
    /// </summary>
    public async Task<AccountingSalaryDto?> PaySalaryAsync(Guid id, PaySalaryRequest request, CancellationToken cancellationToken = default)
    {
        var salary = await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (salary is null) return null;
        if (IsPaidStatus(salary.Status)) throw new InvalidOperationException("Bu bordro zaten ödendi olarak kayıtlı.");
        if (!string.Equals(salary.Status?.Trim(), "Planlandı", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Yalnız yönetici onaylı (Planlandı) bordro ödenebilir.");
        }
        if (string.IsNullOrWhiteSpace(request.PaymentMethod)) throw new ArgumentException("Ödeme yöntemi zorunludur.");
        var paidAt = (request.PaidAtUtc ?? DateTime.UtcNow).ToUniversalTime();
        if (paidAt > DateTime.UtcNow.AddMinutes(5)) throw new ArgumentException("İleri tarihli ödeme kaydedilemez.");
        await FinanceDayGuard.EnsureOpenAsync(dbContext, paidAt, cancellationToken);

        salary.Status = FinanceExpenseRules.Paid;
        salary.PaidAtUtc = paidAt;
        salary.PaymentMethod = request.PaymentMethod.Trim();
        await AddAuditAsync("Maaş ödendi", $"{salary.Employee} • {salary.Amount} • {salary.PaymentMethod} ({paidAt.ToLocalTime():dd.MM.yyyy}).", cancellationToken);
        await AddNotificationAsync("Maaş ödemesi kaydedildi", $"{salary.Employee} için {salary.Amount} ödeme kaydedildi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(salary);
    }

    private static bool IsCancelled(string? status) =>
        string.Equals(status?.Trim(), FinanceExpenseRules.Cancelled, StringComparison.OrdinalIgnoreCase);

    public async Task<AccountingApprovalDto?> UpdateApprovalStatusAsync(Guid id, UpdateApprovalStatusRequest request, CancellationToken cancellationToken = default)
    {
        var approval = await dbContext.AccountingApprovals.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (approval is null) return null;
        approval.Status = request.Status.Trim();
        approval.UpdatedAtUtc = DateTime.UtcNow;

        // Onay kararı üç değerlidir: onay, ret, beklemeye geri alma. Eskiden onay
        // dışındaki her değer (beklemeye almak dahil) kaydı "Reddedildi" yapıyordu.
        // Ödenmiş fatura/bordronun ödeme durumu onay kararıyla ezilmez.
        var decision = ClassifyApproval(approval.Status);
        if (approval.SourceType == "invoice")
        {
            var invoice = Guid.TryParse(approval.SourceKey, out var invoiceId)
                ? await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken)
                : await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Title == approval.SourceKey, cancellationToken);
            if (invoice is not null && !IsPaidStatus(invoice.Status) && !IsCancelled(invoice.Status))
            {
                invoice.Status = decision switch
                {
                    ApprovalDecision.Approved => "Onaylandı",
                    ApprovalDecision.Rejected => "Reddedildi",
                    _ => "Ödenmedi",
                };
            }
        }

        if (approval.SourceType == "salary")
        {
            var salary = Guid.TryParse(approval.SourceKey, out var salaryId)
                ? await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Id == salaryId, cancellationToken)
                : await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Employee == approval.SourceKey, cancellationToken);
            if (salary is not null && !IsPaidStatus(salary.Status))
            {
                salary.Status = decision switch
                {
                    ApprovalDecision.Approved => "Planlandı",
                    ApprovalDecision.Rejected => "Reddedildi",
                    _ => "Bekliyor",
                };
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
        => MapInstallmentStatus(installment.Amount, installment.PaidAmount, installment.DueDateUtc, nowUtc);

    private static string MapInstallmentStatus(decimal amount, decimal paidAmount, DateTime dueDateUtc, DateTime nowUtc)
    {
        var remaining = amount - paidAmount;
        if (remaining <= 0) return "Ödendi";
        if (FinanceDates.IsOverdue(dueDateUtc, nowUtc)) return "Gecikti";
        return paidAmount > 0 ? "Kısmi" : "Bekleyen";
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

    private enum ApprovalDecision { Pending, Approved, Rejected }

    private static ApprovalDecision ClassifyApproval(string? status)
    {
        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "approved" or "onaylandı" or "onaylandi" => ApprovalDecision.Approved,
            "rejected" or "reddedildi" => ApprovalDecision.Rejected,
            _ => ApprovalDecision.Pending,
        };
    }

    private static bool IsPaidStatus(string? status) =>
        string.Equals(status?.Trim(), "Ödendi", StringComparison.OrdinalIgnoreCase);

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
        x.Note,
        x.CancelledAtUtc,
        x.CancelReason);
    private static AccountingSalaryDto ToDto(AccountingSalary x) => new(x.Id.ToString(), x.Employee, x.Role, x.Amount, x.PayDate, x.Status, x.PaidAtUtc, x.PaymentMethod);
    private static AccountingApprovalDto ToDto(AccountingApproval x) => new(x.Id.ToString(), x.Title, x.Reason, x.Category, x.Status, x.SourceType, x.SourceKey, x.UpdatedAtUtc);
    private static AccountingNotificationDto ToDto(AccountingNotification x) => new(x.Id.ToString(), x.Title, x.Message, x.Time, x.Unread);
    // Alan eklenmeden önceki kayıtların gerçek zamanı bilinmez (0001); onlarda yalnız Time metni gösterilir.
    private static AccountingAuditLogDto ToDto(AccountingAuditLog x) => new(x.Id.ToString(), x.Title, x.Detail, x.Time, x.CreatedAtUtc.Year < 2000 ? null : x.CreatedAtUtc, x.ActorName);
}
