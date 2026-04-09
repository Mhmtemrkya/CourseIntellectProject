namespace CourseIntellect.Application.DTOs.Auth;

public sealed record RegisterRequest(
    string FullName,
    string Username,
    string Password,
    string Role,
    string Campus
);
