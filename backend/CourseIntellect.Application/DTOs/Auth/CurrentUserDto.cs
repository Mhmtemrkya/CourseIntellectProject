namespace CourseIntellect.Application.DTOs.Auth;

public sealed record CurrentUserDto(
    Guid Id,
    string FullName,
    string Username,
    string PrimaryRole,
    IReadOnlyList<string> ExtraRoles,
    string Status,
    string Campus,
    string DepartmentOrBranch,
    Guid? TenantId,
    string? TenantName,
    string? TenantSlug,
    bool IsPlatformAdmin
);
