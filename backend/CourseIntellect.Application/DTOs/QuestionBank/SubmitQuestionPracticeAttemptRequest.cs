namespace CourseIntellect.Application.DTOs.QuestionBank;

public sealed record SubmitQuestionPracticeAttemptRequest(
    string StudentName,
    string StudentUsername,
    string AnswerText
);
