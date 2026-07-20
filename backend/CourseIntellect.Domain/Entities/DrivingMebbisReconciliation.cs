namespace CourseIntellect.Domain.Entities;

public enum DrivingMebbisReconciliationStatus { Completed = 1, Superseded = 2 }
public enum DrivingMebbisReconciliationRowClass { Matched = 1, CourseOnly = 2, MebbisOnly = 3, Different = 4 }

public sealed class DrivingMebbisReconciliation : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentGroupId { get; set; }
    public DrivingMebbisReconciliationStatus Status { get; set; } = DrivingMebbisReconciliationStatus.Completed;
    public string SourceSessionsJson { get; set; } = "[]";
    public int TotalRows { get; set; }
    public int MatchedRows { get; set; }
    public int CourseOnlyRows { get; set; }
    public int MebbisOnlyRows { get; set; }
    public int DifferentRows { get; set; }
    public int LicenseClassDifferenceRows { get; set; }
    public int TermDifferenceRows { get; set; }
    public int CertificateDifferenceRows { get; set; }
    public int ExamResultDifferenceRows { get; set; }
    public int StudentStatusDifferenceRows { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingMebbisReconciliationRow : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ReconciliationId { get; set; }
    public DrivingMebbisReconciliationRowClass Classification { get; set; }
    public string MaskedIdentity { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public Guid? StudentDrivingProfileId { get; set; }
    public Guid? SourceImportRowId { get; set; }
    public int? SourceRowNumber { get; set; }
    public string DifferenceCodesJson { get; set; } = "[]";
    public string CourseSnapshotJson { get; set; } = "{}";
    public string MebbisSnapshotJson { get; set; } = "{}";
}
