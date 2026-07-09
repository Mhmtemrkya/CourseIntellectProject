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
    string Note,
    // Şube müdürü (BranchManager) rolünde zorunlu: atanacağı şubenin (OrgUnit) kimliği.
    // Diğer rollerde opsiyonel; verilmezse şube otomatik-stamp ile belirlenir.
    Guid? BranchId = null
);
