namespace CourseIntellect.Application.DTOs.QuestionThreads;

public sealed record QuestionThreadReplyDto(
    Guid Id,
    string SenderName,
    string SenderRole,
    string MessageText,
    string CreatedAt,
    IReadOnlyList<QuestionThreadAttachmentDto> Attachments
);
