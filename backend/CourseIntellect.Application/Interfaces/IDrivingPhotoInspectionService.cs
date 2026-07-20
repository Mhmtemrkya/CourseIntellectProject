namespace CourseIntellect.Application.Interfaces;

public interface IDrivingPhotoInspectionService
{
    Task<DrivingPhotoAnalysisResult> AnalyzeAsync(
        byte[] source,
        string fileName,
        DateTime uploadedAtUtc,
        CancellationToken cancellationToken = default);
}

public sealed record DrivingPhotoCheckResult(string Key, string Title, string Severity, string Message);

public sealed record DrivingPhotoAnalysisResult(
    string Overall,
    IReadOnlyList<DrivingPhotoCheckResult> Checks,
    string SourceSha256,
    long SourceBytes,
    int Width,
    int Height,
    int FaceCount,
    double? FaceConfidence,
    double AverageBrightness,
    double BackgroundUniformity,
    byte[]? MebbisJpeg,
    int? MebbisWidth,
    int? MebbisHeight,
    string AnalyzerVersion);
