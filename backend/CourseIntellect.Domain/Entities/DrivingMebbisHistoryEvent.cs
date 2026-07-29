namespace CourseIntellect.Domain.Entities;

public enum DrivingMebbisHistoryEventType
{
    Preparation = 1,
    DocumentReview = 2,
    CandidateEntry = 3,
    Verification = 4,
    ExamResult = 5,
    CertificateNumber = 6,
    Correction = 7,
    Import = 8,
    StatusChange = 9,
}

public enum DrivingMebbisHistorySeverity { Info = 1, Success = 2, Warning = 3, Error = 4 }

/// <summary>
/// Kursiyerin MEBBİS sürecindeki değiştirilemez olay kaydı. Kimlik numarası,
/// belge içeriği, MEBBİS parolası veya oturum verisi kesinlikle tutulmaz.
/// </summary>
public sealed class DrivingMebbisHistoryEvent : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public DrivingMebbisHistoryEventType EventType { get; set; }
    public DrivingMebbisHistorySeverity Severity { get; set; } = DrivingMebbisHistorySeverity.Info;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public Guid? SourceId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
