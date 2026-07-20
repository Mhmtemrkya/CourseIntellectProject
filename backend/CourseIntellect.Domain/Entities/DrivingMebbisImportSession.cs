namespace CourseIntellect.Domain.Entities;

public enum DrivingMebbisImportType { CandidateList = 1, ExamResults = 2, CertificateNumbers = 3, TermList = 4, StudentStatuses = 5 }
public enum DrivingMebbisImportStatus { PreviewReady = 1, Applied = 2, Rejected = 3, Failed = 4 }
public enum DrivingMebbisImportRowClass { Matched = 1, NotFound = 2, Conflict = 3, Change = 4, New = 5, Unchanged = 6, Invalid = 7 }

public sealed class DrivingMebbisImportSession : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public DrivingMebbisImportType ImportType { get; set; }
    public DrivingMebbisImportStatus Status { get; set; } = DrivingMebbisImportStatus.PreviewReady;
    public Guid? StudentGroupId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public int PreviewVersion { get; set; } = 1;
    public int TotalRows { get; set; }
    public int MatchedRows { get; set; }
    public int NotFoundRows { get; set; }
    public int ConflictRows { get; set; }
    public int ChangeRows { get; set; }
    public int NewRows { get; set; }
    public int InvalidRows { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? AppliedByUserId { get; set; }
    public DateTime? AppliedAtUtc { get; set; }
    public string ApplySummaryJson { get; set; } = "{}";
}

public sealed class DrivingMebbisImportRow : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ImportSessionId { get; set; }
    public int RowNumber { get; set; }
    public DrivingMebbisImportRowClass Classification { get; set; }
    public string MatchKey { get; set; } = string.Empty;
    public Guid? MatchedStudentProfileId { get; set; }
    public Guid? MatchedEntityId { get; set; }
    public string SourceJson { get; set; } = "{}";
    public string ChangesJson { get; set; } = "[]";
    public string MessagesJson { get; set; } = "[]";
    public bool SelectedForApply { get; set; } = true;
}
