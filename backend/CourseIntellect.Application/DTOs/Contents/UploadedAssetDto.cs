namespace CourseIntellect.Application.DTOs.Contents;

public sealed record UploadedAssetDto(
    string FileName,
    string FileUrl,
    string ContentType,
    long Size
);
