namespace CourseIntellect.Application.DTOs.ExamResults;

public sealed record CreateExamResultRequest(
    string ExamTitle,
    string Type,
    string Subject,
    string DateLabel,
    string StudentName,
    string ClassName,
    int Score,
    decimal Net,
    int? CorrectCount = null,
    int? WrongCount = null,
    int? TotalQuestions = null
);
