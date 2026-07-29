namespace CourseIntellect.Domain.Entities;

public enum DrivingMebbisErrorSeverity { Information = 0, Warning = 1, Blocking = 2 }

/// <summary>Kurum içi, sürümlü MEBBİS hata/çözüm bilgi kartı.</summary>
public sealed class DrivingMebbisErrorDefinition : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string PossibleCause { get; set; } = string.Empty;
    public string ResolutionStepsJson { get; set; } = "[]";
    public DrivingMebbisErrorSeverity Severity { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public int Version { get; set; } = 1;
    public Guid CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Bir hata kartının kursiyer veya işlemle ilişkili, denetlenebilir görülme kaydı.</summary>
public sealed class DrivingMebbisErrorOccurrence : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid ErrorDefinitionId { get; set; }
    public Guid? StudentDrivingProfileId { get; set; }
    public string SourceType { get; set; } = "Manual";
    public Guid? SourceId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
    public Guid ReportedByUserId { get; set; }
    public string ReportedByName { get; set; } = string.Empty;
    public DateTime? ResolvedAtUtc { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public string ResolutionNote { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
}
