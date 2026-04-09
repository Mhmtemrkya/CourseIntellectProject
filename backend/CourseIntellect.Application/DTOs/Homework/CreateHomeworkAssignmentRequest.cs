namespace CourseIntellect.Application.DTOs.Homework;

public sealed record CreateHomeworkAssignmentRequest(
    string Title,
    string ClassName,
    string Subject,
    string Teacher,
    string Deadline,
    string Description,
    IReadOnlyList<string>? Materials);
