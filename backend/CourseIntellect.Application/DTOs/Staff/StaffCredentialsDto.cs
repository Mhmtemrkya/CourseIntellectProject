namespace CourseIntellect.Application.DTOs.Staff;

public sealed record StaffCredentialsDto(
    Guid UserId,
    string FullName,
    string Username,
    string Password,
    string Role
);
