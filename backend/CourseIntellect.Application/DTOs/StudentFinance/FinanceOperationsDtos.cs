namespace CourseIntellect.Application.DTOs.StudentFinance;

// ---- Gün sonu kasa kapanışı ----
public sealed record FinanceDayClosingDto(
    Guid Id,
    DateTime Day,
    decimal CashIn,
    decimal CashOut,
    decimal ExpectedCash,
    decimal CountedCash,
    decimal Difference,
    decimal CardIn,
    decimal TransferIn,
    int CollectionCount,
    string Note,
    string ClosedByName,
    DateTime ClosedAtUtc);

public sealed record FinanceDaySummaryDto(
    DateTime Day,
    bool IsClosed,
    decimal CashIn,
    decimal CashOut,
    decimal ExpectedCash,
    decimal CardIn,
    decimal TransferIn,
    int CollectionCount,
    FinanceDayClosingDto? Closing);

public sealed record CloseFinanceDayRequest(DateTime Day, decimal CountedCash, string? Note);

public sealed record ReopenFinanceDayRequest(DateTime Day, string Reason);

// ---- Banka mutabakatı (kalıcı) ----
public sealed record BankReconciliationEntryDto(
    Guid Id,
    string Reference,
    DateTime BankDate,
    decimal Amount,
    string Description,
    string Status,
    string MatchedType,
    Guid? MatchedId,
    string MatchedLabel,
    DateTime CreatedAtUtc);

/// <summary>action: ignore (eşleşme beklenmez) veya unmatch (eşleşmeyi kaldır).</summary>
public sealed record ReconciliationEntryActionRequest(string Action);

// ---- Sözleşme yaşam döngüsü ----
/// <summary>Action: freeze (dondur), unfreeze (devam ettir), cancel (kaydı iptal et).</summary>
public sealed record ChangeContractStatusRequest(string Action, string Reason);

/// <summary>Kalan borcu yeni bir taksit planına böler.</summary>
public sealed record RestructureInstallmentsRequest(int InstallmentCount, DateTime FirstDueDate, string? Reason);

// ---- Toplu tahsilat ----
public sealed record BulkCollectionRow(
    int Line,
    string StudentName,
    decimal Amount,
    string? Method,
    DateTime? PaidAt,
    string? Reference,
    Guid? StudentUserId = null);

public sealed record BulkCollectionRequest(IReadOnlyList<BulkCollectionRow> Rows, bool DryRun);

/// <summary>Status: Ready (önizleme), Recorded, Duplicate (daha önce işlenmiş), Error.</summary>
public sealed record BulkCollectionRowResult(
    int Line,
    string StudentName,
    decimal Amount,
    string Status,
    string Message,
    string? ReceiptNo);

public sealed record BulkCollectionResultDto(
    int Total,
    int Recorded,
    int Duplicates,
    int Errors,
    decimal RecordedAmount,
    IReadOnlyList<BulkCollectionRowResult> Rows);

// ---- Para birimi kırılımı ----
public sealed record CurrencyTotalDto(
    string Currency,
    decimal NetTotal,
    decimal CollectedTotal,
    decimal OutstandingTotal);
