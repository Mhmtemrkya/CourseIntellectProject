namespace CourseIntellect.Application.DTOs.QuestionBank;

public sealed record QuestionPracticeAttemptDto(
    Guid Id,
    Guid QuestionId,
    string StudentName,
    string StudentUsername,
    string AnswerText,
    bool IsCorrect,
    DateTime SubmittedAtUtc,
    /// <summary>Bu denemeyle sunucunun verdiği XP (tekrar denemede 0).</summary>
    int XpAwarded = 0
);
