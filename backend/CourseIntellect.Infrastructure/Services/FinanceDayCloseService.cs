using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Kapanmış güne para hareketi yazılmasını engeller. Her para yazan yol (tahsilat,
/// iade, tahsilat düzeltme/silme, fatura/maaş ödemesi, gider) hareketin gününü
/// buradan geçirir. Sunucuda zorunludur; ekrandaki kilit tek başına yeterli değildir.
/// </summary>
public static class FinanceDayGuard
{
    public static async Task EnsureOpenAsync(CourseIntellectDbContext dbContext, DateTime atUtc, CancellationToken cancellationToken)
    {
        var day = FinanceDates.TodayUtcDate(DateTime.SpecifyKind(atUtc, DateTimeKind.Utc));
        if (await dbContext.FinanceDayClosings.AsNoTracking().AnyAsync(item => item.Day == day, cancellationToken))
        {
            throw new InvalidOperationException(
                $"{day:dd.MM.yyyy} günü kasa kapanışı yapıldı; bu güne kayıt eklenemez veya değiştirilemez. Düzeltme için yöneticinin günü yeniden açması gerekir.");
        }
    }
}

public sealed class FinanceDayCloseService(CourseIntellectDbContext dbContext) : IFinanceDayCloseService
{
    public async Task<FinanceDaySummaryDto> GetSummaryAsync(DateTime day, CancellationToken cancellationToken = default)
    {
        var dayKey = DayKey(day);
        var closing = await dbContext.FinanceDayClosings.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Day == dayKey, cancellationToken);
        var totals = await ComputeAsync(dayKey, cancellationToken);
        return new FinanceDaySummaryDto(
            dayKey,
            closing is not null,
            totals.CashIn,
            totals.CashOut,
            totals.CashIn - totals.CashOut,
            totals.CardIn,
            totals.TransferIn,
            totals.CollectionCount,
            closing is null ? null : ToDto(closing));
    }

    public async Task<FinanceDayClosingDto> CloseAsync(
        CloseFinanceDayRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var dayKey = DayKey(request.Day);
        if (dayKey > FinanceDates.TodayUtcDate(DateTime.UtcNow))
        {
            throw new ArgumentException("Henüz gelmemiş bir gün kapatılamaz.");
        }
        if (request.CountedCash < 0)
        {
            throw new ArgumentException("Sayılan nakit tutarı eksi olamaz.");
        }
        if (await dbContext.FinanceDayClosings.AnyAsync(item => item.Day == dayKey, cancellationToken))
        {
            throw new InvalidOperationException($"{dayKey:dd.MM.yyyy} günü zaten kapatılmış.");
        }

        var totals = await ComputeAsync(dayKey, cancellationToken);
        var expected = totals.CashIn - totals.CashOut;
        var closing = new FinanceDayClosing
        {
            Day = dayKey,
            CashIn = totals.CashIn,
            CashOut = totals.CashOut,
            ExpectedCash = expected,
            CountedCash = request.CountedCash,
            Difference = request.CountedCash - expected,
            CardIn = totals.CardIn,
            TransferIn = totals.TransferIn,
            CollectionCount = totals.CollectionCount,
            Note = (request.Note ?? string.Empty).Trim() is { Length: > 500 } longNote ? longNote[..500] : (request.Note ?? string.Empty).Trim(),
            ClosedByUserId = actorUserId,
            ClosedByName = actorName.Length > 150 ? actorName[..150] : actorName,
            ClosedAtUtc = DateTime.UtcNow,
        };
        await dbContext.FinanceDayClosings.AddAsync(closing, cancellationToken);
        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = "Gün sonu kasa kapanışı",
            Detail = $"{dayKey:dd.MM.yyyy}: beklenen nakit {MoneyText.Format(expected)}, sayılan {MoneyText.Format(request.CountedCash)}, fark {MoneyText.Format(closing.Difference)}.",
            Time = $"{DateTime.Now:dd MMMM yyyy} • {DateTime.Now:HH:mm}",
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(closing);
    }

    public async Task<bool> ReopenAsync(DateTime day, string reason, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Günü yeniden açma gerekçesi zorunludur.");
        var dayKey = DayKey(day);
        var closing = await dbContext.FinanceDayClosings.FirstOrDefaultAsync(item => item.Day == dayKey, cancellationToken);
        if (closing is null) return false;
        dbContext.FinanceDayClosings.Remove(closing);
        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = "Kapanmış gün yeniden açıldı",
            Detail = $"{dayKey:dd.MM.yyyy} kasa kapanışı geri alındı. Gerekçe: {reason.Trim()}",
            Time = $"{DateTime.Now:dd MMMM yyyy} • {DateTime.Now:HH:mm}",
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<FinanceDayClosingDto>> ListAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default)
    {
        var query = dbContext.FinanceDayClosings.AsNoTracking().AsQueryable();
        if (fromUtc.HasValue) query = query.Where(item => item.Day >= DayKey(fromUtc.Value));
        if (toUtc.HasValue) query = query.Where(item => item.Day <= DayKey(toUtc.Value));
        var rows = await query.OrderByDescending(item => item.Day).Take(400).ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    /// <summary>İstemciden gelen gün (yerel tarih) → 00:00 UTC anahtarı.</summary>
    private static DateTime DayKey(DateTime value) => DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);

    private sealed record DayTotals(decimal CashIn, decimal CashOut, decimal CardIn, decimal TransferIn, int CollectionCount);

    private async Task<DayTotals> ComputeAsync(DateTime dayKey, CancellationToken cancellationToken)
    {
        // Yerel gün [00:00, 24:00) → UTC [-3 saat, +21 saat).
        var start = dayKey.AddHours(-3);
        var end = start.AddDays(1);

        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item => item.PaidAtUtc >= start && item.PaidAtUtc < end && item.Currency == "TRY")
            .Select(item => new { item.Amount, item.Method, item.RefundChannel })
            .ToListAsync(cancellationToken);
        var cashIn = payments.Where(item => item.Amount > 0 && FinanceMethods.IsCash(item.Method)).Sum(item => item.Amount);
        var cardIn = payments.Where(item => item.Amount > 0 && FinanceMethods.IsCard(item.Method)).Sum(item => item.Amount);
        var transferIn = payments.Where(item => item.Amount > 0 && FinanceMethods.IsTransfer(item.Method)).Sum(item => item.Amount);
        var cashRefunds = payments.Where(item => item.Amount < 0 && FinanceMethods.IsCash(item.RefundChannel)).Sum(item => -item.Amount);

        var expenses = await dbContext.DrivingExpenses.AsNoTracking()
            .Where(item => item.ExpenseDateUtc >= start && item.ExpenseDateUtc < end)
            .Select(item => new { item.Amount, item.PaymentMethod, item.ApprovalStatus })
            .ToListAsync(cancellationToken);
        var cashExpenses = expenses
            .Where(item => FinanceExpenseRules.ExpenseCountsAsExpense(item.ApprovalStatus) && FinanceMethods.IsCash(item.PaymentMethod))
            .Sum(item => item.Amount);

        var salaries = await dbContext.AccountingSalaries.AsNoTracking()
            .Where(item => item.PaidAtUtc >= start && item.PaidAtUtc < end)
            .Select(item => new { item.Amount, item.PaymentMethod, item.Status })
            .ToListAsync(cancellationToken);
        var cashSalaries = salaries
            .Where(item => FinanceExpenseRules.SalaryCountsAsExpense(item.Status) && FinanceMethods.IsCash(item.PaymentMethod))
            .Sum(item => MoneyParser.Parse(item.Amount));

        var invoices = await dbContext.AccountingInvoices.AsNoTracking()
            .Where(item => item.PaidAtUtc >= start && item.PaidAtUtc < end)
            .Select(item => new { item.Amount, item.PaymentMethod, item.Status })
            .ToListAsync(cancellationToken);
        var cashInvoices = invoices
            .Where(item => FinanceExpenseRules.InvoiceCountsAsExpense(item.Status) && FinanceMethods.IsCash(item.PaymentMethod))
            .Sum(item => MoneyParser.Parse(item.Amount));

        return new DayTotals(
            cashIn,
            cashRefunds + cashExpenses + cashSalaries + cashInvoices,
            cardIn,
            transferIn,
            payments.Count(item => item.Amount > 0));
    }

    private static FinanceDayClosingDto ToDto(FinanceDayClosing item) => new(
        item.Id, item.Day, item.CashIn, item.CashOut, item.ExpectedCash, item.CountedCash, item.Difference,
        item.CardIn, item.TransferIn, item.CollectionCount, item.Note, item.ClosedByName, item.ClosedAtUtc);
}
