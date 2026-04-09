namespace CourseIntellect.Application.DTOs.QuestionThreads;

public sealed record QuestionThreadAttachmentDto(
    string FileName,
    string FileUrl,
    string FileType
);
