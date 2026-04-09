namespace CourseIntellect.Application.DTOs.Courses;

public sealed record CreateCourseRequest(
    string Name,
    string Description,
    string Category,
    decimal Price,
    string Duration,
    string Level,
    bool IsActive
);
