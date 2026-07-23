namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Bir tahsilatın hangi taksite ne kadar mahsup edildiğini saklar. İadeler bu izi
/// tersine çevirir; böylece vade tahminiyle yanlış taksit açılmaz.
/// </summary>
public sealed class FinancePaymentAllocation : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid FinancePaymentId { get; set; }
    public Guid FinanceInstallmentId { get; set; }
    public decimal Amount { get; set; }
    public decimal RefundedAmount { get; set; }
    public int Sequence { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
