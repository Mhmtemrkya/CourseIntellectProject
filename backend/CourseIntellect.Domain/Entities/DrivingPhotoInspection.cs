namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Biyometrik fotoğrafın değiştirilemez kaynak belgeye bağlı kalite denetimi.
/// Orijinal dosya StudentDrivingDocument üzerinde korunur; MEBBİS kopyası ayrı tutulur.
/// </summary>
public sealed class DrivingPhotoInspection : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public Guid StudentDrivingDocumentId { get; set; }
    public string SourceSha256 { get; set; } = string.Empty;
    public long SourceBytes { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int FaceCount { get; set; }
    public double? FaceConfidence { get; set; }
    public double AverageBrightness { get; set; }
    public double BackgroundUniformity { get; set; }
    public string Overall { get; set; } = "Red";
    public string ChecksJson { get; set; } = "[]";
    public string MebbisFileUrl { get; set; } = string.Empty;
    public long? MebbisBytes { get; set; }
    public int? MebbisWidth { get; set; }
    public int? MebbisHeight { get; set; }
    public string AnalyzerVersion { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
