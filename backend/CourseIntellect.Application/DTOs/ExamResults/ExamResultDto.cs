namespace CourseIntellect.Application.DTOs.ExamResults;

public sealed record ExamResultDto(
    Guid Id,
    string ExamTitle,
    string Type,
    string Subject,
    string DateLabel,
    string StudentName,
    string ClassName,
    int Score,
    int Net
);
