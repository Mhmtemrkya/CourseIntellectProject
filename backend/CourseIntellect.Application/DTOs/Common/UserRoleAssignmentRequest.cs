namespace CourseIntellect.Application.DTOs.Common;

public sealed record UserRoleAssignmentRequest(
    string PrimaryRole,
    string DepartmentOrBranch
);
