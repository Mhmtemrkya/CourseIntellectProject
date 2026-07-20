using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// MEBBİS'e ilişkin bir işin kurum içindeki doğrulanabilir durumudur. MEBBİS
/// parolası veya hassas oturum verisi burada kesinlikle tutulmaz.
/// </summary>
public sealed class DrivingMebbisWorkItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public DrivingMebbisWorkType WorkType { get; set; }
    public Guid SubjectId { get; set; }
    public Guid? StudentDrivingProfileId { get; set; }
    public Guid? StudentGroupId { get; set; }
    public DrivingMebbisWorkStatus Status { get; set; } = DrivingMebbisWorkStatus.Preparing;
    public string Note { get; set; } = string.Empty;
    public string ErrorReason { get; set; } = string.Empty;
    public Guid? AssignedToUserId { get; set; }
    public Guid? LastChangedByUserId { get; set; }
    public DateTime? EnteredAtUtc { get; set; }
    public DateTime? VerifiedAtUtc { get; set; }
    public DateTime? DueAtUtc { get; set; }
    public int Version { get; set; } = 1;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
