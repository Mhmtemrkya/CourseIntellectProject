namespace CourseIntellect.Application.DTOs.QuestionThreads;

public sealed record CreateQuestionThreadRequest(
    string Title,
    string Subject,
    string TeacherName,
    string QuestionText,
    IReadOnlyList<QuestionThreadAttachmentDto>? Attachments
);
