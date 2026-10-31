using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

// Ödeme ağ geçidi ve e-Fatura servisleri FinanceProviderServices.cs içinde
// (config + IAppSettingService ile sürülen, anahtar girilince gerçek HTTP çağrısı).

/// <summary>
/// KULLANIMDAN KALDIRILDI: yeni uygulama sürümleri maaşı doğrudan yazar ve bu
/// hesaplayıcıyı çağırmaz. Yayındaki eski sürümler (masaüstü 1.3.2, mağazadaki
/// mobil) hâlâ çağırdığı için uç korunuyor; yeni sürümler yaygınlaşınca silinmeli.
///
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
/// Banka/POS ekstre satırlarını sistem kayıtlarıyla eşleştirir ve sonucu KALICI
/// saklar. Giren para (pozitif) nakit dışı tahsilatlarla; çıkan para (negatif)
/// onaylı giderler, ödenmiş maaşlar ve ödenmiş faturalarla eşleşir. Nakit hareketler
/// bankadan geçmediği için aday olmaz. Daha önce eşleşmiş kayıt yeniden aday olmaz;
/// aynı satır tekrar yüklenirse yeni kayıt açılmaz, mevcut sonuç döner.
/// </summary>
public sealed class ReconciliationService(CourseIntellectDbContext dbContext) : IReconciliationService
{
    private sealed record Candidate(string Type, Guid Id, decimal Amount, DateTime DateUtc, string Label, string? ReceiptNo);

    public async Task<ReconciliationResultDto> ReconcileAsync(ReconciliationRequest request, CancellationToken cancellationToken = default)
    {
        var rows = (request.Rows ?? [])
            .Where(row => row.Amount != 0)
            .ToList();
        if (rows.Count == 0)
        {
            return new ReconciliationResultDto(0, 0, 0, 0, 0, []);
        }

        var tolerance = Math.Clamp(request.DateToleranceDays, 0, 30);
        // JSON'dan gelen tarihler Unspecified olabilir; Postgres timestamptz için UTC'ye sabitle.
        var minDate = DateTime.SpecifyKind(rows.Min(item => item.Date).Date.AddDays(-tolerance - 1), DateTimeKind.Utc);
        var maxDate = DateTime.SpecifyKind(rows.Max(item => item.Date).Date.AddDays(tolerance + 1), DateTimeKind.Utc);

        var alreadyMatched = (await dbContext.BankReconciliationEntries.AsNoTracking()
            .Where(item => item.Status == "Matched" && item.MatchedId != null)
            .Select(item => item.MatchedId!.Value)
            .ToListAsync(cancellationToken)).ToHashSet();

        var candidates = new List<Candidate>();
        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item => item.Amount > 0 && item.PaidAtUtc >= minDate && item.PaidAtUtc <= maxDate)
            .Select(item => new { item.Id, item.Amount, item.PaidAtUtc, item.Method, item.StudentName, item.ReceiptNo })
            .ToListAsync(cancellationToken);
        candidates.AddRange(payments
            .Where(item => !FinanceMethods.IsCash(item.Method))
            .Select(item => new Candidate("Payment", item.Id, item.Amount, item.PaidAtUtc,
                $"{item.StudentName} • {item.ReceiptNo}", item.ReceiptNo)));

        var expenses = await dbContext.DrivingExpenses.AsNoTracking()
            .Where(item => item.ApprovalStatus == "Onaylandı" && item.ExpenseDateUtc >= minDate && item.ExpenseDateUtc <= maxDate)
            .Select(item => new { item.Id, item.Amount, item.ExpenseDateUtc, item.Title, item.PaymentMethod })
            .ToListAsync(cancellationToken);
        candidates.AddRange(expenses
            .Where(item => !FinanceMethods.IsCash(item.PaymentMethod))
            .Select(item => new Candidate("Expense", item.Id, -item.Amount, item.ExpenseDateUtc, $"Gider • {item.Title}", null)));

        var salaries = await dbContext.AccountingSalaries.AsNoTracking()
            .Where(item => item.PaidAtUtc != null && item.PaidAtUtc >= minDate && item.PaidAtUtc <= maxDate)
            .Select(item => new { item.Id, item.Amount, item.PaidAtUtc, item.Employee, item.PaymentMethod, item.Status })
            .ToListAsync(cancellationToken);
        candidates.AddRange(salaries
            .Where(item => FinanceExpenseRules.SalaryCountsAsExpense(item.Status) && !FinanceMethods.IsCash(item.PaymentMethod))
            .Select(item => new Candidate("Salary", item.Id, -MoneyParser.Parse(item.Amount), item.PaidAtUtc!.Value, $"Maaş • {item.Employee}", null)));

        var invoices = await dbContext.AccountingInvoices.AsNoTracking()
            .Where(item => item.PaidAtUtc != null && item.PaidAtUtc >= minDate && item.PaidAtUtc <= maxDate)
            .Select(item => new { item.Id, item.Amount, item.PaidAtUtc, item.Title, item.InvoiceNumber, item.PaymentMethod, item.Status })
            .ToListAsync(cancellationToken);
        candidates.AddRange(invoices
            .Where(item => FinanceExpenseRules.InvoiceCountsAsExpense(item.Status) && !FinanceMethods.IsCash(item.PaymentMethod))
            .Select(item => new Candidate("Invoice", item.Id, -MoneyParser.Parse(item.Amount), item.PaidAtUtc!.Value,
                $"Fatura {item.InvoiceNumber} • {item.Title}", item.InvoiceNumber)));

        var available = candidates.Where(item => !alreadyMatched.Contains(item.Id)).ToList();
        var used = new HashSet<Guid>();
        var items = new List<ReconciliationMatchDto>();
        foreach (var row in rows)
        {
            var bankDate = DateTime.SpecifyKind(row.Date.Date, DateTimeKind.Utc);
            var reference = (row.Reference ?? string.Empty).Trim();
            if (reference.Length == 0) reference = $"{bankDate:yyyyMMdd}-{row.Amount:0.##}";
            if (reference.Length > 120) reference = reference[..120];

            var entry = await dbContext.BankReconciliationEntries
                .FirstOrDefaultAsync(item => item.Reference == reference && item.BankDate == bankDate && item.Amount == row.Amount, cancellationToken);
            if (entry is null)
            {
                entry = new BankReconciliationEntry
                {
                    Reference = reference,
                    BankDate = bankDate,
                    Amount = row.Amount,
                    Description = Truncate(row.Description, 300),
                };
                await dbContext.BankReconciliationEntries.AddAsync(entry, cancellationToken);
            }

            if (entry.Status == "Unmatched")
            {
                // Aynı tutar ve en yakın tarih; eşitlikte en eski kayıt.
                var match = available
                    .Where(item => !used.Contains(item.Id)
                        && item.Amount == row.Amount
                        && Math.Abs((item.DateUtc.Date - bankDate).TotalDays) <= tolerance)
                    .OrderBy(item => Math.Abs((item.DateUtc.Date - bankDate).TotalDays))
                    .ThenBy(item => item.DateUtc)
                    .FirstOrDefault();
                if (match is not null)
                {
                    used.Add(match.Id);
                    entry.Status = "Matched";
                    entry.MatchedType = match.Type;
                    entry.MatchedId = match.Id;
                    entry.MatchedLabel = Truncate(match.Label, 200);
                    entry.UpdatedAtUtc = DateTime.UtcNow;
                }
            }

            items.Add(ToMatch(entry, candidates));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var matched = items.Count(item => item.MatchStatus == "Matched");
        return new ReconciliationResultDto(
            items.Count,
            matched,
            items.Count - matched,
            items.Where(item => item.MatchStatus == "Matched").Sum(item => Math.Abs(item.Amount)),
            items.Where(item => item.MatchStatus != "Matched").Sum(item => Math.Abs(item.Amount)),
            items);
    }

    public async Task<IReadOnlyList<BankReconciliationEntryDto>> ListAsync(string? status, CancellationToken cancellationToken = default)
    {
        var query = dbContext.BankReconciliationEntries.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(item => item.Status == status);
        return await query
            .OrderByDescending(item => item.BankDate).ThenByDescending(item => item.CreatedAtUtc)
            .Take(1000)
            .Select(item => new BankReconciliationEntryDto(item.Id, item.Reference, item.BankDate, item.Amount, item.Description,
                item.Status, item.MatchedType, item.MatchedId, item.MatchedLabel, item.CreatedAtUtc))
            .ToListAsync(cancellationToken);
    }

    /// <summary>action: ignore (banka masrafı vb., eşleşme beklenmez), unmatch (eşleşmeyi kaldır), reopen.</summary>
    public async Task<BankReconciliationEntryDto?> UpdateEntryAsync(Guid id, string action, CancellationToken cancellationToken = default)
    {
        var entry = await dbContext.BankReconciliationEntries.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (entry is null) return null;
        switch ((action ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "ignore":
                entry.Status = "Ignored";
                entry.MatchedType = string.Empty;
                entry.MatchedId = null;
                entry.MatchedLabel = string.Empty;
                break;
            case "unmatch":
            case "reopen":
                entry.Status = "Unmatched";
                entry.MatchedType = string.Empty;
                entry.MatchedId = null;
                entry.MatchedLabel = string.Empty;
                break;
            default:
                throw new ArgumentException("Geçersiz işlem.");
        }
        entry.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return new BankReconciliationEntryDto(entry.Id, entry.Reference, entry.BankDate, entry.Amount, entry.Description,
            entry.Status, entry.MatchedType, entry.MatchedId, entry.MatchedLabel, entry.CreatedAtUtc);
    }

    private static ReconciliationMatchDto ToMatch(BankReconciliationEntry entry, IReadOnlyList<Candidate> candidates)
    {
        var receipt = entry.MatchedId is Guid id ? candidates.FirstOrDefault(item => item.Id == id)?.ReceiptNo : null;
        return new ReconciliationMatchDto(
            entry.Reference,
            entry.Amount,
            entry.BankDate,
            entry.MatchedType == "Payment" ? entry.MatchedId : null,
            receipt,
            entry.Status,
            entry.MatchedType,
            entry.MatchedLabel,
            entry.Id);
    }

    private static string Truncate(string? value, int max)
    {
        var text = (value ?? string.Empty).Trim();
        return text.Length > max ? text[..max] : text;
    }
}
