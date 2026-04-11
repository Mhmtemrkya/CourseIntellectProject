namespace CourseIntellect.Application.DTOs.Staff;

public sealed record UpdateStaffRequest(
    string FullName,
    string DepartmentOrBranch,
    string Phone,
    string Email,
    string Education,
    string Campus,
    string HomeroomClass,
    IReadOnlyList<string> AssignedClasses,
    string MaritalStatus,
    int ChildCount,
    string Note
);
