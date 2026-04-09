namespace CourseIntellect.Application.DTOs.Courses;

public sealed record CourseDto(
    Guid Id,
    string Name,
    string Description,
    string Category,
    decimal Price,
    string Duration,
    string Level,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
