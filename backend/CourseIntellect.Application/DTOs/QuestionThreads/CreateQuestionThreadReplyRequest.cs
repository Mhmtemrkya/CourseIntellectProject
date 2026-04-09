namespace CourseIntellect.Application.DTOs.QuestionThreads;

public sealed record CreateQuestionThreadReplyRequest(
    string MessageText,
    IReadOnlyList<QuestionThreadAttachmentDto>? Attachments
);
