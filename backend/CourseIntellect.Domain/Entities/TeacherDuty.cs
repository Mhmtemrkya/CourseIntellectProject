namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Öğretmen nöbet kaydı. Bir nöbet birden çok öğretmene atanabilir; her atama
/// ayrı bir satırdır (ortak <see cref="GroupId"/> ile bağlanır). "Nöbetlerim"
/// görünümü <see cref="TeacherUserId"/>/<see cref="TeacherName"/> ile filtrelenir.
/// </summary>
public sealed class TeacherDuty : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid GroupId { get; set; } = Guid.NewGuid();
    public string DutyType { get; set; } = "Sabah Nöbeti";
    public string Location { get; set; } = string.Empty;
    public DateTime DutyDateUtc { get; set; }
    public string Day { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Planlandı";
    public Guid? TeacherUserId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public string TeacherUsername { get; set; } = string.Empty;
    public string TeacherBranch { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
