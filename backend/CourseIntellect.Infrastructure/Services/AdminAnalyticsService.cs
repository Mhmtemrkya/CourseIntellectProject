using System.Globalization;
using CourseIntellect.Domain.Services;
using CourseIntellect.Application.DTOs.Analytics;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

// Kurum yöneticisi ana sayfa grafiği: seçilen döneme göre (günlük/haftalık/aylık/
// yıllık/özel aralık) kova kova kazanç (tahsilat), kayıt olan öğrenci ve gider serisi.
public sealed class AdminAnalyticsService(CourseIntellectDbContext dbContext) : IAdminAnalyticsService
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private enum Granularity { Day, Week, Month, Year }

    public async Task<AdminAnalyticsResponse> GetAsync(
        string? period,
        DateTime? from,
        DateTime? to,
        CancellationToken cancellationToken = default)
    {
        var normalizedPeriod = (period ?? "week").Trim().ToLowerInvariant();
        var (buckets, granularity, rangeStart, rangeEnd) = BuildBuckets(normalizedPeriod, from, to);

        // Kazanç: normalize finans tahsilatları (kesin tarih + decimal tutar).
        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(p => p.PaidAtUtc >= rangeStart && p.PaidAtUtc < rangeEnd)
            .Select(p => new { p.PaidAtUtc, p.Amount })
            .ToListAsync(cancellationToken);

        // Kayıt olan öğrenci: StudentProfile.CreatedAtUtc.
        var registrations = await dbContext.Students.AsNoTracking()
            .Where(s => s.CreatedAtUtc >= rangeStart && s.CreatedAtUtc < rangeEnd)
            .Select(s => s.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        // Gider: işletme gider defteri (ortak /finance/expenses — iç tablo adı
        // DrivingExpense'tir ama okul da aynı ekranı kullanır) + maaş/bordro +
        // fatura. Ana paneldeki "Gider" sayacı da aynı üç kaynağı toplar.
        var operationalExpenses = await dbContext.DrivingExpenses.AsNoTracking()
            .Where(e => e.ExpenseDateUtc >= rangeStart && e.ExpenseDateUtc < rangeEnd)
            .Select(e => new { e.ExpenseDateUtc, e.Amount })
            .ToListAsync(cancellationToken);

        // Gider: maaş/bordro + fatura kayıtları (string tutar, in-memory parse).
        var salaries = await dbContext.AccountingSalaries.AsNoTracking()
            .Where(s => s.CreatedAtUtc >= rangeStart && s.CreatedAtUtc < rangeEnd)
            .Select(s => new { s.CreatedAtUtc, s.Amount })
            .ToListAsync(cancellationToken);
        var invoices = await dbContext.AccountingInvoices.AsNoTracking()
            .Where(i => i.CreatedAtUtc >= rangeStart && i.CreatedAtUtc < rangeEnd)
            .Select(i => new { i.CreatedAtUtc, i.Amount })
            .ToListAsync(cancellationToken);

        var working = buckets
            .Select(b => new MutableBucket { Start = b.Start, End = b.End })
            .ToList();

        foreach (var payment in payments)
        {
            var index = IndexOf(working, payment.PaidAtUtc);
            if (index >= 0) working[index].Revenue += payment.Amount;
        }
        foreach (var createdAt in registrations)
        {
            var index = IndexOf(working, createdAt);
            if (index >= 0) working[index].Registrations += 1;
        }
        foreach (var expense in operationalExpenses)
        {
            var index = IndexOf(working, expense.ExpenseDateUtc);
            if (index >= 0) working[index].Expense += expense.Amount;
        }
        foreach (var salary in salaries)
        {
            var index = IndexOf(working, salary.CreatedAtUtc);
            if (index >= 0) working[index].Expense += ParseAmount(salary.Amount);
        }
        foreach (var invoice in invoices)
        {
            var index = IndexOf(working, invoice.CreatedAtUtc);
            if (index >= 0) working[index].Expense += ParseAmount(invoice.Amount);
        }

        var resultBuckets = working
            .Select(b => new AdminAnalyticsBucket(
                b.Start.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                LabelFor(b.Start, granularity),
                b.Revenue,
                b.Registrations,
                b.Expense))
            .ToList();

        var totals = new AdminAnalyticsTotals(
            resultBuckets.Sum(b => b.Revenue),
            resultBuckets.Sum(b => b.Registrations),
            resultBuckets.Sum(b => b.Expense),
            resultBuckets.Sum(b => b.Revenue) - resultBuckets.Sum(b => b.Expense));

        return new AdminAnalyticsResponse(
            normalizedPeriod,
            rangeStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            rangeEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            resultBuckets,
            totals);
    }

    private static int IndexOf(List<MutableBucket> buckets, DateTime moment)
    {
        for (var i = 0; i < buckets.Count; i++)
        {
            if (moment >= buckets[i].Start && moment < buckets[i].End) return i;
        }
        return -1;
    }

    private static (List<(DateTime Start, DateTime End)> Buckets, Granularity Granularity, DateTime RangeStart, DateTime RangeEnd)
        BuildBuckets(string period, DateTime? from, DateTime? to)
    {
        var todayUtc = DateTime.UtcNow.Date;

        // Özel tarih aralığı: gün bazlı kovalar.
        if (from is not null && to is not null)
        {
            var start = DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc);
            var endInclusive = DateTime.SpecifyKind(to.Value.Date, DateTimeKind.Utc);
            if (endInclusive < start) endInclusive = start;
            var days = new List<(DateTime, DateTime)>();
            for (var day = start; day <= endInclusive; day = day.AddDays(1))
            {
                days.Add((day, day.AddDays(1)));
            }
            return (days, Granularity.Day, start, endInclusive.AddDays(1));
        }

        switch (period)
        {
            case "year":
            {
                const int count = 5;
                var startYear = new DateTime(todayUtc.Year - (count - 1), 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var buckets = new List<(DateTime, DateTime)>();
                for (var i = 0; i < count; i++)
                {
                    var s = startYear.AddYears(i);
                    buckets.Add((s, s.AddYears(1)));
                }
                return (buckets, Granularity.Year, startYear, startYear.AddYears(count));
            }
            case "month":
            {
                const int count = 12;
                var firstOfThisMonth = new DateTime(todayUtc.Year, todayUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var start = firstOfThisMonth.AddMonths(-(count - 1));
                var buckets = new List<(DateTime, DateTime)>();
                for (var i = 0; i < count; i++)
                {
                    var s = start.AddMonths(i);
                    buckets.Add((s, s.AddMonths(1)));
                }
                return (buckets, Granularity.Month, start, start.AddMonths(count));
            }
            case "week":
            {
                const int count = 12;
                var monday = StartOfWeek(todayUtc);
                var start = monday.AddDays(-7 * (count - 1));
                var buckets = new List<(DateTime, DateTime)>();
                for (var i = 0; i < count; i++)
                {
                    var s = start.AddDays(7 * i);
                    buckets.Add((s, s.AddDays(7)));
                }
                return (buckets, Granularity.Week, start, start.AddDays(7 * count));
            }
            case "day":
            default:
            {
                const int count = 14;
                var start = DateTime.SpecifyKind(todayUtc.AddDays(-(count - 1)), DateTimeKind.Utc);
                var buckets = new List<(DateTime, DateTime)>();
                for (var i = 0; i < count; i++)
                {
                    var s = start.AddDays(i);
                    buckets.Add((s, s.AddDays(1)));
                }
                return (buckets, Granularity.Day, start, start.AddDays(count));
            }
        }
    }

    private static DateTime StartOfWeek(DateTime date)
    {
        var utc = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        var diff = ((int)utc.DayOfWeek + 6) % 7; // Pazartesi = 0
        return utc.AddDays(-diff);
    }

    private static string LabelFor(DateTime start, Granularity granularity) => granularity switch
    {
        Granularity.Year => start.ToString("yyyy", Tr),
        Granularity.Month => start.ToString("MMM yy", Tr),
        Granularity.Week => start.ToString("dd MMM", Tr),
        _ => start.ToString("dd MMM", Tr),
    };

    // Para ayrıştırma tek kaynaktan (Domain/MoneyParser).
    private static decimal ParseAmount(string? amount) => MoneyParser.Parse(amount);

    private sealed class MutableBucket
    {
        public DateTime Start { get; init; }
        public DateTime End { get; init; }
        public decimal Revenue { get; set; }
        public int Registrations { get; set; }
        public decimal Expense { get; set; }
    }
}
