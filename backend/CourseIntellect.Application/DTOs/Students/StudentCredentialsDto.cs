using CourseIntellect.Application.DTOs.Parents;

namespace CourseIntellect.Application.DTOs.Students;

public sealed record StudentCredentialsDto(
    Guid UserId,
    string FullName,
    string Username,
    string Password,
    string ClassName,
    ParentCredentialsDto? Parent = null
);
