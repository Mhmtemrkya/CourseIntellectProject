namespace CourseIntellect.Application.DTOs.Homework;

public sealed record HomeworkAssignmentDto(
    Guid Id,
    string Title,
    string ClassName,
    string Subject,
    string Teacher,
    string Deadline,
    string Description,
    IReadOnlyList<string> Materials,
    int Submitted,
    int Total,
    string Status,
    string CreatedAt,
    IReadOnlyList<HomeworkSubmissionDto> Submissions);
