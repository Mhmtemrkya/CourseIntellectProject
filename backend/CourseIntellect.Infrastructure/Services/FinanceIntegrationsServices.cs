using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Ödeme ağ geçidi soyutlaması. "PaymentGateway:Provider" + "ApiKey"
/// yapılandırılınca gerçek sağlayıcıya bağlanacak şekilde tasarlandı; şimdilik
/// güvenli stub (test akışı): confirm yalnızca "TEST-OK" token'ı ya da gerçek
/// yapılandırma ile başarılı döner.
/// </summary>
public sealed class StubPaymentGatewayService(IConfiguration configuration) : IPaymentGatewayService
{
    private readonly string? _provider = configuration["PaymentGateway:Provider"];
    private readonly string? _apiKey = configuration["PaymentGateway:ApiKey"];

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_provider) && !string.IsNullOrWhiteSpace(_apiKey);

    public Task<PaymentIntentDto> CreateIntentAsync(PaymentIntentRequest request, CancellationToken cancellationToken = default)
    {
        var provider = string.IsNullOrWhiteSpace(_provider) ? "stub" : _provider!;
        var intentId = $"PI-{Guid.NewGuid():N}";
        // Gerçek sağlayıcıda burada checkout/token oluşturulur. Stub'da null döner.
        return Task.FromResult(new PaymentIntentDto(
            provider,
            intentId,
            IsConfigured ? "RequiresAction" : "StubReady",
            null,
            IsConfigured));
    }

    public Task<bool> ConfirmAsync(ConfirmPaymentRequest request, CancellationToken cancellationToken = default)
    {
        if (IsConfigured)
        {
            // Gerçek sağlayıcıda token doğrulanır. Stub modunda yapılandırma varsa başarı kabul.
            return Task.FromResult(!string.IsNullOrWhiteSpace(request.Token));
        }

        // Yapılandırma yoksa yalnızca açık test token'ı ile başarı.
        return Task.FromResult(string.Equals(request.Token, "TEST-OK", StringComparison.OrdinalIgnoreCase));
    }
}

/// <summary>
/// e-Fatura/e-Arşiv soyutlaması. "EInvoice:Provider" + "ApiKey" yapılandırılınca
/// GİB entegratörüne gönderilecek şekilde; şimdilik KDV hesaplı stub (mock ETTN).
/// </summary>
public sealed class StubEInvoiceService(IConfiguration configuration) : IEInvoiceService
{
    private readonly string? _provider = configuration["EInvoice:Provider"];
    private readonly string? _apiKey = configuration["EInvoice:ApiKey"];

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_provider) && !string.IsNullOrWhiteSpace(_apiKey);

    public Task<EInvoiceResultDto> IssueAsync(IssueEInvoiceRequest request, CancellationToken cancellationToken = default)
    {
        // Tutar KDV dahil kabul edilir; net ve KDV ayrıştırılır.
        var vatRate = request.VatRate <= 0 ? 0m : request.VatRate;
        var gross = Math.Max(0, request.Amount);
        var net = vatRate > 0 ? Math.Round(gross / (1 + vatRate / 100m), 2, MidpointRounding.AwayFromZero) : gross;
        var vat = gross - net;
        var provider = string.IsNullOrWhiteSpace(_provider) ? "stub" : _provider!;

        return Task.FromResult(new EInvoiceResultDto(
            provider,
            IsConfigured ? "Issued" : "Stub",
            $"{Guid.NewGuid():N}"[..32].ToUpperInvariant(),
            net,
            vat,
            gross,
            IsConfigured,
            IsConfigured ? null : "e-Fatura sağlayıcısı yapılandırılmadı; örnek (stub) belge üretildi."));
    }
}

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
        var minDate = rows.Min(item => item.Date).AddDays(-tolerance - 1);
        var maxDate = rows.Max(item => item.Date).AddDays(tolerance + 1);

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
