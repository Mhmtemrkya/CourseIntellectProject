namespace CourseIntellect.Domain.Entities;

/// <summary>
/// MEBBİS giriş asistanındaki alan bazlı ilerlemeyi tutar. Alanın gerçek değeri,
/// MEBBİS parolası veya oturum bilgisi bu tabloda kesinlikle saklanmaz.
/// </summary>
public sealed class DrivingMebbisFieldProgress : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public string FieldKey { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public Guid? CompletedByUserId { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int Version { get; set; } = 1;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
