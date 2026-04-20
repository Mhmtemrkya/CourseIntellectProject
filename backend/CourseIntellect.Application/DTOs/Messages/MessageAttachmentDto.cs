namespace CourseIntellect.Application.DTOs.Messages;

public sealed record MessageAttachmentDto(
    string FileName,
    string OriginalFileName,
    string FileUrl,
    string FileType,
    long Size
);
