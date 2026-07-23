namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Öğrenciden alınan tahsilat. Bir taksite ve/veya sözleşmeye mahsup edilir.
/// ReceiptNo sıralı makbuz numarasıdır.
/// </summary>
public sealed class FinancePayment : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? EnrollmentContractId { get; set; }
    public Guid? FinanceInstallmentId { get; set; }
    public Guid? StudentUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Method { get; set; } = "Cash";
    public string ReceiptNo { get; set; } = string.Empty;
    public string Currency { get; set; } = "TRY";
    public string Note { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime PaidAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Collection veya Refund. Eski kayıtlar Collection kabul edilir.</summary>
    public string EntryType { get; set; } = "Collection";

    /// <summary>İade hareketinin bağlı olduğu özgün tahsilat.</summary>
    public Guid? OriginalPaymentId { get; set; }

    /// <summary>PaymentReversal, AdvanceReturn veya ContractReduction.</summary>
    public string RefundType { get; set; } = string.Empty;
    public string RefundStatus { get; set; } = string.Empty;
    public string RefundReason { get; set; } = string.Empty;
    public string RefundChannel { get; set; } = string.Empty;
    public string ExternalReference { get; set; } = string.Empty;
}
