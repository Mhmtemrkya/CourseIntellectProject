namespace CourseIntellect.Application.DTOs.Homework;

public sealed record HomeworkSubmissionDto(
    Guid Id,
    string StudentName,
    string Note,
    IReadOnlyList<string> Files,
    string SubmittedAtLabel);
