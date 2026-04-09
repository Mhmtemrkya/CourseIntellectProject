namespace CourseIntellect.Application.DTOs.Users;

public sealed record AdminUpdateUserRequest(
    string? Name,
    string? Email,
    string? Password,
    string? Role,
    bool? IsActive,
    bool? IsEmailVerified
);
