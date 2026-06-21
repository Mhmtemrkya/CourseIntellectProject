namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Sözleşmeden üretilen tek bir taksit. Ödeme alındıkça PaidAmount artar,
/// Status güncellenir (Pending / Partial / Paid / Overdue).
/// </summary>
public sealed class FinanceInstallment : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid EnrollmentContractId { get; set; }
    public Guid? StudentUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public int SeqNo { get; set; }
    public string Label { get; set; } = string.Empty;
    public DateTime DueDateUtc { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    public string Status { get; set; } = "Pending";
    public string Currency { get; set; } = "TRY";
}
