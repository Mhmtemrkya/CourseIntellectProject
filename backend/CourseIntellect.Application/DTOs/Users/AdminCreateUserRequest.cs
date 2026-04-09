namespace CourseIntellect.Application.DTOs.Users;

public sealed record AdminCreateUserRequest(
    string Name,
    string Email,
    string Password,
    string Role,
    bool IsActive,
    bool IsEmailVerified
);
