namespace CourseIntellect.Application.DTOs.Staff;

public sealed record StaffSummaryDto(
    Guid Id,
    string FullName,
    string Username,
    string Role,
    string DepartmentOrBranch,
    string Campus,
    string Status,
    IReadOnlyList<string> ExtraRoles,
    bool HasRoleHistory
);
