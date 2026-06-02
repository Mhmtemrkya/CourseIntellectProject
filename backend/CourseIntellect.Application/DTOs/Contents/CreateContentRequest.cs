namespace CourseIntellect.Application.DTOs.Contents;

public sealed record CreateContentRequest(
    string Subject,
    string Title,
    string Teacher,
    string Info,
    double Progress,
    string FileType,
    string Grade,
    string Views,
    string Size,
    string Description,
    string? FileName,
    string? FileUrl,
    string PublishStatus,
    string? CoverImageUrl = null,
    string? PlaylistKey = null,
    string? PlaylistTitle = null,
    int? PlaylistOrder = null,
    bool AllowDownload = true,
    bool AllowNotes = true,
    bool CompletionCertificate = false
);
