using CourseIntellect.Application.DTOs.StudentFinance;

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

    // Taksitsiz/taksit kaydı eksik (vade tarihi olmayan) eski sözleşmeleri tek bir
    // vadeli kayıtla takibe alır. Kalan tahsilat sayısını döndürür.
    Task<int> BackfillMissingInstallmentsAsync(CancellationToken cancellationToken = default);

    // Geçmiş kayıt peşinatlarını (Method="Peşinat") "Nakit" ödeme yöntemine çevirir,
    // böylece kasa/nakit-kart dağılımına doğru düşerler. Güncellenen kayıt sayısını döndürür.
    Task<int> BackfillDownPaymentMethodAsync(CancellationToken cancellationToken = default);
}
