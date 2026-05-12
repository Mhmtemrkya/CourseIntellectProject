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
    bool HasRoleHistory,
    IReadOnlyList<string> AssignedClasses,
    string Email,
    string Phone,
    string HomeroomClass,
    string Education,
    string TcNo,
    string MaritalStatus,
    int ChildCount,
    string Note,
    string StartDate
);
