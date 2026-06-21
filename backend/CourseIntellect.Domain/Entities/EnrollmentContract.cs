namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Öğrencinin kayıt/sözleşme finansalı: ne kadara kayıt oldu, indirim,
/// net tutar, peşinat ve taksit sayısı. Taksit planı buradan üretilir.
/// </summary>
public sealed class EnrollmentContract : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? StudentUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string AcademicYear { get; set; } = string.Empty;
    public decimal GrossAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public string DiscountReason { get; set; } = string.Empty;
    public decimal NetAmount { get; set; }
    public decimal DownPayment { get; set; }
    public int InstallmentCount { get; set; }
    public string Currency { get; set; } = "TRY";
    public string Status { get; set; } = "Active";
    public string Note { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
