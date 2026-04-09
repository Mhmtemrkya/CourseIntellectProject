namespace CourseIntellect.Application.DTOs.QuestionThreads;

public sealed record QuestionThreadDto(
    Guid Id,
    string Title,
    string Subject,
    string StudentName,
    string StudentUsername,
    string TeacherName,
    string QuestionText,
    string Status,
    string CreatedAt,
    string LastActivity,
    string AttachmentSummary,
    IReadOnlyList<QuestionThreadAttachmentDto> Attachments,
    IReadOnlyList<QuestionThreadReplyDto> Replies
);
