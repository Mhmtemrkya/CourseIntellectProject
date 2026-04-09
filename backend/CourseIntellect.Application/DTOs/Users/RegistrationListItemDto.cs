namespace CourseIntellect.Application.DTOs.Users;

public sealed record RegistrationListItemDto(
    Guid Id,
    Guid UserId,
    string Email,
    string Name,
    string Role,
    DateTime RegisteredAt,
    bool IsVerified
);
