namespace CourseIntellect.Application.DTOs.StudentFinance;

public sealed record CreateEnrollmentRequest(
    Guid? StudentUserId,
    string StudentName,
    string ClassName,
    string AcademicYear,
    decimal GrossAmount,
    decimal DiscountAmount,
    string? DiscountReason,
    decimal DownPayment,
    int InstallmentCount,
    DateTime? FirstInstallmentDate,
    string? Currency,
    string? Note);

public sealed record RecordPaymentRequest(
    Guid? StudentUserId,
    string StudentName,
    Guid? EnrollmentContractId,
    Guid? FinanceInstallmentId,
    decimal Amount,
    string? Method,
    string? Note);

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
    string Note);

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
    int InstallmentCount,
    string Currency,
    string Status,
    DateTime CreatedAtUtc,
    IReadOnlyList<FinanceInstallmentDto> Installments);

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
    IReadOnlyList<FinancePaymentDto> Payments);

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
    string Status);

// ---- Faz 2: iade, hatırlatma, dashboard ----
public sealed record RefundRequest(
    Guid? StudentUserId,
    string StudentName,
    Guid? EnrollmentContractId,
    decimal Amount,
    string? Reason);

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
    IReadOnlyList<AgingBucketDto> Aging,
    IReadOnlyList<MonthlyIncomeDto> MonthlyIncome,
    IReadOnlyList<StudentFinanceSummaryDto> TopDebtors);

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
