namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Personel izin / devamsızlık talebi. Oluşturulduğunda merkezi onay motoruna
/// (ApprovalRequest) bir kayıt düşer; karar verildiğinde ikisi senkronlanır.
/// </summary>
public sealed class StaffLeaveRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? StaffUserId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string LeaveType { get; set; } = "Yıllık";
    public DateTime StartDateUtc { get; set; }
    public DateTime EndDateUtc { get; set; }
    public int Days { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public Guid? ApprovalRequestId { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public string DecidedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAtUtc { get; set; }
}
