namespace CourseIntellect.Application.DTOs.Common;

public sealed record UserSummaryDto(
    Guid Id,
    string FullName,
    string Username,
    string PrimaryRole,
    IReadOnlyList<string> ExtraRoles,
    string Status,
    string Campus,
    string DepartmentOrBranch
);
