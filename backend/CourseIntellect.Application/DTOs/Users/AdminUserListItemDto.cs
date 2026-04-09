namespace CourseIntellect.Application.DTOs.Users;

public sealed record AdminUserListItemDto(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    string Role,
    bool IsActive,
    bool IsEmailVerified,
    DateTime CreatedAt,
    DateTime? LastLoginAt
);
