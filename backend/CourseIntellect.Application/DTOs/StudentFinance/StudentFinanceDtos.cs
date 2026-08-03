namespace CourseIntellect.Application.DTOs.StudentFinance;

public sealed record CreateEnrollmentRequest(
    Guid? StudentUserId,
    string StudentName,
    string ClassName,
    string AcademicYear,
    decimal GrossAmount,
    /// <summary>
    /// Burs DIŞINDAKİ indirim (kardeş, erken kayıt, personel çocuğu…).
    /// Sözleşmeye yazılan toplam indirim = bu tutar + bursun para karşılığı.
    /// </summary>
    decimal DiscountAmount,
    string? DiscountReason,
    decimal DownPayment,
    int InstallmentCount,
    DateTime? FirstInstallmentDate,
    string? Currency,
    string? Note,
    // Peşinatın ödeme yöntemi (Nakit/Kart/Havale); boşsa "Nakit" varsayılır.
    string? DownPaymentMethod = null,
    // Peşinat kayıt anında tahsil edildi mi? false → makbuz kesilmez, peşinat
    // "bekliyor" olarak sözleşmede durur. Varsayılan true (geriye dönük uyum).
    bool DownPaymentPaid = true,
    /// <summary>
    /// Burs oranı (0–100). 0/boş → öğrenci burslu değildir. Bursun tutarı
    /// sunucuda brüt üzerinden hesaplanır; istemcinin gönderdiği tutara
    /// GÜVENİLMEZ (indirim tutarı istemciden zorlanamasın).
    /// </summary>
    decimal ScholarshipPercent = 0);

public sealed record RecordPaymentRequest(
    Guid? StudentUserId,
    string StudentName,
    Guid? EnrollmentContractId,
    Guid? FinanceInstallmentId,
    decimal Amount,
    string? Method,
    string? Note,
    /// <summary>Tahsilatın yapıldığı şube. Boşsa aktörün etkin şubesine düşer.</summary>
    Guid? BranchId = null,
    /// <summary>
    /// İstemcinin ürettiği tekil istek kimliği. Aynı kimlikle gelen ikinci istek
    /// yeni tahsilat OLUŞTURMAZ, ilk makbuzu döndürür (çift tahsilat koruması).
    /// </summary>
    Guid? ClientRequestId = null);

public sealed record FinanceInstallmentDto(
    Guid Id,
    Guid EnrollmentContractId,
    int SeqNo,
    string Label,
    DateTime DueDateUtc,
    decimal Amount,
    decimal PaidAmount,
    decimal Remaining,
    string Status,
    string Currency);

public sealed record FinancePaymentDto(
    Guid Id,
    Guid? EnrollmentContractId,
    Guid? FinanceInstallmentId,
    decimal Amount,
    string Method,
    string ReceiptNo,
    DateTime PaidAtUtc,
    string Currency,
    string Note,
    string EntryType = "Collection",
    Guid? OriginalPaymentId = null,
    decimal RefundedAmount = 0,
    decimal RefundableAmount = 0,
    string RefundType = "",
    string RefundStatus = "",
    string RefundReason = "",
    string RefundChannel = "",
    string ExternalReference = "",
    decimal AllocatedRefundableAmount = 0,
    decimal UnallocatedRefundableAmount = 0,
    bool IsDownPayment = false,
    /// <summary>Tahsilatı alan personelin adı — makbuzun izi ekranda görünür.</summary>
    string CollectedByName = "",
    /// <summary>Tahsilatın işlendiği şube adı.</summary>
    string BranchName = "");

public sealed record EnrollmentContractDto(
    Guid Id,
    Guid? StudentUserId,
    string StudentName,
    string ClassName,
    string AcademicYear,
    decimal GrossAmount,
    decimal DiscountAmount,
    string DiscountReason,
    decimal NetAmount,
    decimal DownPayment,
    bool DownPaymentPaid,
    int InstallmentCount,
    string Currency,
    string Status,
    DateTime CreatedAtUtc,
    IReadOnlyList<FinanceInstallmentDto> Installments,
    decimal DownPaymentPaidAmount = 0,
    string DownPaymentStatus = "Bekliyor",
    /// <summary>Burs oranı (0–100); 0 ise öğrenci burslu değildir.</summary>
    decimal ScholarshipPercent = 0,
    /// <summary>Bursun para karşılığı — <see cref="DiscountAmount"/>'ın İÇİNDEDİR.</summary>
    decimal ScholarshipAmount = 0);

/// <summary>Bekleyen peşinatı tahsil etme isteği; yöntem boşsa "Nakit".</summary>
public sealed record CollectDownPaymentRequest(string? Method = null);

/// <summary>Peşinatı henüz tahsil edilmemiş (beklenen) sözleşme satırı.</summary>
public sealed record PendingDownPaymentDto(
    Guid ContractId,
    Guid? StudentUserId,
    string StudentName,
    string ClassName,
    decimal DownPayment,
    string Currency,
    string? DownPaymentMethod,
    DateTime CreatedAtUtc);

public sealed record StudentFinanceAccountDto(
    Guid? StudentUserId,
    string StudentName,
    string Currency,
    decimal NetTotal,
    decimal PaidTotal,
    decimal Balance,
    int OverdueCount,
    DateTime? NextDueDateUtc,
    IReadOnlyList<EnrollmentContractDto> Contracts,
    IReadOnlyList<FinanceInstallmentDto> Installments,
    IReadOnlyList<FinancePaymentDto> Payments,
    decimal GrossCollectedTotal = 0,
    decimal RefundedTotal = 0,
    decimal GrossTotal = 0,
    decimal DiscountTotal = 0,
    decimal DownPaymentTotal = 0,
    decimal DownPaymentPaidTotal = 0,
    bool HasPendingDownPayment = false,
    Guid? DrivingStudentProfileId = null,
    decimal DrivingExamFee = 0,
    bool DrivingExamFeePaid = false,
    int DrivingExamAttemptNo = 1,
    DateTime? DrivingExamDate = null,
    decimal CourseRemaining = 0,
    decimal AdditionalChargeRemaining = 0,
    decimal StandaloneExamFeeRemaining = 0,
    decimal TotalPayable = 0,
    /// <summary>
    /// Öğrencinin etkin burs oranı — birden çok sözleşme varsa EN YÜKSEK oran.
    /// 0 ise burslu değildir ve istemci burs kartını hiç çizmez.
    /// </summary>
    decimal ScholarshipPercent = 0,
    /// <summary>Tüm sözleşmelerde bursun toplam para karşılığı.</summary>
    decimal ScholarshipAmount = 0);

public sealed record StudentFinanceSummaryDto(
    Guid? StudentUserId,
    string StudentName,
    string ClassName,
    string Currency,
    decimal NetTotal,
    decimal PaidTotal,
    decimal Balance,
    int OverdueCount,
    DateTime? NextDueDateUtc,
    string Status,
    decimal GrossTotal = 0,
    decimal DiscountTotal = 0,
    decimal DownPaymentTotal = 0,
    decimal DownPaymentPaidTotal = 0,
    bool HasPendingDownPayment = false,
    Guid? DrivingStudentProfileId = null,
    decimal DrivingExamFee = 0,
    bool DrivingExamFeePaid = false,
    int DrivingExamAttemptNo = 1,
    DateTime? DrivingExamDate = null,
    decimal CourseRemaining = 0,
    decimal AdditionalChargeRemaining = 0,
    decimal StandaloneExamFeeRemaining = 0,
    decimal TotalPayable = 0);

// ---- Faz 2: iade, hatırlatma, dashboard ----
public sealed record RefundRequest(
    Guid PaymentId,
    decimal Amount,
    string RefundType,
    string Reason,
    string RefundChannel,
    string? ExternalReference);

public sealed record ReminderResultDto(int Notified, int UpcomingCount, int OverdueCount);

public sealed record AgingBucketDto(string Label, int Count, decimal Amount);

public sealed record FinanceDashboardDto(
    string Currency,
    decimal NetTotal,
    decimal CollectedTotal,
    decimal OutstandingTotal,
    decimal OverdueTotal,
    int OverdueStudentCount,
    int CollectionRatePercent,
    int AverageCollectionDays,
    // Peşinatı henüz tahsil edilmemiş sözleşme sayısı ve beklenen toplam tutar.
    int PendingDownPaymentCount,
    decimal PendingDownPaymentTotal,
    IReadOnlyList<AgingBucketDto> Aging,
    IReadOnlyList<MonthlyIncomeDto> MonthlyIncome,
    IReadOnlyList<StudentFinanceSummaryDto> TopDebtors,
    decimal RefundedTotal = 0);

public sealed record MonthlyIncomeDto(string Month, decimal Amount);

// ---- Faz 2: ödeme ağ geçidi (config-driven) ----
public sealed record PaymentIntentRequest(
    Guid? StudentUserId,
    string StudentName,
    Guid? EnrollmentContractId,
    Guid? FinanceInstallmentId,
    decimal Amount,
    string? ReturnUrl);

public sealed record PaymentIntentDto(
    string Provider,
    string IntentId,
    string Status,
    string? CheckoutUrl,
    bool Configured);

public sealed record ConfirmPaymentRequest(string IntentId, string? Token);

// ---- Faz 4: e-Fatura (config-driven) + KDV ----
public sealed record IssueEInvoiceRequest(
    Guid? StudentUserId,
    string StudentName,
    decimal Amount,
    decimal VatRate,
    string? Description);

public sealed record EInvoiceResultDto(
    string Provider,
    string Status,
    string? Ettn,
    decimal NetAmount,
    decimal VatAmount,
    decimal GrossAmount,
    bool Configured,
    string? Message);

// ---- Faz 4: bordro (SGK/stopaj) ----
public sealed record PayrollRequest(decimal GrossSalary, string? Employee, int? Year);

public sealed record PayrollResultDto(
    decimal Gross,
    decimal SgkEmployee,
    decimal UnemploymentEmployee,
    decimal IncomeTaxBase,
    decimal IncomeTax,
    decimal StampTax,
    decimal Net,
    decimal SgkEmployer,
    decimal TotalEmployerCost);

// ---- Faz 3: mutabakat ----
public sealed record BankStatementRow(string Reference, decimal Amount, DateTime Date, string? Description);

public sealed record ReconciliationRequest(IReadOnlyList<BankStatementRow> Rows, int DateToleranceDays);

public sealed record ReconciliationMatchDto(string Reference, decimal Amount, DateTime Date, Guid? PaymentId, string? ReceiptNo, string MatchStatus);

public sealed record ReconciliationResultDto(
    int Total,
    int Matched,
    int Unmatched,
    decimal MatchedAmount,
    decimal UnmatchedAmount,
    IReadOnlyList<ReconciliationMatchDto> Items);
