using System.Globalization;
using System.Text;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Muhasebe dışa aktarımı: seçilen dönemdeki tüm para hareketleri tek yevmiye
/// biçiminde (tarih, belge no, tür, cari, açıklama, giriş, çıkış, para birimi,
/// yöntem, şube, işlem yapan). Ayraç ";" ve ondalık "," — Türkçe Excel doğrudan
/// açar. Belirli bir muhasebe programının (Logo/Mikro/Luca) içe aktarma şablonu
/// değildir; o programların alan eşlemesiyle içeri alınır.
/// </summary>
public sealed class FinanceJournalExportService(CourseIntellectDbContext dbContext) : IFinanceJournalExportService
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private sealed record Line(DateTime DateUtc, string DocumentNo, string Type, string Account, string Description,
        decimal In, decimal Out, string Currency, string Method, string Branch, string Actor);

    public async Task<byte[]> ExportCsvAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default)
    {
        var from = fromUtc ?? DateTime.MinValue;
        var to = toUtc ?? DateTime.MaxValue;
        var lines = new List<Line>();

        var branches = await dbContext.OrgUnits.AsNoTracking().ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var users = await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
            .Select(item => new { item.Id, item.FullName })
            .ToDictionaryAsync(item => item.Id, item => item.FullName, cancellationToken);
        string BranchName(Guid? id) => id is Guid value && branches.TryGetValue(value, out var name) ? name : string.Empty;
        string UserName(Guid? id) => id is Guid value && users.TryGetValue(value, out var name) ? name : string.Empty;

        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item => item.PaidAtUtc >= from && item.PaidAtUtc < to)
            .ToListAsync(cancellationToken);
        foreach (var payment in payments)
        {
            var isRefund = payment.Amount < 0;
            lines.Add(new Line(
                payment.PaidAtUtc,
                payment.ReceiptNo,
                isRefund ? "İade" : payment.Note.StartsWith(StudentFinanceService.DownPaymentNote, StringComparison.OrdinalIgnoreCase) ? "Peşinat Tahsilatı" : "Tahsilat",
                payment.StudentName,
                isRefund ? (string.IsNullOrWhiteSpace(payment.RefundReason) ? payment.Note : payment.RefundReason) : payment.Note,
                isRefund ? 0 : payment.Amount,
                isRefund ? -payment.Amount : 0,
                payment.Currency,
                isRefund ? payment.RefundChannel : payment.Method,
                BranchName(payment.BranchId),
                UserName(payment.CreatedByUserId)));
        }

        var expenses = await dbContext.DrivingExpenses.AsNoTracking()
            .Where(item => item.ExpenseDateUtc >= from && item.ExpenseDateUtc < to)
            .ToListAsync(cancellationToken);
        foreach (var expense in expenses.Where(item => FinanceExpenseRules.ExpenseCountsAsExpense(item.ApprovalStatus)))
        {
            lines.Add(new Line(expense.ExpenseDateUtc, expense.InvoiceNo, "Gider", expense.VendorName,
                $"{expense.Title} ({expense.Category})", 0, expense.Amount, expense.Currency, expense.PaymentMethod,
                BranchName(expense.BranchId), UserName(expense.CreatedByUserId)));
        }

        var salaries = await dbContext.AccountingSalaries.AsNoTracking().ToListAsync(cancellationToken);
        foreach (var salary in salaries.Where(item => FinanceExpenseRules.SalaryCountsAsExpense(item.Status)))
        {
            var date = FinanceExpenseRules.SalaryExpenseDate(salary.PaidAtUtc, salary.CreatedAtUtc);
            if (date < from || date >= to) continue;
            lines.Add(new Line(date, string.Empty, "Maaş Ödemesi", salary.Employee, $"{salary.Role} • {salary.PayDate}",
                0, MoneyParser.Parse(salary.Amount), "TRY", salary.PaymentMethod, string.Empty, string.Empty));
        }

        var invoices = await dbContext.AccountingInvoices.AsNoTracking().ToListAsync(cancellationToken);
        foreach (var invoice in invoices.Where(item => FinanceExpenseRules.InvoiceCountsAsExpense(item.Status)))
        {
            var date = FinanceExpenseRules.InvoiceExpenseDate(invoice.PaidAtUtc, invoice.IssueDateUtc);
            if (date < from || date >= to) continue;
            lines.Add(new Line(date, invoice.InvoiceNumber, "Fatura Ödemesi", invoice.Counterparty,
                $"{invoice.Title} ({invoice.Category})", 0, MoneyParser.Parse(invoice.Amount), "TRY", invoice.PaymentMethod,
                string.Empty, string.Empty));
        }

        var builder = new StringBuilder();
        builder.AppendLine("Tarih;Belge No;Tür;Cari/Hesap;Açıklama;Giriş;Çıkış;Para Birimi;Yöntem;Şube;İşlem Yapan");
        foreach (var line in lines.OrderBy(item => item.DateUtc).ThenBy(item => item.DocumentNo, StringComparer.Ordinal))
        {
            builder.AppendJoin(';',
                Cell(FinanceDates.TodayUtcDate(line.DateUtc).ToString("dd.MM.yyyy", CultureInfo.InvariantCulture)),
                Cell(line.DocumentNo),
                Cell(line.Type),
                Cell(line.Account),
                Cell(line.Description),
                Cell(line.In == 0 ? string.Empty : line.In.ToString("0.00", Tr)),
                Cell(line.Out == 0 ? string.Empty : line.Out.ToString("0.00", Tr)),
                Cell(line.Currency == "TRY" ? "TL" : line.Currency),
                Cell(line.Method),
                Cell(line.Branch),
                Cell(line.Actor));
            builder.AppendLine();
        }

        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(builder.ToString())).ToArray();
    }

    private static string Cell(string? value)
    {
        var text = (value ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ');
        // Formül enjeksiyonu: Excel'de = + - @ ile başlayan hücre formül sayılır.
        if (text.Length > 0 && "=+-@".Contains(text[0])) text = "'" + text;
        return text.Contains(';') || text.Contains('"') ? $"\"{text.Replace("\"", "\"\"")}\"" : text;
    }
}
