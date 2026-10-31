using CourseIntellect.Application.DTOs.StudentFinance;

namespace CourseIntellect.Application.Interfaces;

/// <summary>Online ödeme ağ geçidi (iyzico/PayTR vb.) — config-driven, anahtar yoksa stub.</summary>
public interface IPaymentGatewayService
{
    bool IsConfigured { get; }
    Task<PaymentIntentDto> CreateIntentAsync(PaymentIntentRequest request, CancellationToken cancellationToken = default);
    Task<bool> ConfirmAsync(ConfirmPaymentRequest request, CancellationToken cancellationToken = default);
}

/// <summary>e-Fatura/e-Arşiv (GİB) — config-driven, anahtar yoksa KDV hesaplı stub.</summary>
public interface IEInvoiceService
{
    bool IsConfigured { get; }
    Task<EInvoiceResultDto> IssueAsync(IssueEInvoiceRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// KULLANIMDAN KALDIRILDI: yalnız eski uygulama sürümleri için. Yeni sürümler maaşı
/// doğrudan yazar; eski sürümler yaygınlıktan kalkınca silinmeli.
/// </summary>
public interface IPayrollService
{
    PayrollResultDto Calculate(PayrollRequest request);
}

/// <summary>Banka/POS ekstre satırlarını tahsilatlarla eşleştirir.</summary>
public interface IReconciliationService
{
    Task<ReconciliationResultDto> ReconcileAsync(ReconciliationRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BankReconciliationEntryDto>> ListAsync(string? status, CancellationToken cancellationToken = default);

    /// <summary>action: ignore / unmatch. Bulunamazsa null; geçersiz işlemde ArgumentException.</summary>
    Task<BankReconciliationEntryDto?> UpdateEntryAsync(Guid id, string action, CancellationToken cancellationToken = default);
}
