namespace CourseIntellect.Application.DTOs.QuestionBank;

public sealed record QuestionPracticeAttemptDto(
    Guid Id,
    Guid QuestionId,
    string StudentName,
    string StudentUsername,
    string AnswerText,
    bool IsCorrect,
    DateTime SubmittedAtUtc
);
