using CourseIntellect.Application.DTOs.Accounting;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AccountingService(CourseIntellectDbContext dbContext) : IAccountingService
{
    public async Task<AccountingDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        var invoices = await dbContext.AccountingInvoices.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var salaries = await dbContext.AccountingSalaries.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var approvals = await dbContext.AccountingApprovals.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var collections = await dbContext.AccountingCollections.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var installments = await dbContext.AccountingInstallments.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var notifications = await dbContext.AccountingNotifications.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
        var auditLogs = await dbContext.AccountingAuditLogs.OrderByDescending(x => x.Id).Select(x => ToDto(x)).ToListAsync(cancellationToken);
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
        var approval = new AccountingApproval
        {
            Title = request.Title.Trim(),
            Reason = request.Reason.Trim(),
            Category = request.Category.Trim(),
            Status = "Bekliyor",
            SourceType = "invoice",
            SourceKey = request.Title.Trim()
        };
        await dbContext.AccountingInvoices.AddAsync(invoice, cancellationToken);
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
        var approval = new AccountingApproval
        {
            Title = $"{salary.Employee} bordro talebi",
            Reason = request.Reason.Trim(),
            Category = "Maaş",
            Status = "Bekliyor",
            SourceType = "salary",
            SourceKey = salary.Employee
        };
        await dbContext.AccountingSalaries.AddAsync(salary, cancellationToken);
        await dbContext.AccountingApprovals.AddAsync(approval, cancellationToken);
        await AddNotificationAsync("Yeni bordro kaydı", $"{salary.Employee} için bordro yönetici onayına gönderildi.", cancellationToken);
        await AddAuditAsync("Bordro oluşturuldu", $"{salary.Employee} için {salary.Amount} tutarlı bordro planı hazırlandı.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(salary);
    }

    public async Task<AccountingCollectionDto> CreateCollectionAsync(CreateCollectionRequest request, CancellationToken cancellationToken = default)
    {
        var collection = new AccountingCollection
        {
            Name = request.Name.Trim(),
            ClassName = request.ClassName.Trim(),
            Amount = NormalizeAmount(request.Amount),
            Method = request.Method.Trim(),
            Time = TimeLabel(),
            Note = request.Note.Trim()
        };
        await dbContext.AccountingCollections.AddAsync(collection, cancellationToken);
        await AddNotificationAsync("Tahsilat tamamlandı", $"{collection.Name} için {collection.Amount} tutarında {collection.Method} tahsilatı alındı.", cancellationToken);
        await AddAuditAsync("Tahsilat işlendi", $"{collection.Name} için {collection.Method} ile {collection.Amount} tutarında ödeme kaydedildi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(collection);
    }

    public async Task<AccountingInstallmentDto> CreateInstallmentAsync(CreateInstallmentRequest request, CancellationToken cancellationToken = default)
    {
        var installment = new AccountingInstallment
        {
            Student = request.Student.Trim(),
            Status = "Bekleyen",
            Amount = NormalizeAmount(request.Amount),
            Due = request.Due.Trim(),
            Note = request.Note.Trim()
        };
        await dbContext.AccountingInstallments.AddAsync(installment, cancellationToken);
        await AddNotificationAsync("Yeni taksit planı", $"{installment.Student} için yeni taksit planı oluşturuldu.", cancellationToken);
        await AddAuditAsync("Taksit planı açıldı", $"{installment.Student} için {installment.Amount} tutarlı yeni taksit oluşturuldu.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(installment);
    }

    public async Task<AccountingInstallmentDto?> UpdateInstallmentAsync(Guid id, UpdateInstallmentRequest request, CancellationToken cancellationToken = default)
    {
        var installment = await dbContext.AccountingInstallments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (installment is null) return null;

        installment.Amount = NormalizeAmount(request.Amount);
        installment.Due = request.Due.Trim();
        installment.Status = request.Status.Trim();
        installment.Note = request.Note.Trim();

        await AddNotificationAsync("Taksit güncellendi", $"{installment.Student} için taksit planı güncellendi.", cancellationToken);
        await AddAuditAsync("Taksit güncellendi", $"{installment.Student} için taksit {installment.Amount} / {installment.Status} olarak güncellendi.", cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(installment);
    }

    public async Task<AccountingApprovalDto?> UpdateApprovalStatusAsync(Guid id, UpdateApprovalStatusRequest request, CancellationToken cancellationToken = default)
    {
        var approval = await dbContext.AccountingApprovals.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (approval is null) return null;
        approval.Status = request.Status.Trim();

        if (approval.SourceType == "invoice")
        {
            var invoice = await dbContext.AccountingInvoices.FirstOrDefaultAsync(x => x.Title == approval.SourceKey, cancellationToken);
            if (invoice is not null)
            {
                invoice.Status = approval.Status == "Onaylandı" ? "Onaylandı" : "Reddedildi";
            }
        }

        if (approval.SourceType == "salary")
        {
            var salary = await dbContext.AccountingSalaries.FirstOrDefaultAsync(x => x.Employee == approval.SourceKey, cancellationToken);
            if (salary is not null)
            {
                salary.Status = approval.Status == "Onaylandı" ? "Planlandı" : "Reddedildi";
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
            Time = $"12 Mart 2026 • {TimeLabel()}"
        }, cancellationToken);
    }

    private static string NormalizeAmount(string amount)
    {
        var value = amount.Trim();
        return value.StartsWith("₺") ? value : $"₺{value}";
    }

    private static string TimeLabel()
    {
        var now = DateTime.Now;
        return $"{now.Hour:00}:{now.Minute:00}";
    }

    private static AccountingInvoiceDto ToDto(AccountingInvoice x) => new(x.Id.ToString(), x.Title, x.Category, x.Subtitle, x.Amount, x.Status);
    private static AccountingSalaryDto ToDto(AccountingSalary x) => new(x.Id.ToString(), x.Employee, x.Role, x.Amount, x.PayDate, x.Status);
    private static AccountingApprovalDto ToDto(AccountingApproval x) => new(x.Id.ToString(), x.Title, x.Reason, x.Category, x.Status, x.SourceType, x.SourceKey);
    private static AccountingCollectionDto ToDto(AccountingCollection x) => new(x.Id.ToString(), x.Name, x.ClassName, x.Amount, x.Method, x.Time, x.Note);
    private static AccountingInstallmentDto ToDto(AccountingInstallment x) => new(x.Id.ToString(), x.Student, x.Status, x.Amount, x.Due, x.Note);
    private static AccountingNotificationDto ToDto(AccountingNotification x) => new(x.Id.ToString(), x.Title, x.Message, x.Time, x.Unread);
    private static AccountingAuditLogDto ToDto(AccountingAuditLog x) => new(x.Id.ToString(), x.Title, x.Detail, x.Time);
}
