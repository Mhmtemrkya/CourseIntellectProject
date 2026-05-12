namespace CourseIntellect.Application.DTOs.Parents;

public sealed record ParentCredentialsDto(
    Guid UserId,
    string FullName,
    string Username,
    string Password
);
