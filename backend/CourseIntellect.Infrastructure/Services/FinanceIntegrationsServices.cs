using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

// Ödeme ağ geçidi ve e-Fatura servisleri FinanceProviderServices.cs içinde
// (config + IAppSettingService ile sürülen, anahtar girilince gerçek HTTP çağrısı).

/// <summary>
/// Türkiye bordrosu yaklaşık hesabı (2025): SGK işçi %14, işsizlik işçi %1,
/// gelir vergisi aylık dilimlere göre, damga %0,759. İşveren maliyeti dahil.
/// Kümülatif vergi matrahı ve istisnalar (asgari ücret istisnası) basitleştirilmiştir.
/// </summary>
public sealed class PayrollService : IPayrollService
{
    public PayrollResultDto Calculate(PayrollRequest request)
    {
        var gross = Math.Max(0, request.GrossSalary);
        var sgkEmployee = Math.Round(gross * 0.14m, 2);
        var unemploymentEmployee = Math.Round(gross * 0.01m, 2);
        var incomeTaxBase = gross - sgkEmployee - unemploymentEmployee;
        var incomeTax = Math.Round(CalculateMonthlyIncomeTax(incomeTaxBase), 2);
        var stampTax = Math.Round(gross * 0.00759m, 2);
        var net = gross - sgkEmployee - unemploymentEmployee - incomeTax - stampTax;

        var sgkEmployer = Math.Round(gross * 0.205m, 2);
        var unemploymentEmployer = Math.Round(gross * 0.02m, 2);
        var totalEmployerCost = gross + sgkEmployer + unemploymentEmployer;

        return new PayrollResultDto(
            gross,
            sgkEmployee,
            unemploymentEmployee,
            incomeTaxBase,
            incomeTax,
            stampTax,
            net,
            sgkEmployer,
            totalEmployerCost);
    }

    // Aylık matraha göre yaklaşık artan oranlı gelir vergisi (2025 dilim oranları).
    private static decimal CalculateMonthlyIncomeTax(decimal monthlyBase)
    {
        if (monthlyBase <= 0) return 0;
        // Aylık eşikler (yıllık dilimlerin yaklaşık aylık karşılığı).
        var brackets = new (decimal Upper, decimal Rate)[]
        {
            (9_150m, 0.15m),
            (19_550m, 0.20m),
            (45_850m, 0.27m),
            (158_000m, 0.35m),
            (decimal.MaxValue, 0.40m),
        };

        decimal tax = 0;
        decimal lower = 0;
        foreach (var (upper, rate) in brackets)
        {
            if (monthlyBase <= lower) break;
            var taxable = Math.Min(monthlyBase, upper) - lower;
            if (taxable > 0) tax += taxable * rate;
            lower = upper;
        }

        return tax;
    }
}

/// <summary>
/// Banka/POS ekstre satırlarını mevcut tahsilatlarla (tutar + tarih penceresi)
/// eşleştirir. Eşleşmeyen satırları işaretler. Kalıcı kayıt tutmaz.
/// </summary>
public sealed class ReconciliationService(CourseIntellectDbContext dbContext) : IReconciliationService
{
    public async Task<ReconciliationResultDto> ReconcileAsync(ReconciliationRequest request, CancellationToken cancellationToken = default)
    {
        var rows = request.Rows ?? [];
        if (rows.Count == 0)
        {
            return new ReconciliationResultDto(0, 0, 0, 0, 0, []);
        }

        var tolerance = Math.Max(0, request.DateToleranceDays);
        // JSON'dan gelen tarihler Unspecified olabilir; Postgres timestamptz için UTC'ye sabitle.
        var minDate = DateTime.SpecifyKind(rows.Min(item => item.Date).AddDays(-tolerance - 1), DateTimeKind.Utc);
        var maxDate = DateTime.SpecifyKind(rows.Max(item => item.Date).AddDays(tolerance + 1), DateTimeKind.Utc);

        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item => item.Amount > 0 && item.PaidAtUtc >= minDate && item.PaidAtUtc <= maxDate)
            .ToListAsync(cancellationToken);

        var usedPaymentIds = new HashSet<Guid>();
        var items = new List<ReconciliationMatchDto>();

        foreach (var row in rows)
        {
            var match = payments.FirstOrDefault(payment =>
                !usedPaymentIds.Contains(payment.Id)
                && payment.Amount == row.Amount
                && Math.Abs((payment.PaidAtUtc.Date - row.Date.Date).TotalDays) <= tolerance);

            if (match != null)
            {
                usedPaymentIds.Add(match.Id);
                items.Add(new ReconciliationMatchDto(row.Reference, row.Amount, row.Date, match.Id, match.ReceiptNo, "Matched"));
            }
            else
            {
                items.Add(new ReconciliationMatchDto(row.Reference, row.Amount, row.Date, null, null, "Unmatched"));
            }
        }

        var matched = items.Count(item => item.MatchStatus == "Matched");
        return new ReconciliationResultDto(
            items.Count,
            matched,
            items.Count - matched,
            items.Where(item => item.MatchStatus == "Matched").Sum(item => item.Amount),
            items.Where(item => item.MatchStatus == "Unmatched").Sum(item => item.Amount),
            items);
    }
}
