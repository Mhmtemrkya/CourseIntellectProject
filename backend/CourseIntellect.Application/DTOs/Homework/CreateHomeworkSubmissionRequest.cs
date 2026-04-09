namespace CourseIntellect.Application.DTOs.Homework;

public sealed record CreateHomeworkSubmissionRequest(
    string StudentName,
    string Note,
    IReadOnlyList<string>? Files);
