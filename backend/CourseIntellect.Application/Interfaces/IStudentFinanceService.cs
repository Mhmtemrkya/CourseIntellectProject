using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Application.Interfaces;

public interface IStudentFinanceService
{
    Task<EnrollmentContractDto> CreateEnrollmentAsync(
        CreateEnrollmentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    Task<StudentFinanceAccountDto> GetAccountAsync(
        Guid? studentUserId,
        string? studentName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cari hesap ekstresi: kurum künyesi + cari kartı + tarih sıralı borç/alacak
    /// hareketleri ve yürüyen bakiye. Tarih verilmezse ilk hareketten bugüne kadar
    /// tüm geçmiş kapsanır; <paramref name="toUtc"/> dâhil edilen son gündür.
    /// </summary>
    Task<StudentStatementDto> GetStatementAsync(
        Guid? studentUserId,
        string? studentName,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken = default);

    Task<FinancePaymentDto> RecordPaymentAsync(
        RecordPaymentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    Task<StudentFinanceSummaryDto> GetSummaryAsync(
        Guid? studentUserId,
        string? studentName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StudentFinanceSummaryDto>> GetAllSummariesAsync(
        string? className,
        CancellationToken cancellationToken = default);

    Task<FinancePaymentDto> RefundPaymentAsync(
        RefundRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sıradaki makbuz numarası. Makbuz numarası TEK yerden üretilir; kendi
    /// numarasını üreten her akış er ya da geç mükerrer numara yazar.
    /// </summary>
    Task<string> NextReceiptNumberAsync(CancellationToken cancellationToken = default);

    /// <summary>Persists a tracked payment and reallocates its receipt number on a
    /// provider-reported unique receipt collision.</summary>
    Task SavePaymentWithReceiptRetryAsync(
        FinancePayment payment,
        CancellationToken cancellationToken = default);

    Task<FinanceDashboardDto> GetDashboardAsync(
        string? className,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default);

    // Peşinatı beklenen (henüz tahsil edilmemiş) aktif sözleşmeleri döner.
    Task<IReadOnlyList<PendingDownPaymentDto>> GetPendingDownPaymentsAsync(
        CancellationToken cancellationToken = default);

    // Beklenen peşinatı makbuzlu tahsilat olarak kaydeder ve sözleşmeyi "ödendi"
    // işaretler. Zaten ödenmişse veya peşinatı yoksa hata döndürür (guard).
    Task<FinancePaymentDto> CollectDownPaymentAsync(
        Guid contractId,
        string? method,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default);

    Task<ReminderResultDto> SendDueRemindersAsync(
        int upcomingWindowDays,
        CancellationToken cancellationToken = default);

    // Yalnız vadesi geçmiş taksitler için, öğrencinin kendi velisine; aynı gün tekrar
    // basılırsa yeni bildirim yazılmaz.
    Task<ReminderResultDto> SendOverdueRemindersAsync(CancellationToken cancellationToken = default);

    // Ad tek öğrenciye aitse kimliğini döndürür, hiçbir kimliğe çıkmıyorsa null;
    // birden çok öğrenciye aitse InvalidOperationException fırlatır.
    Task<Guid?> ResolveUniqueStudentUserIdAsync(string? studentName, CancellationToken cancellationToken = default);

    // Taksite mahsup edilmemiş tahsilatı (peşinat, avans) düzeltir/siler. Bulunamazsa
    // KeyNotFoundException, iade/mahsup nedeniyle düzenlenemezse InvalidOperationException,
    // geçersiz tutarda ArgumentException fırlatır.
    Task<FinancePaymentDto> UpdateCollectionAsync(
        Guid paymentId,
        string? studentName,
        decimal amount,
        string? method,
        string? note,
        CancellationToken cancellationToken = default);

    Task DeleteCollectionAsync(Guid paymentId, CancellationToken cancellationToken = default);

    // Taksit tutarı/vadesi/durumu. "Ödendi" gerçek, makbuzlu tahsilat yazar.
    Task<FinanceInstallmentDto?> UpdateInstallmentAsync(
        Guid installmentId,
        decimal amount,
        DateTime dueDateUtc,
        string? status,
        string? method,
        Guid? actorUserId,
        CancellationToken cancellationToken = default);

    Task<FinanceInstallmentDto> CreateManualInstallmentAsync(
        string studentName,
        decimal amount,
        DateTime dueDateUtc,
        string? note,
        CancellationToken cancellationToken = default);

    // İndirim/burs tanımını aktif sözleşmenin ödenmemiş taksitlerinden düşer.
    Task<(decimal Applied, decimal Requested)> ApplyBenefitAsync(
        Guid? studentUserId,
        string studentName,
        decimal ratePercent,
        bool isScholarship,
        string title,
        CancellationToken cancellationToken = default);

    // Taksitsiz/taksit kaydı eksik (vade tarihi olmayan) eski sözleşmeleri tek bir
    // vadeli kayıtla takibe alır. Kalan tahsilat sayısını döndürür.
    Task<int> BackfillMissingInstallmentsAsync(CancellationToken cancellationToken = default);

    // Geçmiş kayıt peşinatlarını (Method="Peşinat") "Nakit" ödeme yöntemine çevirir,
    // böylece kasa/nakit-kart dağılımına doğru düşerler. Güncellenen kayıt sayısını döndürür.
    Task<int> BackfillDownPaymentMethodAsync(CancellationToken cancellationToken = default);
}
