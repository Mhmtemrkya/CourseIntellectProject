namespace CourseIntellect.Application.DTOs.Staff;

public sealed record CreateStaffRequest(
    string FullName,
    string Role,
    string DepartmentOrBranch,
    string TcNo,
    string Phone,
    string Email,
    string Education,
    string StartDate,
    string Campus,
    string HomeroomClass,
    IReadOnlyList<string> AssignedClasses,
    string MaritalStatus,
    int ChildCount,
    string Note
);
