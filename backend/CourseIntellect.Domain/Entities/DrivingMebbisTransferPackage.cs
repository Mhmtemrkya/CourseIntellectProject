namespace CourseIntellect.Domain.Entities;

public enum DrivingMebbisTransferPackageType
{
    CandidateRegistration = 1, TermStudentList = 2, TheorySchedule = 3,
    DrivingSchedule = 4, ExamCandidateList = 5, ExamResultList = 6,
    CertificateList = 7, InvoiceList = 8, MeisStatistics = 9,
}

public enum DrivingMebbisTransferStatus { Generated = 1, Transferred = 2, Failed = 3, Cancelled = 4 }

/// <summary>Üretilmiş aktarım dosyasının değiştirilemeyen, sürümlü arşiv kaydı.</summary>
public sealed class DrivingMebbisTransferPackage : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public DrivingMebbisTransferPackageType PackageType { get; set; }
    public Guid? StudentGroupId { get; set; }
    public int? TermYear { get; set; }
    public int? TermNumber { get; set; }
    public string MebbisTermCode { get; set; } = string.Empty;
    public int FileVersion { get; set; } = 1;
    public int RowCount { get; set; }
    public int StudentCount { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = "text/csv; charset=utf-8";
    public long FileSize { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public DrivingMebbisTransferStatus Status { get; set; } = DrivingMebbisTransferStatus.Generated;
    public string ErrorResult { get; set; } = string.Empty;
    public int StatusVersion { get; set; } = 1;
    public Guid? CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? TransferredAtUtc { get; set; }
}
